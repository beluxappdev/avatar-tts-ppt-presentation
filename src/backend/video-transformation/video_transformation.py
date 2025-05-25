import tempfile
import os
import aiohttp # type: ignore
from typing import Dict, Any
from azure.identity.aio import DefaultAzureCredential # type: ignore
from azure.servicebus import ServiceBusReceivedMessage # type: ignore

from common.services.base_service import BaseService
from common.services.cosmos_db import CosmosDBService
from common.services.blob_storage import BlobStorageService
from common.models.powerpoint import StatusEnum
from common.models.messages import VideoGenerationMessage
from common.models.service_config import ServiceBusConfig
from common.utils.config import Settings

from utils.video_transformer import VideoTransformer


class VideoTransformation(BaseService):
    """Service for customizing the video with avatar configuration"""
    
    def __init__(self, settings: Settings):
        config = ServiceBusConfig.for_queue(settings.service_bus_video_transformation_queue_name)
        super().__init__(settings, "Video Transformation Service", config)
        
    
    async def _initialize(self):
        """Initialize video generator specific resources"""
        self.credential = DefaultAzureCredential()
        self.blob_storage = BlobStorageService(self.settings.storage_account_url)
        self.cosmos_db = CosmosDBService(
            self.settings.cosmos_db_endpoint,
            self.settings.cosmos_db_database_name,
            self.settings.cosmos_db_container_name
        )
    
    async def handle_message(self, message_data: Dict[str, Any]) -> None:
        """Handle video generation message"""
    
        temp_files = []  # Track temporary files for cleanup
    
        try:
            # Create VideoGenerationMessage object
            video_message = VideoGenerationMessage(**message_data)
        
            # Update Cosmos DB status to In Progress
            self.logger.info(f"Updating video generation status for PPT {video_message.ppt_id}, slide {video_message.index} to In Progress")
            await self._update_status(video_message, StatusEnum.PROCESSING)

            # Download avatar video from URL
            self.logger.info(f"Downloading avatar video from {video_message.avatar_video_url}")
            avatar_video_path = None
            async with aiohttp.ClientSession() as session:
                async with session.get(video_message.avatar_video_url) as response:
                    if response.status == 200:
                        # Create temporary file for avatar video
                        with tempfile.NamedTemporaryFile(delete=False, suffix='.mp4') as temp_avatar:
                            avatar_video_path = temp_avatar.name
                            temp_files.append(avatar_video_path)
                            async for chunk in response.content.iter_chunked(8192):
                                temp_avatar.write(chunk)
                    else:
                        raise Exception(f"Failed to download avatar video: HTTP {response.status}")

            # Download background image from blob storage
            self.logger.info(f"Downloading background image for PPT {video_message.ppt_id}, slide {video_message.index}")
            background_image = await self.blob_storage.download_file(
                container_name=self.settings.blob_container_name,
                blob_name=f"{video_message.ppt_id}/images/{video_message.index}.png"
            )

            # Create temporary file for background image
            with tempfile.NamedTemporaryFile(delete=False, suffix='.png') as temp_bg:
                background_image_path = temp_bg.name
                temp_files.append(background_image_path)
                temp_bg.write(background_image)

            # Create temporary file for output video
            with tempfile.NamedTemporaryFile(delete=False, suffix='.mp4') as temp_output:
                output_video_path = temp_output.name
                temp_files.append(output_video_path)

            # Transform the video
            self.logger.info(f"Transforming video for PPT {video_message.ppt_id}, slide {video_message.index}")
            transformer = VideoTransformer()
            transformer.transform_video(
                avatar_path=avatar_video_path,
                background_path=background_image_path,
                output_path=output_video_path,
                position=(video_message.avatar_position, "bottom"),
                size=video_message.avatar_size,
                crop_aspect_ratio=9/16
            )

            # Read the output video file as bytes
            with open(output_video_path, 'rb') as f:
                output_video_bytes = f.read()

            # Upload the transformed video to blob storage
            self.logger.info(f"Uploading transformed video for PPT {video_message.ppt_id}, slide {video_message.index}")
            await self.blob_storage.upload_file(
                container_name=self.settings.blob_container_name,
                blob_name=f"{video_message.ppt_id}/videos/{video_message.video_id}/{video_message.index}.mp4",
                file_data=output_video_bytes
            )

            # Update Cosmos DB status to Completed
            self.logger.info(f"Updating video generation status for PPT {video_message.ppt_id}, slide {video_message.index} to Completed")
            await self._update_status(video_message, StatusEnum.COMPLETED)

            # Send concatenation message if needed
            await self.send_concatenation_message(video_message)

        except Exception as e:
            self.logger.error(f"Error processing video transformation for PPT {video_message.ppt_id}, slide {video_message.index}: {str(e)}")
        
            # Update status to failed if we have a valid video_message
            if 'video_message' in locals():
                try:
                    await self._update_status(video_message, StatusEnum.FAILED)
                except Exception as status_error:
                    self.logger.error(f"Failed to update status to FAILED: {str(status_error)}")
        
            raise  # Re-raise the exception so the message handling framework can handle it appropriately
    
        finally:
            # Clean up temporary files
            for temp_file in temp_files:
                try:
                    if os.path.exists(temp_file):
                        os.unlink(temp_file)
                        self.logger.debug(f"Cleaned up temporary file: {temp_file}")
                except Exception as cleanup_error:
                    self.logger.warning(f"Failed to clean up temporary file {temp_file}: {str(cleanup_error)}")

        
    
    async def _update_status(self, video_message: VideoGenerationMessage, status: StatusEnum, status_type: str = 'both'):
        """Update video generation status in Cosmos DB"""
        if status_type in ['transformation_status', 'both']:
            await self.cosmos_db.update_slide_video_status(
                ppt_id=video_message.ppt_id,
                user_id=video_message.user_id,
                video_id=video_message.video_id,
                slide_index=video_message.index,
                status_type='transformation_status',
                new_status=status,
            )
        
        if status_type in ['status', 'both']:
            await self.cosmos_db.update_slide_video_status(
                ppt_id=video_message.ppt_id,
                user_id=video_message.user_id,
                video_id=video_message.video_id,
                slide_index=video_message.index,
                status_type='status',
                new_status=status,
            )
    
    
    async def send_concatenation_message(self, original_message: VideoGenerationMessage) -> None:
        """Send message to video transformation queue"""
        try:
            concatenation_message = {
                'ppt_id': original_message.ppt_id,
                'user_id': original_message.user_id,
                'video_id': original_message.video_id,
                'index': original_message.index,
                'show_avatar': original_message.show_avatar,
                'avatar_persona': original_message.avatar_persona,
                'avatar_position': original_message.avatar_position,
                'avatar_size': original_message.avatar_size,
                'timestamp': original_message.timestamp.isoformat() if original_message.timestamp else None
            }
            
            await self.service_bus.send_message(
                destination_type="queue",
                destination_name=self.settings.service_bus_video_concatenation_queue_name,
                message_data=concatenation_message
            )
            
            self.logger.info(f"Sent concatenation message for PPT {original_message.ppt_id}, slide {original_message.index}")
            
        except Exception as e:
            self.logger.error(f"Failed to send concatenation message: {str(e)}")
            raise
    
    async def cleanup(self):
        """Cleanup video generator specific resources"""
        try:
            if hasattr(self, 'cosmos_db'):
                await self.cosmos_db.close()
            if hasattr(self, 'credential'):
                await self.credential.close()
        except Exception as e:
            self.logger.error(f"Error during video generator cleanup: {str(e)}")