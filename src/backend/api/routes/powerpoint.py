import uuid
import os
import io
from pptx import Presentation # type: ignore
from datetime import datetime
from fastapi import APIRouter, File, UploadFile, Form, HTTPException, Request, BackgroundTasks # type: ignore
import logging

from common.models.user import PowerPointSummary, VideoSummary
from common.models.powerpoint import PowerPointModel, StatusInformation, VideoInformationModel, SlideVideoModel
from common.models.video import VideoGenerationRequestModel
from common.models.messages import ExtractionMessage, VideoGenerationMessage
from common.utils.exceptions import PPTProcessingError, FileValidationError, PowerPointNotFoundError
from common.constants import ALLOWED_FILE_EXTENSIONS, MAX_FILE_SIZE_BYTES

# Setup logger
logger = logging.getLogger(__name__)

router = APIRouter()


def validate_powerpoint_file(file: UploadFile) -> None:
    """ Validate the uploaded PowerPoint file

    Args:
        file (UploadFile): The uploaded PowerPoint file to validate

    Raises:
        FileValidationError: If the file is not a valid PowerPoint file or exceeds size limits
        FileValidationError: If the file type is not allowed or exceeds size limits
    """
    
    # Check file extension
    file_extension = os.path.splitext(file.filename)[1].lower()
    if file_extension not in ALLOWED_FILE_EXTENSIONS:
        raise FileValidationError(
            f"Invalid file type. Allowed extensions: {', '.join(ALLOWED_FILE_EXTENSIONS)}"
        )
    
    # Check file size (if available)
    if hasattr(file, 'size') and file.size and file.size > MAX_FILE_SIZE_BYTES:
        raise FileValidationError(
            f"File too large. Maximum size allowed: {MAX_FILE_SIZE_BYTES / 1024 / 1024:.1f} MB"
        )


@router.post("/powerpoint/upload")
async def upload_powerpoint(
    request: Request,
    background_tasks: BackgroundTasks,
    user_id: str = Form(...),
    file: UploadFile = File(...)
) -> dict:
    """
    Upload PowerPoint file and start processing pipeline
    
    Args:
        request: FastAPI request object to access app state
        background_tasks: FastAPI background tasks
        user_id: User ID from the form
        file: PowerPoint file to process
        
    Returns:
        JSON response with processing information
    """
    try:
        logger.info(f"Received PowerPoint upload request from user: {user_id}")
        
        # Get services from app state
        cosmos_service = request.app.state.cosmos_service
        
        # Validate the uploaded file
        validate_powerpoint_file(file)
        
        # Generate unique ID for this PowerPoint
        ppt_id = str(uuid.uuid4())
        user_id = user_id.strip()
        
        # Read file data for validation
        file_data = await file.read()
        
        # Validate file size after reading
        if len(file_data) > MAX_FILE_SIZE_BYTES:
            raise FileValidationError(
                f"File too large. Maximum size allowed: {MAX_FILE_SIZE_BYTES / 1024 / 1024:.1f} MB"
            )
        
        # Get slide count for the initial record
        slide_count = get_slide_count_from_pptx(file_data)

        if slide_count > 15:
            raise FileValidationError(
                "PowerPoint file exceeds the maximum allowed number of slides (15)."
            )
        
        # Create PowerPoint model for Cosmos DB with initial status
        powerpoint_model = PowerPointModel(
            id=ppt_id,
            user_id=user_id,
            file_name=file.filename,
            blob_url=None,  # Will be updated in background task
            blob_storage_status=StatusInformation(
                status="Processing",  # Initial status
                started_at=datetime.utcnow()
            ),
            number_of_slides=slide_count
        )

        powerpoint_summary = PowerPointSummary(
            ppt_id=ppt_id,
            filename=file.filename,
        )
        
        # Create record in Cosmos DB immediately
        logger.info(f"Creating PowerPoint record in Cosmos DB: {ppt_id}")
        await cosmos_service.create_powerpoint_record(powerpoint_model)
        await cosmos_service.create_powerpoint_summary(powerpoint_summary, user_id)
        
        # Add the blob upload and Service Bus messaging to background tasks
        background_tasks.add_task(
            process_powerpoint_background,
            request.app.state,
            ppt_id,
            user_id,
            file.filename,
            file_data
        )
        
        logger.info(f"PowerPoint upload initiated successfully: {ppt_id}")
        
        # Return immediately with ppt_id
        return {
            "message": "PowerPoint uploaded successfully and processing started",
            "ppt_id": ppt_id,
            "file_name": file.filename
        }
        
    except FileValidationError as e:
        logger.error(f"File validation failed: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error during PowerPoint upload: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error during upload")


async def process_powerpoint_background(
    app_state,
    ppt_id: str,
    user_id: str,
    filename: str,
    file_data: bytes
):
    """
    Background task to handle blob upload and Service Bus messaging
    """
    try:
        # Get services from app state
        blob_service = app_state.blob_service
        service_bus_service = app_state.service_bus_service
        cosmos_service = app_state.cosmos_service
        settings = app_state.settings
        
        # Create blob path: {container_name}/{ppt_id}/{file_name}.pptx
        blob_name = f"{ppt_id}/{filename}"
        
        # Upload file to blob storage
        logger.info(f"Background: Uploading file to blob storage: {blob_name}")
        blob_url = await blob_service.upload_file(
            container_name=settings.blob_container_name,
            blob_name=blob_name,
            file_data=file_data
        )

        # Get the current PowerPoint record to update it
        logger.info(f"Background: Retrieving PowerPoint record to update: {ppt_id}")
        current_powerpoint, _ = await cosmos_service.get_powerpoint_record(ppt_id, user_id)
        
        # Update the record with blob URL and completed status
        current_powerpoint.blob_url = blob_url
        current_powerpoint.blob_storage_status = StatusInformation(
            status="Completed",
            completed_at=datetime.utcnow()
        )

        # Update the record using your existing method
        logger.info(f"Background: Updating PowerPoint record with blob URL: {ppt_id}")
        await cosmos_service.update_powerpoint_record(current_powerpoint)
        
        # Create message for Service Bus
        processing_message = ExtractionMessage(
            ppt_id=ppt_id,
            user_id=user_id,
            file_name=filename,
            blob_url=blob_url,
            timestamp=datetime.utcnow()
        )

        # Send message to Service Bus topic
        logger.info(f"Background: Sending processing message to Service Bus for PPT: {ppt_id}")
        await service_bus_service.send_message(
            destination_type="topic",
            destination_name=settings.service_bus_topic_name,
            message_data=processing_message.model_dump()
        )
        
        logger.info(f"Background: PowerPoint processing completed successfully: {ppt_id}")
        
    except Exception as e:
        logger.error(f"Background task failed for PPT {ppt_id}: {str(e)}")
        
        # Update the record status to failed
        try:
            # Get current record and update status to failed
            current_powerpoint, _ = await cosmos_service.get_powerpoint_record(ppt_id, user_id)
            current_powerpoint.blob_storage_status = StatusInformation(
                status="Failed",
                error_message=str(e),
                completed_at=datetime.utcnow()
            )
            await cosmos_service.update_powerpoint_record(current_powerpoint)
            
        except Exception as update_error:
            logger.error(f"Failed to update PowerPoint record status to failed: {update_error}")

@router.get("/powerpoint/{ppt_id}/slides/user/{user_id}")
async def get_powerpoint_slides(
    ppt_id: str,
    user_id: str,
    request: Request
) -> dict:
    """
    Fetch PowerPoint slides (images and scripts) from blob storage
    
    Args:
        ppt_id: PowerPoint ID to fetch slides for
        request: FastAPI request object to access app state
        
    Returns:
        JSON response with slides data including image URLs with SAS tokens and scripts
    """
    try:
        logger.info(f"Fetching slides for PowerPoint: {ppt_id}")
        
        # Get services from app state
        blob_service = request.app.state.blob_service
        cosmos_service = request.app.state.cosmos_service
        settings = request.app.state.settings
        
        # Verify PowerPoint exists in Cosmos DB
        try:
            powerpoint_record,_ = await cosmos_service.get_powerpoint_record(ppt_id, user_id)
            if not powerpoint_record:
                raise PowerPointNotFoundError(f"PowerPoint with ID {ppt_id} not found")
        except Exception as e:
            logger.error(f"Error fetching PowerPoint record: {e}")
            raise PowerPointNotFoundError(f"PowerPoint with ID {ppt_id} not found")

        logger.info(f"Powerpoint details: {powerpoint_record}")
        
        # Get number of slides from the record, or attempt to discover them
        number_of_slides = powerpoint_record.number_of_slides
        
        slides = []
        
        # If we don't know the number of slides, we'll try to discover them
        if number_of_slides == 0:
            logger.info(f"Number of slides unknown, discovering slides for PPT: {ppt_id}")
            # Try to find slides by checking for their existence (up to a reasonable limit)
            for i in range(100):  # Maximum 100 slides to check
                image_blob_name = f"{ppt_id}/images/{i}.png"
                if await blob_service.file_exists(settings.blob_container_name, image_blob_name):
                    number_of_slides = i + 1
                else:
                    break
        
        logger.info(f"Processing {number_of_slides} slides for PPT: {ppt_id}")
        
        # Fetch each slide's image and script
        for i in range(number_of_slides):
            slide_data = {
                "index": i,
                "blobUrl": None,
                "script": ""
            }
            
            # Get image URL with SAS token
            image_blob_name = f"{ppt_id}/images/{i}.png"
            try:
                if await blob_service.file_exists(settings.blob_container_name, image_blob_name):
                    image_url_with_sas = await blob_service.get_blob_url_with_sas(
                        container_name=settings.blob_container_name,
                        blob_name=image_blob_name,
                        expiry_hours=24  # SAS token valid for 24 hours
                    )
                    slide_data["blobUrl"] = image_url_with_sas
                    logger.debug(f"Generated SAS URL for image {i}")
                else:
                    logger.warning(f"Image not found for slide {i}: {image_blob_name}")
            except Exception as e:
                logger.error(f"Error getting image URL for slide {i}: {e}")
            
            # Get script content
            script_blob_name = f"{ppt_id}/scripts/{i}.txt"
            try:
                if await blob_service.file_exists(settings.blob_container_name, script_blob_name):
                    script_data = await blob_service.download_file(
                        container_name=settings.blob_container_name,
                        blob_name=script_blob_name
                    )
                    slide_data["script"] = script_data.decode('utf-8').strip()
                    logger.debug(f"Downloaded script for slide {i}")
                else:
                    logger.warning(f"Script not found for slide {i}: {script_blob_name}")
            except Exception as e:
                logger.error(f"Error downloading script for slide {i}: {e}")
            
            slides.append(slide_data)
        
        logger.info(f"Successfully fetched {len(slides)} slides for PPT: {ppt_id}")
        
        return {
            "ppt_id": ppt_id,
            "total_slides": len(slides),
            "slides": slides,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except PowerPointNotFoundError as e:
        logger.error(f"PowerPoint not found: {e}")
        raise HTTPException(status_code=404, detail=str(e))
        
    except Exception as e:
        logger.error(f"Unexpected error fetching slides for PPT {ppt_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/powerpoint/generate_video")
async def generate_video_powerpoint(
    request: Request,
    video_request: VideoGenerationRequestModel,
) -> dict:
    """ Generate video from PowerPoint slides

    Args:
        request (Request): FastAPI request object to access app state
        video_request (VideoGenerationRequestModel): Video generation request containing PowerPoint ID, user ID, and slide configurations

    Raises:
        PowerPointNotFoundError: If the PowerPoint does not exist
        PPTProcessingError: If there is an error during processing
        Exception: If there is an unexpected error during the request

    Returns:
        dict: Response containing the status of the video generation request
    """
    try:
        logger.info(f"Received video request data: {video_request.model_dump()}")

        # Parse the video generation request
        ppt_id = video_request.ppt_id
        user_id = video_request.user_id.strip()
        language = video_request.language

        logger.info(f"Received PowerPoint: {ppt_id} upload request from user: {user_id}")
        
        # Get services from app state
        service_bus_service = request.app.state.service_bus_service
        cosmos_service = request.app.state.cosmos_service
        settings = request.app.state.settings
        
        # Generate unique ID for this Video generation request
        video_id = str(uuid.uuid4())

        video_info = VideoInformationModel(
            video_id=video_id,
            status=StatusInformation(),
            total_slides=len(video_request.slides_config),
            completed_slides=0,
            slides=[SlideVideoModel(
                index=slide.index,
                status=StatusInformation(),
                generation_status=StatusInformation(),
                transformation_status=StatusInformation(),
                video_url=None
            )  for slide in video_request.slides_config],
        )

        video_summary = VideoSummary(
            video_id=video_id,
        )

        # Get powerpoint record from Cosmos DB
        logger.info(f"Retrieving PowerPoint record from Cosmos DB: {ppt_id}")
        powerpoint_record, _ = await cosmos_service.get_powerpoint_record(ppt_id, user_id)
        powerpoint_record.video_information.append(video_info)

        # Update the powerpoint with the new video information
        logger.info(f"Updating PowerPoint record in Cosmos DB with video info: {ppt_id}")
        await cosmos_service.update_powerpoint_record(powerpoint_record)
        await cosmos_service.create_video_summary(video_summary, ppt_id, user_id)

        logger.info(f"Sending video generation messages to Service Bus for PPT: {ppt_id}")
        for slide in video_request.slides_config:
            message = VideoGenerationMessage(
                ppt_id=ppt_id,
                user_id=user_id,
                video_id=video_id,
                index=slide.index,
                language=language,
                script=slide.script,
                show_avatar=slide.avatar_config.show_avatar,
                avatar_persona=slide.avatar_config.avatar_persona,
                avatar_position=slide.avatar_config.avatar_position,
                avatar_size=slide.avatar_config.avatar_size,
                pause_before=slide.avatar_config.pause_before,
                pause_after=slide.avatar_config.pause_after,
                timestamp=datetime.utcnow()
            )
            logger.info(f"Sending video generation message for slide {slide.index} to Service Bus")
            # Send messages to Service Bus topic for video generation
            await service_bus_service.send_message(
                destination_type="queue",
                destination_name=settings.service_bus_video_generation_queue_name,
                message_data=message.model_dump()
            )
        
        
        logger.info(f"PowerPoint video generation request completed successfully: {ppt_id}")
        
        return {
            "message": "PowerPoint video generation requested successfully and processing started",
            "ppt_id": ppt_id,
            "user_id": user_id,
            "video_id": video_id,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except PowerPointNotFoundError as e:
        logger.error(f"PowerPoint not found: {e}")
        raise HTTPException(status_code=404, detail=str(e))
        
    except PPTProcessingError as e:
        logger.error(f"Processing error: {e}")
        raise HTTPException(status_code=500, detail=f"Processing error: {str(e)}")
        
    except Exception as e:
        logger.error(f"Unexpected error during PowerPoint upload: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/powerpoint/{ppt_id}/video/{video_id}/user/{user_id}")
async def get_powerpoint_video(
    ppt_id: str,
    video_id: str,
    user_id: str,
    request: Request
) -> dict:
    """
    Retrieve a specific generated video for a PowerPoint presentation.

    Args:
        ppt_id: PowerPoint ID
        video_id: Video ID
        user_id: User ID (for authorization)
        request: FastAPI request object to access app state

    Returns:
        JSON response containing the video URL with SAS token
    """
    try:
        logger.info(f"Fetching video {video_id} for PowerPoint {ppt_id}, User: {user_id}")

        # Get services from app state
        cosmos_service = request.app.state.cosmos_service
        blob_service = request.app.state.blob_service
        settings = request.app.state.settings

        # Verify PowerPoint exists in Cosmos DB
        powerpoint_record, _ = await cosmos_service.get_powerpoint_record(ppt_id, user_id)
        if not powerpoint_record:
            raise HTTPException(status_code=404, detail=f"PowerPoint with ID {ppt_id} not found")

        # Verify video exists in PowerPoint record
        video_info = next((video for video in powerpoint_record.video_information if video.video_id == video_id), None)
        if not video_info:
            raise HTTPException(status_code=404, detail=f"Video with ID {video_id} not found in PowerPoint {ppt_id}")
        elif video_info.status.status != "Completed":
            return {
                "message": "Video generation is still in progress.",
                "ppt_id": ppt_id,
                "video_id": video_id,
                "status": video_info.status.status,
                "timestamp": datetime.utcnow().isoformat()
            }

        # Construct blob path
        video_blob_name = f"{ppt_id}/videos/{video_id}/final.mp4"

        # Check if video exists in blob storage
        if not await blob_service.file_exists(settings.blob_container_name, video_blob_name):
            raise HTTPException(status_code=404, detail=f"Video file not found in storage for video ID {video_id}")

        # Generate SAS URL for video
        video_url_with_sas = await blob_service.get_blob_url_with_sas(
            container_name=settings.blob_container_name,
            blob_name=video_blob_name,
            expiry_hours=24  # SAS token valid for 24 hours
        )

        logger.info(f"Successfully retrieved video URL for video {video_id}")

        return {
            "ppt_id": ppt_id,
            "video_id": video_id,
            "status": video_info.status.status,
            "video_url": video_url_with_sas,
            "timestamp": datetime.utcnow().isoformat()
        }

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"Unexpected error fetching video {video_id} for PPT {ppt_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.delete("/powerpoint/{ppt_id}")
async def delete_powerpoint(request: Request, ppt_id: str, user: dict) -> dict:
    """
    Delete a PowerPoint and its associated files
    
    Args:
        request: FastAPI request object to access app state
        ppt_id: PowerPoint ID
        user_id: User ID (for authorization)
        
    Returns:
        Deletion confirmation
    """
    try:
        user_id = user.get("userId")
        logger.info(f"Deleting PPT: {ppt_id}, User: {user_id}")
        
        # Get services from app state
        cosmos_service = request.app.state.cosmos_service
        blob_service = request.app.state.blob_service
        settings = request.app.state.settings
        
        # Get PowerPoint record first to verify ownership
        powerpoint_record = await cosmos_service.get_powerpoint_record(ppt_id, user_id)
        
        if not powerpoint_record:
            raise HTTPException(status_code=404, detail="PowerPoint not found")
        
        # Delete the blob folder
        blob_name = f"{ppt_id}"
        await blob_service.delete_folder(
            container_name=settings.blob_container_name,
            folder_name=blob_name
        )
        logger.info(f"Deleted blob folder for PowerPoint: {ppt_id}")


        await cosmos_service.delete_powerpoint_record(ppt_id, user_id)
        
        logger.info(f"PowerPoint deleted successfully: {ppt_id}")
        
        return {
            "message": "PowerPoint deleted successfully",
            "ppt_id": ppt_id,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
        
    except Exception as e:
        logger.error(f"Error deleting PowerPoint: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

# Delete request for video
@router.delete("/powerpoint/{ppt_id}/video/{video_id}")
async def delete_video(request: Request, ppt_id: str, video_id: str, user: dict) -> dict:
    """
    Delete a video from a PowerPoint presentation

    Args:
        request: FastAPI request object to access app state
        ppt_id: PowerPoint ID
        video_id: Video ID
        user_id: User ID (for authorization)

    Returns:
        Deletion confirmation
    """
    try:
        user_id = user.get("userId")
        logger.info(f"Deleting video: {video_id}, PPT: {ppt_id}, User: {user_id}")

        # Get services from app state
        cosmos_service = request.app.state.cosmos_service
        blob_service = request.app.state.blob_service
        settings = request.app.state.settings

        # Get PowerPoint record first to verify ownership
        powerpoint_record = await cosmos_service.get_powerpoint_record(ppt_id, user_id)

        if not powerpoint_record:
            raise HTTPException(status_code=404, detail="PowerPoint not found")

        # Delete the video blob
        video_folder_name = f"{ppt_id}/videos/{video_id}"
        await blob_service.delete_folder(
            container_name=settings.blob_container_name,
            folder_name=video_folder_name
        )
        logger.info(f"Deleted video blob for PowerPoint: {ppt_id}, Video: {video_id}")

        await cosmos_service.delete_video(ppt_id, video_id, user_id)

        logger.info(f"Video deleted successfully: {video_id} from PowerPoint: {ppt_id}")
        return {
            "message": "Video deleted successfully",
            "ppt_id": ppt_id,
            "video_id": video_id,
            "timestamp": datetime.utcnow().isoformat()
        }

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"Error deleting video: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

def get_slide_count_from_pptx(file_data: bytes) -> int:
    """
    Extract the number of slides from PowerPoint file data
    
    Args:
        file_data (bytes): The PowerPoint file data
        
    Returns:
        int: Number of slides in the presentation
        
    Raises:
        PPTProcessingError: If unable to read the PowerPoint file
    """
    try:
        # Create a BytesIO object from the file data
        ppt_stream = io.BytesIO(file_data)
        
        # Load the presentation
        presentation = Presentation(ppt_stream)
        
        # Get the number of slides
        slide_count = len(presentation.slides)
        
        logger.info(f"PowerPoint contains {slide_count} slides")
        return slide_count
        
    except Exception as e:
        logger.error(f"Error reading PowerPoint file to get slide count: {e}")
        raise PPTProcessingError(f"Unable to read PowerPoint file: {str(e)}")