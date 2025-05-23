import json
import logging
import os
import sys
import time
import uuid
import asyncio
import tempfile
import aiohttp
import aiofiles
from datetime import datetime
from typing import Dict, Any
import requests
from azure.identity import DefaultAzureCredential, ClientSecretCredential
from azure.servicebus.aio import ServiceBusClient
from azure.servicebus import ServiceBusMessage
from azure.storage.blob import BlobServiceClient
from azure.cosmos import CosmosClient
from video_transformer import VideoTransformer 


# Configure logging
logging.basicConfig(
    stream=sys.stdout, 
    level=logging.INFO,
    format="[%(asctime)s] %(message)s", 
    datefmt="%m/%d/%Y %I:%M:%S %p %Z"
)
logger = logging.getLogger(__name__)


class AvatarVideoGenerator:
    def __init__(self):
        """Initialize the base extractor with common functionality
        
        """

        self.passwordless_authentication = True
        self.api_version = "2024-04-15-preview"
        
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

        self.cosmos_endpoint = os.environ["AzureServices__CosmosDb__Endpoint"]
        self.cosmos_db_name = os.environ["AzureServices__CosmosDb__Database"]
        self.cosmos_container_name = os.environ["AzureServices__CosmosDb__Container"]
        
        self.blob_endpoint = os.environ["AzureServices__BlobStorage__Endpoint"]
        self.blob_container_name = os.environ["AzureServices__BlobStorage__Container"]
        
        self.servicebus_namespace = os.environ["AzureServices__ServiceBus__Namespace"]
        self.servicebus_generator_queue = os.environ["AzureServices__ServiceBus__Queue__VideoGenerator"]
        self.servicebus_concatenator_queue = os.environ["AzureServices__ServiceBus__Queue__VideoConcatenator"]
        
        # Add connection string for Service Bus (preferred method)
        self.servicebus_connection_string = os.environ.get("AzureServices__ServiceBus__ConnectionString")

        self.speech_endpoint = os.environ["AzureServices__Speech__Endpoint"]
        
        # Avatar mapping (you'll need to define this)
        self.avatar_mapping = {
            "default": {
                "name": "lisa",
                "style": "graceful-sitting",
                "voice": "en-US-JennyNeural"
            },
            "lisa": {
                "name": "lisa",
                "style": "graceful-sitting",
                "voice": "en-US-JennyNeural"
            },
            "meg": {
                "name": "Meg",
                "style": "business",
                "voice": "en-US-JennyNeural"
            },
            "harry": {
                "name": "harry",
                "style": "business",
                "voice": "en-US-BrandonMultilingualNeural"
            },

            # Add more mappings as needed
        }
        
        # Initialize Azure clients
        self._init_blob_client()
        self._init_cosmos_client()
        self._init_servicebus_client()
        
        # Storage for tracking extraction results
        self.extraction_results = None
    
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
    
    def _authenticate(self) -> Dict[str, str]:
        """Get authentication headers for Azure Speech API"""
        if self.passwordless_authentication:
            token = self.credential.get_token('https://cognitiveservices.azure.com/.default')
            return {'Authorization': f'Bearer {token.token}'}
        else:
            subscription_key = os.environ.get('SPEECH_KEY')
            return {'Ocp-Apim-Subscription-Key': subscription_key}
    
    def _map_avatar_config(self, avatar_config: Dict[str, Any]) -> Dict[str, Any]:
        """Map custom avatar config to Azure format"""
        logger.info(f"Mapping avatar config: {avatar_config}")
        logger.info(f"Avatar config keys: {avatar_config.keys()}")
        logger.info(f"Avatar config values: {avatar_config.values()}")
        logger.info(f"Avatar mapping: {self.avatar_mapping}")
        avatar_config = self.avatar_mapping[(avatar_config.get('AvatarType', 'default').lower())]
        logger.info(f"Mapped avatar config: {avatar_config}")
        
        # Map avatar position to style (you may need to adjust this based on available styles)
        # avatar_position = avatar_config.get('AvatarPosition', 'right').lower()
        # style_mapping = {
        #     'left': 'graceful-sitting',
        #     'right': 'graceful-sitting',
        #     'center': 'graceful-sitting'
        # }
        # avatar_style = style_mapping.get(avatar_position, 'graceful-sitting')
        
        return avatar_config    

    async def submit_synthesis(self, job_id: str, script: str, avatar_config: Dict[str, Any]) -> bool:
        """Submit avatar synthesis job to Azure"""
        url = f'{self.speech_endpoint}/avatar/batchsyntheses/{job_id}?api-version={self.api_version}'
        header = {
            'Content-Type': 'application/json'
        }
        header.update(self._authenticate())
        
        avatar = self._map_avatar_config(avatar_config)
        logger.info(f"Avatar config for job {job_id}: {avatar}")

        payload = {
            'synthesisConfig': {
                "voice": avatar["voice"],
            },
            # Replace with your custom voice name and deployment ID if you want to use custom voice.
            # Multiple voices are supported, the mixture of custom voices and platform voices is allowed.
            # Invalid voice name or deployment ID will be rejected.
            'customVoices': {
                # "YOUR_CUSTOM_VOICE_NAME": "YOUR_CUSTOM_VOICE_ID"
            },
            "inputKind": "PlainText",  # PlainText or SSML
            "inputs": [
                {
                    "content": script,
                },
            ],
            "avatarConfig": {
                "customized": False, # set to True if you want to use customized avatar
                "talkingAvatarCharacter": avatar["name"],  # talking avatar character
                "talkingAvatarStyle": avatar["style"],  # talking avatar style, required for prebuilt avatar, optional for custom avatar
                "videoFormat": "webm",  # mp4 or webm, webm is required for transparent background
                "videoCodec": "vp9",  # hevc, h264 or vp9, vp9 is required for transparent background; default is hevc
                "subtitleType": "none",
                "backgroundColor": "#00000000"  , # background color in RGBA format, default is white; can be set to 'transparent' for transparent background
                # "backgroundImage": "https://samples-files.com/samples/Images/jpg/1920-1080-sample.jpg", # background image URL, only support https, either backgroundImage or backgroundColor can be set
            }
        }

        logger.info(f"Payload for job {job_id}: {json.dumps(payload, indent=2)}")
        
        try:
            # Use asyncio for non-blocking HTTP request
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None, 
                lambda: requests.put(url, json.dumps(payload), headers=header)
            )
            
            if response.status_code < 400:
                logger.info(f'Avatar synthesis job submitted successfully for job {job_id}')
                return True
            else:
                logger.error(f'Failed to submit synthesis job {job_id}: [{response.status_code}], {response.text}')
                return False
        except Exception as e:
            logger.error(f'Error submitting synthesis job {job_id}: {str(e)}')
            return False
    
    async def get_synthesis_status(self, job_id: str) -> tuple[str, str]:
        """Get synthesis job status and download URL if ready"""
        url = f'{self.speech_endpoint}/avatar/batchsyntheses/{job_id}?api-version={self.api_version}'
        header = self._authenticate()
        
        try:
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                lambda: requests.get(url, headers=header)
            )
            
            if response.status_code < 400:
                data = response.json()
                status = data['status']
                download_url = data.get('outputs', {}).get('result') if status == 'Succeeded' else None
                return status, download_url
            else:
                logger.error(f'Failed to get synthesis status for {job_id}: {response.text}')
                return 'Error', None
        except Exception as e:
            logger.error(f'Error getting synthesis status for {job_id}: {str(e)}')
            return 'Error', None
    
    async def wait_for_completion(self, job_id: str, max_wait_time: int = 300) -> tuple[str, str]:
        """Wait for synthesis job to complete with timeout"""
        start_time = time.time()
        
        while time.time() - start_time < max_wait_time:
            status, download_url = await self.get_synthesis_status(job_id)
            
            if status == 'Succeeded':
                logger.info(f'Synthesis job {job_id} completed successfully')
                return status, download_url
            elif status == 'Failed':
                logger.error(f'Synthesis job {job_id} failed')
                return status, None
            elif status == 'Error':
                return status, None
            else:
                logger.info(f'Synthesis job {job_id} status: {status}')
                await asyncio.sleep(10)  # Wait 10 seconds before checking again
        
        logger.error(f'Synthesis job {job_id} timed out after {max_wait_time} seconds')
        return 'Timeout', None
    
    async def process_message(self, message_body: str) -> None:
        """Process a single message from the service bus queue"""
        try:
            # Parse the message
            message_data = json.loads(message_body)
            logger.info(f"Processing message for JobId: {message_data['JobId']}")
            
            # Extract required fields
            ppt_id = message_data['PptId']
            user_id = message_data['UserId']
            slide_number = message_data['SlideNumber']
            job_id = message_data['JobId']
            script = message_data['Script']
            avatar_config = message_data['AvatarConfig']

            result = await self.update_slide_status(ppt_id, user_id, slide_number, 'processing')

            if not result['success']:
                logger.error(f"Failed to update slide status to 'processing' for PPT {ppt_id}, slide {slide_number}")
                return
            
            # Only process if avatar should be shown
            if not avatar_config.get('ShowAvatar', True):
                logger.info(f"Skipping job {job_id} - ShowAvatar is False")
                return
            
            # Submit synthesis job
            azure_job_id = str(uuid.uuid4())
            success = await self.submit_synthesis(azure_job_id, script, avatar_config)
            
            if not success:
                logger.error(f"Failed to submit synthesis job for {job_id}")
                return
            
            # Wait for completion
            status, download_url = await self.wait_for_completion(azure_job_id)
            
            if status == 'Succeeded' and download_url:
                logger.info(f"Video generated successfully for job {job_id}: {download_url}")
                # Here you could save the download URL to a database, 
                # send a notification, or download the file
                await self.handle_completed_video(job_id, download_url, message_data, avatar_config)
            else:
                logger.error(f"Failed to generate video for job {job_id}, status: {status}")
                
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse message JSON: {str(e)}")
        except KeyError as e:
            logger.error(f"Missing required field in message: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error processing message: {str(e)}")
    

    async def handle_completed_video(self, job_id: str, download_url: str, message_data: Dict[str, Any], avatar_config: Dict[str, Any]) -> None:
        """Handle completed video - download, transform, and upload to blob storage"""
    
        logger.info(f"Processing completed video for job {job_id}")
    
        ppt_id = message_data.get('PptId')
        user_id = message_data.get('UserId')
        slide_number = message_data.get('SlideNumber')
    
        if not ppt_id or slide_number is None:
            logger.error(f"Missing PptId or SlideNumber in message data for job {job_id}")
            return
    
        with tempfile.TemporaryDirectory() as temp_dir:
            try:
                # Download the avatar video
                avatar_video_path = await self._download_file(download_url, temp_dir, f"avatar_{job_id}.webm")
            
                # Download background image from blob storage
                background_blob_path = f"{ppt_id}/slides/{slide_number}/image.png"
                background_path = await self._download_from_blob(background_blob_path, temp_dir, f"background_{slide_number}.png")
            
                # Transform the video (run in executor since it's synchronous)
                output_path = os.path.join(temp_dir, f"output_{slide_number}.mp4")
                transformer = VideoTransformer()
            
                loop = asyncio.get_event_loop()
                await loop.run_in_executor(
                    None,
                    lambda: transformer.transform_video(
                        avatar_path=avatar_video_path,
                        background_path=background_path,
                        output_path=output_path,
                        position=(avatar_config.get("AvatarPosition", "right"), "bottom"),
                        size=avatar_config.get("AvatarSize"),
                        crop_aspect_ratio=9/16
                    )
                )
            
                # Upload the transformed video to blob storage
                video_blob_path = f"{ppt_id}/videos/{slide_number}.mp4"
                await self._upload_to_blob(output_path, video_blob_path)

                # Create the full video URL
                video_url = f"{self.blob_endpoint}/{self.blob_container_name}/{video_blob_path}"
            
                # Update the status in Cosmos DB with concurrency control
                result = await self.update_slide_status(
                    ppt_id, user_id, slide_number, 'completed', video_url
                )

                if not result['success']:
                    logger.error(f"Failed to update slide status to 'completed' for PPT {ppt_id}, slide {slide_number}")
                    return
            
                logger.info(f"Successfully processed video for job {job_id}, uploaded to {video_blob_path}, for PPT {ppt_id}, slide {slide_number}")
            
            except Exception as e:
                logger.error(f"Error processing video for job {job_id}: {str(e)}")

    async def _download_file(self, url: str, temp_dir: str, filename: str) -> str:
        """Download a file from URL to temporary directory"""
        file_path = os.path.join(temp_dir, filename)
    
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as response:
                response.raise_for_status()
                async with aiofiles.open(file_path, 'wb') as f:
                    async for chunk in response.content.iter_chunked(8192):
                        await f.write(chunk)
    
        logger.info(f"Downloaded file to {file_path}")
        return file_path

    async def _download_from_blob(self, blob_path: str, temp_dir: str, filename: str) -> str:
        """Download a file from blob storage to temporary directory"""
        file_path = os.path.join(temp_dir, filename)
    
        blob_client = self.blob_container_client.get_blob_client(blob_path)
    
        # Run the synchronous blob download in an executor
        loop = asyncio.get_event_loop()
    
        async with aiofiles.open(file_path, 'wb') as f:
            # Download blob data synchronously in executor
            download_stream = await loop.run_in_executor(None, blob_client.download_blob)
        
            # Read data in chunks
            data = await loop.run_in_executor(None, download_stream.readall)
            await f.write(data)
    
        logger.info(f"Downloaded blob {blob_path} to {file_path}")
        return file_path

    async def _upload_to_blob(self, file_path: str, blob_path: str) -> None:
        """Upload a file to blob storage"""
        blob_client = self.blob_container_client.get_blob_client(blob_path)
    
        # Run the synchronous blob upload in an executor
        loop = asyncio.get_event_loop()
    
        async with aiofiles.open(file_path, 'rb') as f:
            data = await f.read()
            await loop.run_in_executor(None, lambda: blob_client.upload_blob(data, overwrite=True))
    
        logger.info(f"Uploaded file {file_path} to blob {blob_path}")

    async def _send_concatenation_message(self, completion_info: Dict[str, Any]) -> None:
        """
        Send message to Service Bus queue for video concatenation
    
        Args:
            completion_info: Dictionary containing all necessary information for video concatenation
        """
        try:
            # Create a message with all the necessary information
            message = {
                'PptId': completion_info['ppt_id'],
                'UserId': completion_info['user_id'],
                'timestamp': datetime.utcnow().isoformat()
            }
        
            # Serialize the message to JSON
            message_json = json.dumps(message)
        
            # Create a Service Bus sender for the 'video-concatenator' queue
            async with self.servicebus_client.get_queue_sender(queue_name=self.servicebus_concatenator_queue) as sender:
                # Create a Service Bus message
                sb_message = ServiceBusMessage(message_json)
            
                # Send the message
                await sender.send_messages(sb_message)
            
            logger.info(f"Sent concatenation request to Service Bus for PPT {completion_info['ppt_id']}")
        except Exception as e:
            logger.error(f"Failed to send concatenation message to Service Bus: {str(e)}")


    async def update_slide_status(self, ppt_id: str, user_id: str, slide_number: int, status: str, video_url: str = None) -> Dict[str, Any]:
        """
        Update slide status with optimistic concurrency control and check if concatenation is needed
    
        Args:
            ppt_id: PowerPoint presentation ID
            user_id: User ID for partition key
            slide_number: Slide number to update
            status: New status ('pending', 'processing', 'completed', 'error')
            video_url: URL of generated video (only for 'completed' status)
        
        Returns:
            Dict with:
                'success': True if update was successful
                'should_concatenate': True if this update made the presentation ready for concatenation
                'completion_info': Dict with completion info if should_concatenate is True
        """
        max_retries = 3
        retry_count = 0
    
        while retry_count < max_retries:
            try:
                # Read the current document to get its ETag
                item = self.cosmos_container.read_item(item=ppt_id, partition_key=user_id)
                etag = item['_etag']
            
                video_status = item.get('videoStatus', [])
                should_concatenate = False
            
                # Find the slide with matching slide number
                slide_status = next((s for s in video_status if s['slideNumber'] == str(slide_number)), None)
            
                if not slide_status:
                    logger.error(f"Slide number {slide_number} not found in video status")
                    return {'success': False, 'should_concatenate': False, 'completion_info': None}
            
                # Update the slide status
                slide_index = video_status.index(slide_status)
            
                # Skip update if already completed (avoid regression)
                if status == 'completed' and slide_status['status'] == 'completed':
                    logger.info(f"Slide {slide_number} already marked as completed, skipping update")
                    return {'success': True, 'should_concatenate': False, 'completion_info': None}
                
                # Update status and timestamps
                video_status[slide_index]['status'] = status
            
                if status == 'processing':
                    video_status[slide_index]['processingAt'] = datetime.utcnow().isoformat()
                elif status == 'completed':
                    video_status[slide_index]['completedAt'] = datetime.utcnow().isoformat()
                    if video_url:
                        video_status[slide_index]['videoUrl'] = video_url
                
                    item['videoCompletedSlides'] = item.get('videoCompletedSlides', 0) + 1
                    
                    # Check if all slides are completed
                    if item['videoCompletedSlides'] == item.get('videoTotalSlides', 0) and item['videoProcessingStatus'] != 'concatenating':
                        item['videoProcessingStatus'] = 'readyForConcatenation'
                        should_concatenate = True

                elif status == 'error':
                    video_status[slide_index]['errorAt'] = datetime.utcnow().isoformat()
            
                # Update the document with optimistic concurrency control
                try:
                    self.cosmos_container.replace_item(
                        item=item['id'],
                        body=item,
                        request_options={"if_match": etag}
                    )
                
                    logger.info(f"Updated slide {slide_number} status to '{status}' for PPT {ppt_id}")
                
                    # If we should concatenate, gather the necessary info
                    completion_info = None

                    if should_concatenate:
                        # Get video URLs in slide order
                        video_status_sorted = sorted(video_status, key=lambda x: int(x['slideNumber']))
                        video_urls = [s.get('videoUrl') for s in video_status_sorted 
                                    if s.get('status') == 'completed' and s.get('videoUrl')]
                
                        completion_info = {
                            'total_slides': item.get('videoTotalSlides', len(video_status)),
                            'completed_slides': item['videoCompletedSlides'],
                            'video_urls': video_urls,
                            'ppt_id': ppt_id,
                            'user_id': user_id
                        }
                    
                        # Send message to Service Bus queue for concatenation
                        await self._send_concatenation_message(completion_info)
                        logger.info(f"Sent concatenation message for PPT {ppt_id} with {len(video_urls)} videos")
                
                    logger.info(f"returrn will return success: {True}, should_concatenate: {should_concatenate}, completion_info: {completion_info}")
                    return {
                        'success': True, 
                        'should_concatenate': should_concatenate,
                        'completion_info': completion_info
                    }
                
                except Exception as e:
                    if "access condition" in str(e).lower() or "412" in str(e):
                        # Concurrency conflict - another process updated the document
                        retry_count += 1
                        logger.warning(f"Concurrency conflict on attempt {retry_count}, retrying...")
                        continue  # Retry the operation
                    else:
                        raise  # Re-raise if it's some other error
        
            except Exception as e:
                logger.error(f"Error updating slide status: {str(e)}")
                return {'success': False, 'should_concatenate': False, 'completion_info': None}
    
        logger.error(f"Failed to update slide status after {max_retries} retries due to concurrency conflicts")
        return {'success': False, 'should_concatenate': False, 'completion_info': None}
    

    async def run(self):
        """Main consumer loop"""
        logger.info("Starting Avatar Video Generator...")
    
        try:
            async with self.servicebus_client:
                async with self.servicebus_client.get_queue_receiver(
                    self.servicebus_generator_queue, 
                    max_lock_renewal_duration=600  # 10 minutes
                ) as receiver:
                    logger.info(f"Listening for messages on queue: {self.servicebus_generator_queue}")
                
                    async for message in receiver:
                        lock_renewal_task = None
                        try:
                            # Start lock renewal task before processing
                            lock_renewal_task = asyncio.create_task(
                                self._renew_message_lock_periodically(receiver, message)
                            )

                            # Process the message
                            await self.process_message(str(message))
                        
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

    async def _renew_message_lock_periodically(self, receiver, message):
        """Periodically renew message lock during long processing"""
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
            pass


async def main():
    generator = AvatarVideoGenerator()
    await generator.run()

if __name__ == '__main__':
    asyncio.run(main())