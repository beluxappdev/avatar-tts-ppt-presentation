import os
import json
import tempfile
import subprocess
import asyncio
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime
import uuid

# Azure libraries
from azure.identity import DefaultAzureCredential, ClientSecretCredential
from azure.storage.blob import BlobServiceClient
from azure.cosmos import CosmosClient
from azure.servicebus.aio import ServiceBusClient
from azure.servicebus import ServiceBusMessage

# Set up logger
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class VideoConcatenator:
    """
    Service that receives concatenation requests from a Service Bus queue,
    downloads videos from blob storage, and concatenates them using ffmpeg.
    """
    
    def __init__(self):
        """
        Initialize the VideoConcatenator with Azure credentials and settings
        
        Loads all configuration from environment variables.
        """

        # Load configuration from environment variables
        environment = os.environ.get("ENVIRONMENT", "development")
    
        # Initialize Azure credentials based on environment
        if environment.lower() == "azure":
            # Use Managed Identity with DefaultAzureCredential when in Azure
            managed_identity_client_id = os.environ.get("AzureServices__ManagedIdentity__ClientId")
            self.credential = DefaultAzureCredential(managed_identity_client_id=managed_identity_client_id)
        else:
            # For non-Azure environments, use ClientSecretCredential
            self.tenant_id = os.environ["AzureAd__TenantId"]
            self.client_id = os.environ["AzureAd__ClientId"]
            self.client_secret = os.environ["AzureAd__ClientSecret"]
            self.credential = ClientSecretCredential(
                tenant_id=self.tenant_id,
                client_id=self.client_id,
                client_secret=self.client_secret
            )

        self.blob_endpoint = os.environ["AzureServices__BlobStorage__Endpoint"]
        self.blob_container_name = os.environ["AzureServices__BlobStorage__Container"]
        
        self.cosmos_endpoint = os.environ["AzureServices__CosmosDb__Endpoint"]
        self.cosmos_db_name = os.environ["AzureServices__CosmosDb__Database"]
        self.cosmos_container_name = os.environ["AzureServices__CosmosDb__Container"]
        
        self.servicebus_namespace = os.environ["AzureServices__ServiceBus__Namespace"]
        self.servicebus_queue_name = os.environ["AzureServices__ServiceBus__Queue__VideoConcatenator"]
        self.servicebus_connection_string = os.environ.get("AzureServices__ServiceBus__ConnectionString")
        
        # Initialize Azure clients
        self._init_blob_client()
        self._init_cosmos_client()
        self._init_servicebus_client()
        
        # Create a temporary directory for video processing
        self.temp_dir = tempfile.TemporaryDirectory()
        
        logger.info("VideoConcatenator initialized")
    
    def _init_blob_client(self):
        """Initialize Azure Blob Storage client"""
        self.blob_service_client = BlobServiceClient(
            account_url=self.blob_endpoint,
            credential=self.credential
        )
        self.blob_container_client = self.blob_service_client.get_container_client(self.blob_container_name)
        logger.info(f"Initialized Blob Storage client for container: {self.blob_container_name}")
    
    def _init_cosmos_client(self):
        """Initialize Azure Cosmos DB client"""
        self.cosmos_client = CosmosClient(
            url=self.cosmos_endpoint,
            credential=self.credential
        )
        self.cosmos_database = self.cosmos_client.get_database_client(self.cosmos_db_name)
        self.cosmos_container = self.cosmos_database.get_container_client(self.cosmos_container_name)
        logger.info(f"Initialized Cosmos DB client for database: {self.cosmos_db_name}, container: {self.cosmos_container_name}")
    
    def _init_servicebus_client(self):
        """Initialize Azure Service Bus client with connection string or credential"""
        # Try connection string first (preferred for Service Bus)
        if self.servicebus_connection_string:
            self.servicebus_client = ServiceBusClient.from_connection_string(
                self.servicebus_connection_string
            )
            logger.info(f"Initialized Service Bus client with connection string")
        else:
            # Fallback to credential-based auth with proper FQDN
            servicebus_fqdn = f"{self.servicebus_namespace}.servicebus.windows.net"
            self.servicebus_client = ServiceBusClient(
                fully_qualified_namespace=servicebus_fqdn,
                credential=self.credential
            )
            logger.info(f"Initialized Service Bus client with credential for namespace: {self.servicebus_namespace}")
    
    async def start_processing(self):
        """
        Start processing messages from the Service Bus queue
        """
        logger.info("Starting video concatenation service...")
        
        try:
            async with self.servicebus_client:
                async with self.servicebus_client.get_queue_receiver(
                    self.servicebus_queue_name,
                    max_lock_renewal_duration=600  # 10 minutes
                ) as receiver:
                    logger.info(f"Listening for messages on '{self.servicebus_queue_name}' queue...")
                    
                    async for message in receiver:
                        lock_renewal_task = None
                        try:
                            # Start lock renewal task before processing
                            lock_renewal_task = asyncio.create_task(
                                self._renew_message_lock_periodically(receiver, message)
                            )
                            
                            # Process the message
                            await self._process_message(receiver, message)
                            
                            # Cancel lock renewal before completing
                            if lock_renewal_task:
                                lock_renewal_task.cancel()
                            
                            # Complete the message to remove it from the queue
                            await receiver.complete_message(message)
                            logger.info("Message processed and completed successfully")
                            
                        except Exception as e:
                            # Cancel lock renewal task if it exists
                            if lock_renewal_task:
                                lock_renewal_task.cancel()
                            
                            logger.error(f"Error processing message: {str(e)}")
                            
                            # Try to dead letter the message
                            try:
                                await receiver.dead_letter_message(message, reason="ProcessingError")
                            except Exception as dead_letter_error:
                                logger.error(f"Failed to dead letter message: {str(dead_letter_error)}")
                                
        except KeyboardInterrupt:
            logger.info("Shutting down gracefully...")
        except Exception as e:
            logger.error(f"Unexpected error in main loop: {str(e)}")
            raise
    
    async def _process_message(self, receiver, message):
        """
        Process a single message from the Service Bus queue
        
        Args:
            receiver: Service Bus receiver to complete/abandon the message
            message: Service Bus message to process
        """
        try:
            # Parse the message body
            message_data = json.loads(str(message))
            
            logger.info(f"Processing concatenation request for PPT ID: {message_data.get('PptId')}")
            
            # Extract necessary information from the message
            ppt_id = message_data.get('PptId')
            user_id = message_data.get('UserId')
            
            if not ppt_id or not user_id:
                logger.error(f"Invalid message format: missing required fields (ppt_id or user_id)")
                return
            
            # Update status to processing in Cosmos DB
            await self._update_cosmos_status(ppt_id, user_id, 'Concatenating')
            
            # Concatenate videos
            output_url = await self._concatenate_videos(ppt_id, user_id)
            
            # Update status to completed in Cosmos DB
            await self._update_cosmos_status(ppt_id, user_id, 'Completed', output_url)
            
            logger.info(f"Successfully concatenated videos for PPT ID: {ppt_id}")
            
        except Exception as processing_error:
            logger.error(f"Error during concatenation: {str(processing_error)}")
            
            if ppt_id and user_id:
                # Update status to error in Cosmos DB
                await self._update_cosmos_status(ppt_id, user_id, 'error', error_details=str(processing_error))
            
            # Re-raise the exception to be handled by the caller
            raise
    
    async def _renew_message_lock_periodically(self, receiver, message):
        """
        Periodically renew message lock during long processing
        
        Args:
            receiver: Service Bus receiver to renew the lock
            message: Service Bus message to renew the lock for
        """
        try:
            while True:
                await asyncio.sleep(30)  # Renew every 30 seconds
                try:
                    await receiver.renew_message_lock(message)
                    logger.info(f"Message lock renewed successfully")
                except Exception as e:
                    logger.warning(f"Failed to renew message lock: {e}")
                    # Don't break the loop, just log and continue trying
        except asyncio.CancelledError:
            logger.info("Lock renewal task cancelled")
            pass  # Just exit when cancelled
    
    async def _concatenate_videos(self, ppt_id: str, user_id: str) -> str:
        """
        Find videos in blob storage, download them, concatenate using ffmpeg, and upload the result
        
        Args:
            ppt_id: PowerPoint presentation ID
            user_id: User ID
            
        Returns:
            URL to the concatenated video in blob storage
        """
        # Create a unique temp directory for this task
        task_dir = os.path.join(self.temp_dir.name, f"{ppt_id}_{uuid.uuid4().hex}")
        os.makedirs(task_dir, exist_ok=True)
        
        try:
            # List all blobs in the directory
            prefix = f"{ppt_id}/videos/"
            blobs = list(self.blob_container_client.list_blobs(name_starts_with=prefix))
            
            if not blobs:
                raise Exception(f"No video files found in {prefix}")
            
            logger.info(f"Found {len(blobs)} video files in {prefix}")
            
            # Create a mapping of slide number to blob
            slide_blobs = {}
            for blob in blobs:
                # Extract slide number from the filename (e.g., "0.mp4", "1.mp4", etc.)
                try:
                    filename = os.path.basename(blob.name)
                    slide_number = int(filename.split('.')[0])
                    slide_blobs[slide_number] = blob
                except (ValueError, IndexError):
                    logger.warning(f"Skipping file with unexpected name format: {blob.name}")
            
            if not slide_blobs:
                raise Exception(f"No properly named video files found in {prefix}")
            
            # Sort by slide number
            sorted_slide_numbers = sorted(slide_blobs.keys())
            
            # Create a file list for ffmpeg
            file_list_path = os.path.join(task_dir, "file_list.txt")
            downloaded_files = []
            
            # Download all videos in order
            for slide_number in sorted_slide_numbers:
                blob = slide_blobs[slide_number]
                file_name = f"slide_{slide_number}.mp4"
                file_path = os.path.join(task_dir, file_name)
                
                # Download blob
                blob_client = self.blob_container_client.get_blob_client(blob.name)
                with open(file_path, "wb") as file:
                    download_stream = blob_client.download_blob()
                    file.write(download_stream.readall())
                
                downloaded_files.append(file_path)
                
                # Add file to the list for ffmpeg
                with open(file_list_path, "a") as list_file:
                    list_file.write(f"file '{file_path}'\n")
                
                logger.info(f"Downloaded slide {slide_number} to {file_path}")
            
            # Output file path
            output_path = os.path.join(task_dir, f"{ppt_id}_concatenated.mp4")
            
            # Concatenate videos using ffmpeg
            ffmpeg_cmd = [
                "ffmpeg",
                "-f", "concat",
                "-safe", "0",
                "-i", file_list_path,
                "-c", "copy",  # Copy codec without re-encoding for speed
                output_path
            ]
            
            # Run ffmpeg command
            process = await asyncio.create_subprocess_exec(
                *ffmpeg_cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await process.communicate()
            
            if process.returncode != 0:
                error_msg = stderr.decode() if stderr else "Unknown ffmpeg error"
                raise Exception(f"ffmpeg failed: {error_msg}")
            
            # Upload the concatenated video to blob storage
            output_blob_name = f"{ppt_id}/completed_videos/video.mp4"
            blob_client = self.blob_container_client.get_blob_client(output_blob_name)
            
            with open(output_path, "rb") as data:
                blob_client.upload_blob(data, overwrite=True)
            
            # Generate the URL to the uploaded blob
            output_url = f"{self.blob_endpoint}/{self.blob_container_name}/{output_blob_name}"
            
            return output_url
            
        finally:
            # Clean up temporary files
            try:
                import shutil
                shutil.rmtree(task_dir)
            except Exception as cleanup_error:
                logger.warning(f"Error cleaning up temporary files: {str(cleanup_error)}")
    
    async def _update_cosmos_status(
        self, 
        ppt_id: str, 
        user_id: str, 
        status: str, 
        output_url: str = None, 
        error_details: str = None
    ) -> bool:
        """
        Update the concatenation status in Cosmos DB
        
        Args:
            ppt_id: PowerPoint presentation ID
            user_id: User ID for partition key
            status: New status ('concatenating', 'completed', 'error')
            output_url: URL of concatenated video (only for 'completed' status)
            error_details: Error details (only for 'error' status)
            
        Returns:
            True if update was successful, False otherwise
        """
        max_retries = 3
        retry_count = 0
        
        while retry_count < max_retries:
            try:
                # Read the current document to get its ETag
                item = self.cosmos_container.read_item(item=ppt_id, partition_key=user_id)
                etag = item['_etag']
                
                # Update status and timestamps
                item['videoProcessingStatus'] = status
                
                if status == 'Concatenating':
                    item['videoConcatenationStartedAt'] = datetime.utcnow().isoformat()
                elif status == 'Completed':
                    item['videoConcatenationCompletedAt'] = datetime.utcnow().isoformat()
                    if output_url:
                        item['concatenatedVideoUrl'] = output_url
                elif status == 'error':
                    item['videoConcatenationErrorAt'] = datetime.utcnow().isoformat()
                    if error_details:
                        item['videoConcatenationError'] = error_details
                
                # Update the document with optimistic concurrency control
                self.cosmos_container.replace_item(
                    item=item['id'],
                    body=item,
                    request_options={"if_match": etag}
                )
                
                logger.info(f"Updated concatenation status to '{status}' for PPT {ppt_id}")
                return True
                
            except Exception as e:
                if "access condition" in str(e).lower() or "412" in str(e):
                    # Concurrency conflict - another process updated the document
                    retry_count += 1
                    logger.warning(f"Concurrency conflict on attempt {retry_count}, retrying...")
                    continue  # Retry the operation
                else:
                    logger.error(f"Error updating concatenation status: {str(e)}")
                    return False
        
        logger.error(f"Failed to update concatenation status after {max_retries} retries due to concurrency conflicts")
        return False
    
    def __del__(self):
        """Cleanup resources on deletion"""
        try:
            self.temp_dir.cleanup()
        except:
            pass


# Example usage:
async def main():
    """Example of how to run the VideoConcatenator service"""
    # Initialize the concatenator (all config comes from environment variables)
    concatenator = VideoConcatenator()
    
    # Start processing messages
    await concatenator.start_processing()

if __name__ == "__main__":
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # Run the main function
    asyncio.run(main())