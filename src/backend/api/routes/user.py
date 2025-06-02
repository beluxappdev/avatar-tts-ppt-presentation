from fastapi import APIRouter, HTTPException, Request, status # type: ignore
from common.models.user import User
from common.services.cosmos_db import CosmosDBService
from azure.core.exceptions import AzureError # type: ignore
import logging
from typing import List, Optional
from pydantic import BaseModel, Field # type: ignore


logger = logging.getLogger(__name__)

router = APIRouter()

# Response models for the new endpoint
class VideoStatusResponse(BaseModel):
    video_id: str = Field(alias="videoId")
    video_name: str = Field(alias="videoName")
    status: str  # "Completed" or "Processing"
    
    class Config:
        populate_by_name = True

class PowerPointStatusResponse(BaseModel):
    ppt_id: str = Field(alias="pptId")
    filename: str
    status: str  # "Completed" or "Processing"
    videos: List[VideoStatusResponse] = Field(default_factory=list)
    blob_url: Optional[str] = Field(default=None, alias="blobUrl")
    
    class Config:
        populate_by_name = True

class UserPowerPointsResponse(BaseModel):
    user_id: str = Field(alias="userId")
    username: str
    email: str
    powerpoints: List[PowerPointStatusResponse] = Field(default_factory=list)
    
    class Config:
        populate_by_name = True


@router.post("/user", response_model=User, status_code=status.HTTP_201_CREATED)
async def create_user(user: User, request: Request):
    """
    Create a new user if they don't already exist in the database.
    
    Args:
        user (User): The user object to create
        request (Request): FastAPI request object to access app state
        
    Returns:
        User: The created or existing user object
        
    Raises:
        HTTPException: 409 if user exists, 500 if there's a database error
    """
    try:
        # Get Cosmos DB service from app state
        cosmos_service: CosmosDBService = request.app.state.cosmos_service
        
        # Check if user already exists
        existing_user = await cosmos_service.get_user_by_id(user.id)
        
        if existing_user:
            logger.info(f"User already exists with ID: {user.id}")
            # Return 409 Conflict with existing user data
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "message": "User already exists",
                    "user": existing_user.model_dump(mode="json", by_alias=True)
                }
            )
        
        # Create new user
        created_user = await cosmos_service.create_user_record(user)
        
        logger.info(f"Successfully created user with ID: {user.id}")
        return created_user
        
    except HTTPException:
        # Re-raise HTTP exceptions (like 409 Conflict)
        raise
    except AzureError as e:
        logger.error(f"Azure error creating user: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred while creating user"
        )
    except Exception as e:
        logger.error(f"Unexpected error creating user: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred"
        )

@router.get("/user/{id}/powerpoints", response_model=UserPowerPointsResponse)
async def get_user_powerpoints(id: str, request: Request):
    """
    Get all PowerPoints for a specific user with their status information.
    
    Args:
        id (str): The user ID to retrieve PowerPoints for
        request (Request): FastAPI request object to access app state
        
    Returns:
        UserPowerPointsResponse: User info with PowerPoints and their statuses
        
    Raises:
        HTTPException: 404 if user not found, 500 if database error
    """
    try:
        # Get Cosmos DB service from app state
        cosmos_service = request.app.state.cosmos_service
        blob_service = request.app.state.blob_service
        settings = request.app.state.settings
        
        # Get user by ID
        user = await cosmos_service.get_user_by_id(id)
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User not found with ID: {id}"
            )
        
        # Process each PowerPoint to get status information
        powerpoints_with_status = []
        
        for ppt_summary in reversed(user.powerpoints):
            try:
                # Get PowerPoint record from the other container to check statuses
                ppt_record, _ = await cosmos_service.get_powerpoint_record(ppt_summary.ppt_id, user.id)

                # Determine PowerPoint status based on blob_storage_status, script_extraction_status, image_extraction_status
                ppt_status = "Processing"  # Default status
                ppt_first_slide_url = None
                
                if ppt_record:
                    blob_status = ppt_record.blob_storage_status.status
                    script_status = ppt_record.script_extraction_status.status
                    image_status = ppt_record.image_extraction_status.status
                    logger.info(f"PowerPoint {ppt_summary.ppt_id} statuses - Blob: {blob_status}, Script: {script_status}, Image: {image_status}")
                    
                    # If all three statuses are "Completed", then PowerPoint is completed
                    if (blob_status == "Completed" and 
                        script_status == "Completed" and 
                        image_status == "Completed"):
                        ppt_status = "Completed"
                        ppt_first_slide_url = await blob_service.get_blob_url_with_sas(
                            container_name=settings.blob_container_name,
                            blob_name=f"{ppt_summary.ppt_id}/images/0.png",
                        )
                
                # Process videos for this PowerPoint
                videos_with_status = []
                
                # Reverse the order of videos and calculate index
                total_videos = len(ppt_summary.videos)
                for idx, video_summary in enumerate(reversed(ppt_summary.videos)):
                    # Calculate the original position (reversed index starting from 1)
                    video_index = total_videos - idx
                    
                    # Find the video in the PowerPoint record's video_information
                    video_status = "Processing"  # Default status
                    for video_info in ppt_record.video_information:
                        if video_info.video_id == video_summary.video_id:
                            # Check if video status is "Completed"
                            if video_info.status.status == "Completed":
                                video_status = "Completed"
                            break
                        
                    videos_with_status.append(VideoStatusResponse(
                        video_id=video_summary.video_id,
                        video_name=f'Video {video_index}',
                        status=video_status
                    ))
                
                # Create PowerPoint response with status
                ppt_response = PowerPointStatusResponse(
                    ppt_id=ppt_summary.ppt_id,
                    filename=ppt_summary.filename,
                    status=ppt_status,
                    videos=videos_with_status,
                    blob_url=ppt_first_slide_url if ppt_first_slide_url else None
                )
                
                powerpoints_with_status.append(ppt_response)
                
            except Exception as ppt_error:
                logger.warning(f"Error processing PowerPoint {ppt_summary.ppt_id}: {ppt_error}")
                # If we can't get PowerPoint record, still include it with "Processing" status
                videos_with_status = []
                for video_summary in ppt_summary.videos:
                    if video_summary.ppt_id == ppt_summary.ppt_id:
                        videos_with_status.append(VideoStatusResponse(
                            video_id=video_summary.video_id,
                            ppt_id=video_summary.ppt_id,
                            status="Processing"
                        ))
                
                ppt_response = PowerPointStatusResponse(
                    ppt_id=ppt_summary.ppt_id,
                    filename=ppt_summary.filename,
                    status="Processing",
                    videos=videos_with_status
                )
                powerpoints_with_status.append(ppt_response)
        
        # Create response
        response = UserPowerPointsResponse(
            user_id=user.id,
            username=user.username,
            email=user.email,
            powerpoints=powerpoints_with_status
        )
        
        logger.info(f"Successfully retrieved PowerPoints for user: {id}")
        return response
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except AzureError as e:
        logger.error(f"Azure error retrieving user PowerPoints: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred while retrieving user PowerPoints"
        )
    except Exception as e:
        logger.error(f"Unexpected error retrieving user PowerPoints: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred"
        )