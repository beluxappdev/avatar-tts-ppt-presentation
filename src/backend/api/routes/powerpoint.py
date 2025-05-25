import uuid
import os
from datetime import datetime
from fastapi import APIRouter, File, UploadFile, Form, HTTPException, Request # type: ignore
import logging

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
    user_id: str = Form(...),
    file: UploadFile = File(...)
) -> dict:
    """
    Upload PowerPoint file and start processing pipeline
    
    Args:
        request: FastAPI request object to access app state
        user_id: User ID from the form
        file: PowerPoint file to process
        
    Returns:
        JSON response with processing information
    """
    try:
        logger.info(f"Received PowerPoint upload request from user: {user_id}")
        
        # Get services from app state
        blob_service = request.app.state.blob_service
        service_bus_service = request.app.state.service_bus_service
        cosmos_service = request.app.state.cosmos_service
        settings = request.app.state.settings
        
        # Validate the uploaded file
        validate_powerpoint_file(file)
        
        # Generate unique ID for this PowerPoint
        ppt_id = str(uuid.uuid4())
        
        # Read file data
        file_data = await file.read()
        
        # Validate file size after reading
        if len(file_data) > MAX_FILE_SIZE_BYTES:
            raise FileValidationError(
                f"File too large. Maximum size allowed: {MAX_FILE_SIZE_BYTES / 1024 / 1024:.1f} MB"
            )
        
        # Create blob path: {container_name}/{ppt_id}/{file_name}.pptx
        blob_name = f"{ppt_id}/{file.filename}"
        
        # Upload file to blob storage
        logger.info(f"Uploading file to blob storage: {blob_name}")
        blob_url = await blob_service.upload_file(
            container_name=settings.blob_container_name,
            blob_name=blob_name,
            file_data=file_data
        )
        
        # Create PowerPoint model for Cosmos DB
        powerpoint_model = PowerPointModel(
            id=ppt_id,
            user_id=user_id,
            file_name=file.filename,
            blob_url=blob_url,
            blob_storage_status=StatusInformation(
                status="Completed",
                completed_at=datetime.utcnow()
            )
        )
        
        # Save to Cosmos DB
        logger.info(f"Creating PowerPoint record in Cosmos DB: {ppt_id}")
        await cosmos_service.create_powerpoint_record(powerpoint_model)
        
        # Create message for Service Bus
        processing_message = ExtractionMessage(
            ppt_id=ppt_id,
            user_id=user_id,
            file_name=file.filename,
            blob_url=blob_url,
            timestamp=datetime.utcnow()
        )
        
        # Send message to Service Bus topic
        logger.info(f"Sending processing message to Service Bus for PPT: {ppt_id}")
        await service_bus_service.send_message(
            destination_type="topic",
            destination_name=settings.service_bus_topic_name,
            message_data=processing_message.model_dump()
        )
        
        logger.info(f"PowerPoint upload completed successfully: {ppt_id}")
        
        return {
            "message": "PowerPoint uploaded successfully and processing started",
            "ppt_id": ppt_id,
            "user_id": user_id,
            "file_name": file.filename,
            "blob_url": blob_url,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except FileValidationError as e:
        logger.error(f"File validation error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
        
    except PPTProcessingError as e:
        logger.error(f"Processing error: {e}")
        raise HTTPException(status_code=500, detail=f"Processing error: {str(e)}")
        
    except Exception as e:
        logger.error(f"Unexpected error during PowerPoint upload: {e}")
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
        user_id = video_request.user_id

        logger.info(f"Received PowerPoint: {ppt_id} upload request from user: {user_id}")
        
        # Get services from app state
        service_bus_service = request.app.state.service_bus_service
        cosmos_service = request.app.state.cosmos_service
        settings = request.app.state.settings
        
        # Generate unique ID for this Video generation request
        video_id = str(uuid.uuid4())

        new_video_info = VideoInformationModel(
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

        # Get powerpoint record from Cosmos DB
        logger.info(f"Retrieving PowerPoint record from Cosmos DB: {ppt_id}")
        powerpoint_record, etag = await cosmos_service.get_powerpoint_record(ppt_id, user_id)
        powerpoint_record.video_information.append(new_video_info)

        # Update the powerpoint with the new video information
        logger.info(f"Updating PowerPoint record in Cosmos DB with video info: {ppt_id}")
        await cosmos_service.update_powerpoint_record(powerpoint_record)

        logger.info(f"Sending video generation messages to Service Bus for PPT: {ppt_id}")
        for slide in video_request.slides_config:
            message = VideoGenerationMessage(
                ppt_id=ppt_id,
                user_id=user_id,
                video_id=video_id,
                index=slide.index,
                script=slide.script,
                show_avatar=slide.avatar_config.show_avatar,
                avatar_persona=slide.avatar_config.avatar_persona,
                avatar_position=slide.avatar_config.avatar_position,
                avatar_size=slide.avatar_config.avatar_size,
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


@router.get("/powerpoint/{ppt_id}/status")
async def get_processing_status(request: Request, ppt_id: str, user_id: str) -> dict:
    """
    Get processing status for a PowerPoint
    
    Args:
        request: FastAPI request object to access app state
        ppt_id: PowerPoint ID
        user_id: User ID (for authorization)
        
    Returns:
        PowerPoint processing status
    """
    try:
        logger.info(f"Getting status for PPT: {ppt_id}, User: {user_id}")
        
        # Get service from app state
        cosmos_service = request.app.state.cosmos_service
        
        # Get PowerPoint record from Cosmos DB
        powerpoint_record, etag = await cosmos_service.get_powerpoint_record(ppt_id, user_id)
        
        if not powerpoint_record:
            raise HTTPException(status_code=404, detail="PowerPoint not found")
        
        return powerpoint_record.model_dump(by_alias=True)
        
    except HTTPException:
        raise
        
    except Exception as e:
        logger.error(f"Error getting PowerPoint status: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/powerpoint/{ppt_id}")
async def get_powerpoint_details(request: Request, ppt_id: str, user_id: str) -> dict:
    """
    Get detailed PowerPoint information
    
    Args:
        request: FastAPI request object to access app state
        ppt_id: PowerPoint ID
        user_id: User ID (for authorization)
        
    Returns:
        PowerPoint details
    """
    try:
        logger.info(f"Getting details for PPT: {ppt_id}, User: {user_id}")
        
        # Get service from app state
        cosmos_service = request.app.state.cosmos_service
        
        # Get PowerPoint record from Cosmos DB
        powerpoint_record, etag = await cosmos_service.get_powerpoint_record(ppt_id, user_id)
        
        if not powerpoint_record:
            raise HTTPException(status_code=404, detail="PowerPoint not found")
        
        return {
            "ppt_id": powerpoint_record.id,
            "user_id": powerpoint_record.user_id,
            "file_name": powerpoint_record.file_name,
            "blob_url": powerpoint_record.blob_url,
            "created_at": powerpoint_record.created_at.isoformat() if powerpoint_record.created_at else None,
            "blob_storage_status": powerpoint_record.blob_storage_status.model_dump() if powerpoint_record.blob_storage_status else None,
            "processing_status": powerpoint_record.processing_status.model_dump() if powerpoint_record.processing_status else None,
            "video_generation_status": powerpoint_record.video_generation_status.model_dump() if powerpoint_record.video_generation_status else None,
        }
        
    except HTTPException:
        raise
        
    except Exception as e:
        logger.error(f"Error getting PowerPoint details: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.delete("/powerpoint/{ppt_id}")
async def delete_powerpoint(request: Request, ppt_id: str, user_id: str) -> dict:
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
        logger.info(f"Deleting PPT: {ppt_id}, User: {user_id}")
        
        # Get services from app state
        cosmos_service = request.app.state.cosmos_service
        blob_service = request.app.state.blob_service
        settings = request.app.state.settings
        
        # Get PowerPoint record first to verify ownership
        powerpoint_record = await cosmos_service.get_powerpoint_record(ppt_id, user_id)
        
        if not powerpoint_record:
            raise HTTPException(status_code=404, detail="PowerPoint not found")
        
        # Delete the blob file
        blob_name = f"{ppt_id}/{powerpoint_record.file_name}"
        await blob_service.delete_file(
            container_name=settings.blob_container_name,
            blob_name=blob_name
        )
        
        # Note: You'll need to implement delete_powerpoint_record in your CosmosDBService
        # await cosmos_service.delete_powerpoint_record(ppt_id, user_id)
        
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