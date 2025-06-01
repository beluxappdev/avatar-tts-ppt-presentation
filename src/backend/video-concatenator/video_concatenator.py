import tempfile
import os
import asyncio
import shutil
import aiofiles
from typing import Dict, Any, List
from azure.identity.aio import DefaultAzureCredential # type: ignore

from common.services.base_service import BaseService
from common.services.cosmos_db import CosmosDBService
from common.services.blob_storage import BlobStorageService
from common.models.powerpoint import StatusEnum
from common.models.messages import VideoConcatenationMessage
from common.models.service_config import ServiceBusConfig
from common.utils.config import Settings


class VideoConcatenator(BaseService):
    """
    Service for video concatenation processing.
    
    This service processes video concatenation requests by:
    1. Receiving messages from Azure Service Bus
    2. Downloading individual video files from Azure Blob Storage
    3. Concatenating videos using FFmpeg in the correct order
    4. Uploading the final concatenated video back to Blob Storage
    5. Updating processing status in Cosmos DB
    
    The service expects video files to be stored in blob storage with the pattern:
    {ppt_id}/videos/{video_id}/{index}.mp4 (e.g., 0.mp4, 1.mp4, 2.mp4, etc.)
    
    The final concatenated video is saved as:
    {ppt_id}/videos/{video_id}/final.mp4
    """
    
    def __init__(self, settings: Settings):
        """
        Initialize the VideoConcatenation service.
        
        Args:
            settings: Application settings containing configuration for Azure services
        """
        config = ServiceBusConfig.for_queue(settings.service_bus_video_concatenation_queue_name)
        super().__init__(settings, "Video Concatenation Service", config)
        
    
    async def _initialize(self):
        """Initialize video concatenation specific resources including Azure services."""
        self.credential = DefaultAzureCredential()
        self.blob_storage = BlobStorageService(self.settings.storage_account_url)
        self.cosmos_db = CosmosDBService(
            self.settings.cosmos_db_endpoint,
            self.settings.cosmos_db_database_name,
        )
    
    async def handle_message(self, message_data: Dict[str, Any]) -> None:
        """
        Handle video concatenation message from Service Bus.
        
        Processes the concatenation request by updating status, downloading videos,
        concatenating them, and uploading the result back to blob storage.
        
        Args:
            message_data: Dictionary containing video concatenation message data
            
        Raises:
            Exception: Re-raises any processing errors after updating status to FAILED
        """
        try:
            # Parse the message body
            message_data = VideoConcatenationMessage(**message_data)
            
            self.logger.info(f"Processing concatenation request for PPT ID: {message_data.ppt_id}")
            
            # Extract necessary information from the message
            ppt_id = message_data.ppt_id
            video_id = message_data.video_id
            
            if not ppt_id or not video_id:
                self.logger.error(f"Invalid message format: missing required fields (ppt_id or video_id)")
                return
            
            # Update status to processing in Cosmos DB
            await self._update_status(message_data, StatusEnum.PROCESSING, status_type='status')
            
            # Concatenate videos and get the output URL
            output_url = await self._concatenate_videos(ppt_id, video_id)
            
            # Update status to completed in Cosmos DB
            await self._update_status(message_data, StatusEnum.COMPLETED, status_type='status')
            
            self.logger.info(f"Successfully concatenated videos for PPT ID: {ppt_id}, Output URL: {output_url}")
            
        except Exception as processing_error:
            self.logger.error(f"Error during concatenation: {str(processing_error)}")
            await self._update_status(message_data, StatusEnum.FAILED, status_type='status')
            
            # Re-raise the exception to be handled by the caller
            raise
        
    
    async def _update_status(self, video_message: VideoConcatenationMessage, status: StatusEnum, status_type: str = 'both'):
        """
        Update video concatenation status in Cosmos DB.
        
        Args:
            video_message: The video concatenation message containing IDs
            status: New status to set (PROCESSING, COMPLETED, FAILED)
            status_type: Type of status to update ('transformation_status', 'status', or 'both')
        """
        if status_type in ['transformation_status', 'both']:
            await self.cosmos_db.update_video_status(
                ppt_id=video_message.ppt_id,
                user_id=video_message.user_id,
                video_id=video_message.video_id,
                status_type='transformation_status',
                new_status=status,
            )
        
        if status_type in ['status', 'both']:
            await self.cosmos_db.update_video_status(
                ppt_id=video_message.ppt_id,
                user_id=video_message.user_id,
                video_id=video_message.video_id,
                status_type='status',
                new_status=status,
            )

    async def _concatenate_videos(self, ppt_id: str, video_id: str) -> str:
        """
        Find videos in blob storage, download them, concatenate using ffmpeg, and upload the result.
        
        This method:
        1. Lists all numbered video files from blob storage
        2. Downloads them to a temporary directory
        3. Creates an FFmpeg concat file list
        4. Runs FFmpeg to concatenate videos
        5. Uploads the final video back to blob storage
        6. Cleans up temporary files
        
        Args:
            ppt_id: PowerPoint presentation ID
            video_id: Video ID
            
        Returns:
            URL to the concatenated video in blob storage
            
        Raises:
            ValueError: If no video files are found
            RuntimeError: If FFmpeg processing fails
            Exception: For any other processing errors
        """
        temp_dir = None
        try:
            # Create temporary directory for video concatenation processing
            temp_dir = tempfile.mkdtemp()
            self.logger.info(f"Created temporary directory for concatenation: {temp_dir}")
            
            # Get list of video files from blob storage for concatenation
            video_files = await self._get_video_files_list(ppt_id, video_id)
            
            if not video_files:
                raise ValueError(f"No video files found for concatenation - PPT ID: {ppt_id}, Video ID: {video_id}")
            
            self.logger.info(f"Found {len(video_files)} video files to concatenate")
            
            # Download all video files for concatenation
            downloaded_files = await self._download_video_files(video_files, temp_dir)
            
            # Create ffmpeg concat file list for video concatenation
            concat_file_path = os.path.join(temp_dir, "concat_list.txt")
            await self._create_concat_file(downloaded_files, concat_file_path)
            
            # Concatenate videos using ffmpeg
            output_file_path = os.path.join(temp_dir, "final.mp4")
            await self._run_ffmpeg_concat(concat_file_path, output_file_path)
            
            # Upload the concatenated video back to blob storage
            final_blob_name = f"{ppt_id}/videos/{video_id}/final.mp4"
            output_url = await self._upload_concatenated_video(output_file_path, final_blob_name)
            
            self.logger.info(f"Successfully completed video concatenation and upload: {output_url}")
            return output_url
            
        except Exception as e:
            self.logger.error(f"Error in video concatenation process: {str(e)}")
            raise
        finally:
            # Cleanup temporary directory used for concatenation
            if temp_dir and os.path.exists(temp_dir):
                await self._cleanup_temp_directory(temp_dir)

    async def _get_video_files_list(self, ppt_id: str, video_id: str) -> List[str]:
        """
        Get list of video files from blob storage in numerical order for concatenation.
        
        Searches for video files with pattern {ppt_id}/videos/{video_id}/{number}.mp4
        and returns them sorted by number (0.mp4, 1.mp4, 2.mp4, etc.).
        Excludes final.mp4 to avoid including previously concatenated results.
        
        Args:
            ppt_id: PowerPoint presentation ID
            video_id: Video ID
            
        Returns:
            List of blob names sorted in numerical order for concatenation
            
        Raises:
            Exception: If blob storage listing fails
        """
        try:
            client = await self.blob_storage._get_client()
            container_client = client.get_container_client(self.settings.blob_container_name)
            
            # List all blobs with the specified prefix for concatenation
            prefix = f"{ppt_id}/videos/{video_id}/"
            video_files = []
            
            async for blob in container_client.list_blobs(name_starts_with=prefix):
                blob_name = blob.name
                # Only include numbered mp4 files for concatenation (0.mp4, 1.mp4, etc.), exclude final.mp4
                filename = os.path.basename(blob_name)
                if filename.endswith('.mp4') and filename != 'final.mp4':
                    try:
                        # Extract the number from filename for concatenation order (e.g., "0.mp4" -> 0)
                        file_number = int(filename.split('.')[0])
                        video_files.append((file_number, blob_name))
                    except ValueError:
                        # Skip files that don't match the expected naming pattern for concatenation
                        self.logger.warning(f"Skipping file with unexpected name pattern for concatenation: {filename}")
                        continue
            
            # Sort by file number to ensure correct concatenation order
            video_files.sort(key=lambda x: x[0])
            
            # Return just the blob names in concatenation order
            return [blob_name for _, blob_name in video_files]
            
        except Exception as e:
            self.logger.error(f"Error listing video files for concatenation: {str(e)}")
            raise

    async def _download_video_files(self, video_files: List[str], temp_dir: str) -> List[str]:
        """
        Download all video files from blob storage to temporary directory for concatenation.
        
        Downloads each video file and saves it with a sequential name to ensure
        proper ordering for FFmpeg concatenation.
        
        Args:
            video_files: List of blob names to download for concatenation
            temp_dir: Temporary directory path for storing downloaded concatenation files
            
        Returns:
            List of local file paths for downloaded videos ready for concatenation
            
        Raises:
            Exception: If any download fails during concatenation preparation
        """
        downloaded_files = []
        
        for i, blob_name in enumerate(video_files):
            try:
                # Download file data from blob storage for concatenation
                file_data = await self.blob_storage.download_file(
                    self.settings.blob_container_name, 
                    blob_name
                )
                
                # Save to temporary file with sequential naming for concatenation
                temp_file_path = os.path.join(temp_dir, f"video_{i:03d}.mp4")
                async with aiofiles.open(temp_file_path, 'wb') as f:
                    await f.write(file_data)
                
                downloaded_files.append(temp_file_path)
                self.logger.info(f"Downloaded video file for concatenation: {blob_name} -> {temp_file_path}")
                
            except Exception as e:
                self.logger.error(f"Error downloading video file for concatenation {blob_name}: {str(e)}")
                raise
        
        return downloaded_files

    async def _create_concat_file(self, video_files: List[str], concat_file_path: str):
        """
        Create FFmpeg concat file list for video concatenation.
        
        Creates a text file listing all video files in the format required by
        FFmpeg's concat demuxer for video concatenation: "file 'path/to/video.mp4'"
        
        Args:
            video_files: List of local video file paths for concatenation
            concat_file_path: Path where to save the concatenation file list
            
        Raises:
            Exception: If concatenation file creation fails
        """
        try:
            async with aiofiles.open(concat_file_path, 'w') as f:
                for video_file in video_files:
                    # Escape single quotes in file paths for ffmpeg concatenation
                    escaped_path = video_file.replace("'", "'\\''")
                    await f.write(f"file '{escaped_path}'\n")
            
            self.logger.info(f"Created concatenation file: {concat_file_path} with {len(video_files)} entries")
            
        except Exception as e:
            self.logger.error(f"Error creating concatenation file: {str(e)}")
            raise

    async def _run_ffmpeg_concat(self, concat_file_path: str, output_file_path: str):
        """
        Run FFmpeg to concatenate videos using the concat demuxer.
        
        Uses FFmpeg's concat demuxer with stream copying (no re-encoding) for
        fast video concatenation while preserving video quality.
        
        Args:
            concat_file_path: Path to the concatenation file list
            output_file_path: Path for the output concatenated video
            
        Raises:
            RuntimeError: If FFmpeg concatenation execution fails or output file is not created
        """
        try:
            # FFmpeg command to concatenate videos using concat demuxer
            cmd = [
                'ffmpeg',
                '-f', 'concat',           # Use concat demuxer for video concatenation
                '-safe', '0',             # Allow unsafe file paths in concatenation
                '-i', concat_file_path,   # Input concatenation file
                '-c', 'copy',             # Copy streams without re-encoding for speed
                '-y',                     # Overwrite output file if it exists
                output_file_path          # Output concatenated file path
            ]
            
            self.logger.info(f"Running ffmpeg concatenation command: {' '.join(cmd)}")
            
            # Run ffmpeg concatenation process asynchronously
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await process.communicate()
            
            if process.returncode != 0:
                error_msg = stderr.decode() if stderr else "Unknown ffmpeg concatenation error"
                raise RuntimeError(f"FFmpeg concatenation failed with return code {process.returncode}: {error_msg}")
            
            self.logger.info("FFmpeg video concatenation completed successfully")
            
            # Verify concatenated output file exists and has content
            if not os.path.exists(output_file_path):
                raise RuntimeError(f"Concatenated output file was not created: {output_file_path}")
            
            file_size = os.path.getsize(output_file_path)
            if file_size == 0:
                raise RuntimeError(f"Concatenated output file is empty: {output_file_path}")
                
            self.logger.info(f"Generated concatenated video: {output_file_path} ({file_size} bytes)")
                
        except Exception as e:
            self.logger.error(f"Error running ffmpeg concatenation: {str(e)}")
            raise

    async def _upload_concatenated_video(self, local_file_path: str, blob_name: str) -> str:
        """
        Upload the concatenated video back to blob storage.
        
        Reads the local concatenated video file and uploads it to the specified
        blob location in Azure Blob Storage.
        
        Args:
            local_file_path: Local path to the concatenated video file
            blob_name: Target blob name in storage (e.g., "ppt123/videos/user456/final.mp4")
            
        Returns:
            URL of the uploaded concatenated video blob in storage
            
        Raises:
            Exception: If concatenated file reading or upload fails
        """
        try:
            # Read the concatenated video file
            async with aiofiles.open(local_file_path, 'rb') as f:
                file_data = await f.read()
            
            # Upload concatenated video to blob storage
            output_url = await self.blob_storage.upload_file(
                self.settings.blob_container_name,
                blob_name,
                file_data
            )
            
            self.logger.info(f"Uploaded concatenated video: {blob_name} ({len(file_data)} bytes)")
            return output_url
            
        except Exception as e:
            self.logger.error(f"Error uploading concatenated video: {str(e)}")
            raise

    async def _cleanup_temp_directory(self, temp_dir: str):
        """
        Clean up temporary directory and all its contents used for concatenation.
        
        Removes the temporary directory created for video concatenation processing to free up
        disk space. Logs errors but doesn't raise exceptions as this is cleanup.
        
        Args:
            temp_dir: Path to the temporary concatenation directory to remove
        """
        try:
            shutil.rmtree(temp_dir)
            self.logger.info(f"Cleaned up temporary concatenation directory: {temp_dir}")
        except Exception as e:
            self.logger.error(f"Error cleaning up temporary concatenation directory {temp_dir}: {str(e)}")
            # Don't raise here as this is cleanup - just log the error

    async def cleanup(self):
        """
        Cleanup video concatenation specific resources.
        
        Closes connections to Azure services (Cosmos DB and Azure credentials)
        when the video concatenation service is shutting down.
        """
        try:
            if hasattr(self, 'cosmos_db'):
                await self.cosmos_db.close()
            if hasattr(self, 'blob_storage'):
                await self.blob_storage.close()
            if hasattr(self, 'credential'):
                await self.credential.close()
        except Exception as e:
            self.logger.error(f"Error during video concatenation cleanup: {str(e)}")