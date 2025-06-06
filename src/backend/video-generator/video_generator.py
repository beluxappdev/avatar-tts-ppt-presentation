import asyncio
import uuid
import time
import random
from typing import Dict, Any, Optional, Tuple
import aiohttp # type: ignore
from azure.identity.aio import DefaultAzureCredential # type: ignore
from azure.servicebus import ServiceBusReceivedMessage # type: ignore

from common.services.base_service import BaseService
from common.services.cosmos_db import CosmosDBService
from common.models.powerpoint import StatusEnum
from common.models.messages import VideoGenerationMessage, VideoTransformationMessage
from common.models.service_config import ServiceBusConfig
from common.utils.config import Settings


class VideoGeneratorService(BaseService):
    """Service for generating avatar videos from scripts"""
    
    def __init__(self, settings: Settings):
        config = ServiceBusConfig.for_queue(settings.service_bus_video_generation_queue_name)
        super().__init__(settings, "Video Generator Service", config)
        
        # Rate limiting and retry configuration
        self.max_retries = 5
        self.base_delay = 1.0
        self.max_delay = 300.0
        self.jitter_range = 0.1
        
        # Message retry configuration
        self.max_message_retries = 3  # Maximum number of times to retry a failed message
        self.retry_delay_seconds = 10 # 10 seconds delay before retry
        
        # Avatar configuration mapping
        self.avatar_mapping = {
            "default": {
                "name": "lisa",
                "style": "graceful-sitting",
                "voice_english": "en-US-JennyNeural",
                "voice_french": "fr-FR-DeniseNeural",
            },
            "lisa": {
                "name": "lisa",
                "style": "graceful-sitting",
                "voice_english": "en-US-JennyNeural",
                "voice_french": "fr-FR-DeniseNeural"
            },
            "meg": {
                "name": "Meg",
                "style": "business",
                "voice_english": "en-US-JennyNeural",
                "voice_french": "fr-FR-VivienneMultilingualNeural"
            },
            "harry": {
                "name": "harry",
                "style": "business",
                "voice_english": "en-US-BrandonMultilingualNeural",
                "voice_french": "fr-FR-HenriNeural"
            },
            "jeff": {
                "name": "jeff",
                "style": "business",
                "voice_english": "en-US-AndrewMultilingualNeural",
                "voice_french": "fr-FR-LucienMultilingualNeural"
            },
            "max": {
                "name": "max",
                "style": "business",
                "voice_english": "en-US-AlloyTurboMultilingualNeural",
                "voice_french": "fr-FR-RemyMultilingualNeural"
            },
            "lori": {
                "name": "lori",
                "style": "casual",
                "voice_english": "en-US-AvaMultilingualNeural",
                "voice_french": "fr-FR-BrigitteNeural",
            },
        }
    
    async def _initialize(self):
        """Initialize video generator specific resources"""
        self.credential = DefaultAzureCredential()
        self.cosmos_db = CosmosDBService(
            self.settings.cosmos_db_endpoint,
            self.settings.cosmos_db_database_name,
        )
    
    async def handle_message(self, message_data: Dict[str, Any]) -> None:
        """Handle video generation message with retry logic"""
        # Create VideoGenerationMessage object
        video_message = VideoGenerationMessage(**message_data)
        
        # Get retry count from message (default to 0 if not present)
        retry_count = message_data.get('retry_count', 0)
        
        try:
            # Update Cosmos DB status to In Progress
            self.logger.info(f"Processing video generation for PPT {video_message.ppt_id}, slide {video_message.index} (attempt {retry_count + 1})")
            await self._update_status(video_message, StatusEnum.PROCESSING)
            
            # Skip processing if avatar should not be shown
            if not video_message.show_avatar:
                self.logger.info(f"Skipping video generation for PPT {video_message.ppt_id}, slide {video_message.index} - ShowAvatar is False")
                return
            
            # Generate unique job ID for Azure Speech API
            azure_job_id = str(uuid.uuid4())
            
            # Create avatar configuration dictionary
            avatar_config = {
                'avatar_persona': video_message.avatar_persona,
                'avatar_position': video_message.avatar_position,
                'avatar_size': video_message.avatar_size,
                'language': video_message.language
            }
            
            # Submit synthesis job with retry logic
            success = await self.submit_synthesis_job(azure_job_id, video_message.script, avatar_config)
            
            if not success:
                self.logger.error(f"Failed to submit synthesis job for PPT {video_message.ppt_id}, slide {video_message.index}")
                await self._handle_processing_failure(message_data, retry_count, "Failed to submit synthesis job")
                return
            
            # Wait for completion
            status, download_url = await self.wait_for_completion(azure_job_id)
            
            if status == 'Succeeded' and download_url:
                self.logger.info(f"Video generated successfully for PPT {video_message.ppt_id}, slide {video_message.index}: {download_url}")
                await self._update_status(video_message, StatusEnum.COMPLETED, 'generation_status')
                
                # Send message to transformation queue
                await self.send_transformation_message(video_message, download_url)
            else:
                error_msg = f"Video generation failed with status: {status}"
                self.logger.error(f"Failed to generate video for PPT {video_message.ppt_id}, slide {video_message.index}, status: {status}")
                await self._handle_processing_failure(message_data, retry_count, error_msg)
                
        except Exception as e:
            error_msg = f"Unexpected error during video generation: {str(e)}"
            self.logger.error(f"Error processing video generation for PPT {video_message.ppt_id}, slide {video_message.index}: {str(e)}")
            await self._handle_processing_failure(message_data, retry_count, error_msg)
            # Re-raise the exception to trigger message abandonment
            raise
    
    async def _handle_processing_failure(self, original_message_data: Dict[str, Any], retry_count: int, error_msg: str):
        """Handle processing failure with retry logic"""
        video_message = VideoGenerationMessage(**original_message_data)
        
        if retry_count < self.max_message_retries:
            # Schedule retry
            await self._schedule_retry(original_message_data, retry_count + 1, error_msg)
        else:
            # Max retries reached, mark as permanently failed
            self.logger.error(f"Max retries ({self.max_message_retries}) reached for PPT {video_message.ppt_id}, slide {video_message.index}. Marking as permanently failed.")
            await self._update_status(video_message, StatusEnum.FAILED)
    
    async def _schedule_retry(self, original_message_data: Dict[str, Any], retry_count: int, error_msg: str):
        """Schedule a retry by sending the message back to the queue with delay"""
        try:
            video_message = VideoGenerationMessage(**original_message_data)
            
            # Create retry message with updated retry count and timestamp
            retry_message_data = original_message_data.copy()
            retry_message_data['retry_count'] = retry_count
            retry_message_data['last_error'] = error_msg
            retry_message_data['retry_scheduled_at'] = time.time()
            retry_message_data['id'] = str(uuid.uuid4())  # New message ID
            
            # Calculate delay (you can implement more sophisticated backoff here)
            delay_seconds = self.retry_delay_seconds * retry_count  # Linear backoff
            
            self.logger.info(f"Scheduling retry {retry_count} for PPT {video_message.ppt_id}, slide {video_message.index} in {delay_seconds} seconds")
            
            # Option 1: Use Azure Service Bus scheduled messages (preferred)
            if hasattr(self.service_bus, 'schedule_message'):
                scheduled_time = time.time() + delay_seconds
                await self.service_bus.schedule_message(
                    destination_type="queue",
                    destination_name=self.settings.service_bus_video_generation_queue_name,
                    message_data=retry_message_data,
                    scheduled_enqueue_time=scheduled_time
                )
            else:
                # Option 2: Use asyncio delay (simpler but less reliable)
                asyncio.create_task(self._delayed_retry(retry_message_data, delay_seconds))
                
        except Exception as e:
            self.logger.error(f"Failed to schedule retry: {str(e)}")
            # If retry scheduling fails, mark as failed
            video_message = VideoGenerationMessage(**original_message_data)
            await self._update_status(video_message, StatusEnum.FAILED)
    
    async def _delayed_retry(self, message_data: Dict[str, Any], delay_seconds: int):
        """Send retry message after delay (fallback method)"""
        try:
            await asyncio.sleep(delay_seconds)
            
            await self.service_bus.send_message(
                destination_type="queue",
                destination_name=self.settings.service_bus_video_generation_queue_name,
                message_data=message_data
            )
            
            video_message = VideoGenerationMessage(**message_data)
            self.logger.info(f"Retry message sent for PPT {video_message.ppt_id}, slide {video_message.index}")
            
        except Exception as e:
            self.logger.error(f"Failed to send retry message: {str(e)}")
    
    async def _update_status(self, video_message: VideoGenerationMessage, status: StatusEnum, status_type: str = 'both'):
        """Update video generation status in Cosmos DB"""
        if status_type in ['generation_status', 'both']:
            await self.cosmos_db.update_slide_video_status(
                ppt_id=video_message.ppt_id,
                user_id=video_message.user_id,
                video_id=video_message.video_id,
                slide_index=video_message.index,
                status_type='generation_status',
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
    
    def _calculate_retry_delay(self, attempt: int, retry_after: Optional[int] = None) -> float:
        """Calculate delay for retry with exponential backoff and jitter"""
        if retry_after:
            base_delay = retry_after
        else:
            base_delay = self.base_delay * (2 ** attempt)
        
        base_delay = min(base_delay, self.max_delay)
        jitter = base_delay * self.jitter_range * (2 * random.random() - 1)
        final_delay = base_delay + jitter
        
        return max(final_delay, 0.1)
    
    def _is_retryable_error(self, status_code: int) -> bool:
        """Check if an HTTP status code indicates a retryable error"""
        return status_code in [429, 500, 502, 503, 504]
    
    def _extract_retry_after(self, response_headers: Dict[str, str]) -> Optional[int]:
        """Extract Retry-After value from response headers"""
        retry_after = response_headers.get('Retry-After') or response_headers.get('retry-after')
        if retry_after:
            try:
                return int(retry_after)
            except ValueError:
                self.logger.warning(f"Invalid Retry-After header value: {retry_after}")
        return None
    
    async def _get_authentication_headers(self) -> Dict[str, str]:
        """Get authentication headers for Azure Speech API"""
        try:
            token = await self.credential.get_token('https://cognitiveservices.azure.com/.default')
            return {'Authorization': f'Bearer {token.token}'}
        except Exception as e:
            self.logger.error(f"Failed to get authentication token: {str(e)}")
            raise
    
    def _map_avatar_config(self, avatar_config: Dict[str, Any]) -> Dict[str, Any]:
        """Map avatar configuration to Azure format"""
        avatar_persona = avatar_config.get('avatar_persona', 'default').lower()
        mapped_config = self.avatar_mapping.get(avatar_persona, self.avatar_mapping['default'])
        return mapped_config
    
    async def submit_synthesis_job(self, job_id: str, script: str, avatar_config: Dict[str, Any]) -> bool:
        """Submit avatar synthesis job to Azure Speech API with retry logic"""
        url = f'{self.settings.speech_endpoint}/avatar/batchsyntheses/{job_id}?api-version={self.settings.speech_api_version}'
        
        avatar = self._map_avatar_config(avatar_config)
        
        payload = {
            'synthesisConfig': {
                "voice": avatar[f"voice_{avatar_config.get('language', 'english').lower()}"],
            },
            'customVoices': {},
            "inputKind": "PlainText",
            "inputs": [{"content": script}],
            "avatarConfig": {
                "customized": False,
                "talkingAvatarCharacter": avatar["name"],
                "talkingAvatarStyle": avatar["style"],
                "videoFormat": "webm",
                "videoCodec": "vp9",
                "subtitleType": "none",
                "backgroundColor": "#00000000"
            }
        }
        
        for attempt in range(self.max_retries):
            try:
                headers = {'Content-Type': 'application/json'}
                headers.update(await self._get_authentication_headers())
                
                async with aiohttp.ClientSession() as session:
                    async with session.put(url, json=payload, headers=headers) as response:
                        if response.status < 400:
                            self.logger.info(f'Avatar synthesis job submitted successfully for job {job_id}')
                            return True
                        elif self._is_retryable_error(response.status):
                            error_text = await response.text()
                            retry_after = self._extract_retry_after(dict(response.headers))
                            
                            if attempt < self.max_retries - 1:
                                delay = self._calculate_retry_delay(attempt, retry_after)
                                self.logger.warning(f'Retryable error submitting job {job_id}, retrying in {delay:.2f} seconds...')
                                await asyncio.sleep(delay)
                                continue
                            else:
                                self.logger.error(f'Failed to submit synthesis job {job_id} after {self.max_retries} attempts')
                                return False
                        else:
                            error_text = await response.text()
                            self.logger.error(f'Non-retryable error submitting synthesis job {job_id}: [{response.status}] {error_text}')
                            return False
                            
            except Exception as e:
                if attempt < self.max_retries - 1:
                    delay = self._calculate_retry_delay(attempt)
                    self.logger.warning(f'Error submitting synthesis job {job_id}, retrying in {delay:.2f} seconds...')
                    await asyncio.sleep(delay)
                    continue
                else:
                    self.logger.error(f'Error submitting synthesis job {job_id} after {self.max_retries} attempts: {str(e)}')
                    return False
        
        return False
    
    async def get_synthesis_status(self, job_id: str) -> Tuple[str, Optional[str]]:
        """Get synthesis job status and download URL if ready with retry logic"""
        url = f'{self.settings.speech_endpoint}/avatar/batchsyntheses/{job_id}?api-version={self.settings.speech_api_version}'
        
        for attempt in range(self.max_retries):
            try:
                headers = await self._get_authentication_headers()
                
                async with aiohttp.ClientSession() as session:
                    async with session.get(url, headers=headers) as response:
                        if response.status < 400:
                            data = await response.json()
                            status = data['status']
                            download_url = data.get('outputs', {}).get('result') if status == 'Succeeded' else None
                            return status, download_url
                        elif self._is_retryable_error(response.status):
                            if attempt < self.max_retries - 1:
                                delay = self._calculate_retry_delay(attempt)
                                await asyncio.sleep(delay)
                                continue
                            else:
                                self.logger.error(f'Failed to get synthesis status for {job_id} after {self.max_retries} attempts')
                                return 'Error', None
                        else:
                            error_text = await response.text()
                            self.logger.error(f'Non-retryable error getting synthesis status for {job_id}: {error_text}')
                            return 'Error', None
                            
            except Exception as e:
                if attempt < self.max_retries - 1:
                    delay = self._calculate_retry_delay(attempt)
                    await asyncio.sleep(delay)
                    continue
                else:
                    self.logger.error(f'Error getting synthesis status for {job_id}: {str(e)}')
                    return 'Error', None
        
        return 'Error', None
    
    async def wait_for_completion(self, job_id: str, max_wait_time: int = 300) -> Tuple[str, Optional[str]]:
        """Wait for synthesis job to complete with timeout"""
        start_time = time.time()
        check_interval = 10
        max_check_interval = 60
        
        while time.time() - start_time < max_wait_time:
            status, download_url = await self.get_synthesis_status(job_id)
            
            if status == 'Succeeded':
                self.logger.info(f'Synthesis job {job_id} completed successfully')
                return status, download_url
            elif status == 'Failed':
                self.logger.error(f'Synthesis job {job_id} failed')
                return status, None
            elif status == 'Error':
                return status, None
            else:
                self.logger.info(f'Synthesis job {job_id} status: {status}')
                await asyncio.sleep(check_interval)
                check_interval = min(check_interval + 5, max_check_interval)
        
        self.logger.error(f'Synthesis job {job_id} timed out after {max_wait_time} seconds')
        return 'Timeout', None
    
    async def send_transformation_message(self, original_message: VideoGenerationMessage, video_url: str) -> None:
        """Send message to video transformation queue"""
        try:
            transformation_message = VideoTransformationMessage(
                ppt_id=original_message.ppt_id,
                user_id=original_message.user_id,
                video_id=original_message.video_id,
                index=original_message.index,
                avatar_video_url=video_url,
                show_avatar=original_message.show_avatar,
                avatar_persona=original_message.avatar_persona,
                avatar_position=original_message.avatar_position,
                avatar_size=original_message.avatar_size,
                pause_before=original_message.pause_before,
                pause_after=original_message.pause_after,
                timestamp=original_message.timestamp
            )

            transformation_message_dict = transformation_message.model_dump()
            transformation_message_dict["id"] = str(uuid.uuid4())
            
            await self.service_bus.send_message(
                destination_type="queue",
                destination_name=self.settings.service_bus_video_transformation_queue_name,
                message_data=transformation_message_dict
            )
            
            self.logger.info(f"Sent transformation message for PPT {original_message.ppt_id}, slide {original_message.index}")
            
        except Exception as e:
            self.logger.error(f"Failed to send transformation message: {str(e)}")
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