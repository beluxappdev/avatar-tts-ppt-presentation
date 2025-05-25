from typing import List, Optional, Dict
from abc import abstractmethod
from datetime import datetime
from .base_service import BaseService
from .blob_storage import BlobStorageService
from .cosmos_db import CosmosDBService
from ..models.powerpoint import PowerPointModel, SlideExtractionModel, StatusEnum
from ..models.messages import ExtractionMessage
from ..utils.exceptions import PPTProcessingError, BlobStorageError, CosmosDBError


class BaseExtractorService(BaseService):
    """Base class for PowerPoint content extraction services"""
    
    def __init__(self, settings, extractor_type: str, service_bus_config):
        super().__init__(settings, f"{extractor_type.title()} Extractor Service", service_bus_config)
        self.extractor_type = extractor_type
    
    async def _initialize(self):
        """Initialize extraction-specific resources"""
        self.blob_service = BlobStorageService(self.settings.storage_account_url)
        self.cosmos_service = CosmosDBService(
            self.settings.cosmos_db_endpoint,
            self.settings.cosmos_db_database_name,
            self.settings.cosmos_db_container_name
        )
    
    async def handle_message(self, message_data: Dict) -> None:
        """Handle extraction message"""
        # Create extraction message model
        extraction_msg = ExtractionMessage(**message_data)
        
        # Process the PowerPoint file
        await self._process_powerpoint(extraction_msg)
    
    async def _process_powerpoint(self, extraction_msg: ExtractionMessage):
        """Process PowerPoint file - template method pattern"""
        ppt_id = extraction_msg.ppt_id
        user_id = extraction_msg.user_id
        blob_url = extraction_msg.blob_url
        
        self.logger.info(f"Processing PowerPoint {ppt_id} for user {user_id}")
        
        try:
            # Update status to processing
            await self._update_extraction_status(ppt_id, user_id, StatusEnum.PROCESSING)
            
            # Download PowerPoint file from blob storage
            ppt_data = await self._download_powerpoint(blob_url)
            
            # Extract content using the specific extractor implementation
            slide_models = await self._extract_content(ppt_id, ppt_data)
            
            self.logger.info(f"Extracted content from {len(slide_models)} slides in PowerPoint {ppt_id}")
            
            # Update PowerPoint record with slide information
            await self._update_powerpoint_record(ppt_id, user_id, slide_models)
            
            self.logger.info(f"Successfully processed PowerPoint {ppt_id}")
            
        except Exception as e:
            self.logger.error(f"Error processing PowerPoint {ppt_id}: {str(e)}")
            await self._update_extraction_status(
                ppt_id, 
                user_id, 
                StatusEnum.FAILED, 
                error_message=str(e)
            )
            raise
    
    async def _download_powerpoint(self, blob_url: str) -> bytes:
        """Download PowerPoint file from blob storage"""
        try:
            # Parse blob URL to get container and blob name
            url_parts = blob_url.replace("https://", "").split("/", 2)
            if len(url_parts) < 3:
                raise BlobStorageError(f"Invalid blob URL format: {blob_url}")
            
            container_name = url_parts[1]
            blob_name = url_parts[2]
            
            # Download the file
            file_data = await self.blob_service.download_file(container_name, blob_name)
            self.logger.info(f"Downloaded PowerPoint file: {blob_name}")
            
            return file_data
            
        except Exception as e:
            error_msg = f"Failed to download PowerPoint from {blob_url}: {str(e)}"
            self.logger.error(error_msg)
            raise BlobStorageError(error_msg)
    
    async def _update_extraction_status(self, ppt_id: str, user_id: str, status: StatusEnum, error_message: Optional[str] = None):
        """Update the extraction status in Cosmos DB"""
        try:
            # Get existing record or create new one
            powerpoint, etag = await self.cosmos_service.get_powerpoint_record(ppt_id, user_id)
            
            if not powerpoint:
                # Create new record
                powerpoint = PowerPointModel(
                    id=ppt_id,
                    userId=user_id,
                    fileName="unknown",
                    blobUrl=None
                )
            
            # Update the appropriate extraction status based on extractor type
            now = datetime.utcnow()
            
            if self.extractor_type == "image":
                status_field = powerpoint.image_extraction_status
            else:  # script
                status_field = powerpoint.script_extraction_status
            
            if status == StatusEnum.PROCESSING:
                status_field.status = status
                status_field.processed_at = now
            elif status == StatusEnum.COMPLETED:
                status_field.status = status
                status_field.completed_at = now
            elif status == StatusEnum.FAILED:
                status_field.status = status
                status_field.failed_at = now
                status_field.error_message = error_message
            
            # Save to Cosmos DB
            await self.cosmos_service.update_powerpoint_record(powerpoint)
            
        except Exception as e:
            self.logger.error(f"Failed to update extraction status: {str(e)}")
    
    async def _update_powerpoint_record(self, ppt_id: str, user_id: str, slide_models: List[SlideExtractionModel]):
        """Update PowerPoint record with slide information"""
        try:
            # Get existing record
            powerpoint, etag = await self.cosmos_service.get_powerpoint_record(ppt_id, user_id)
            
            if not powerpoint:
                raise CosmosDBError(f"PowerPoint record not found: {ppt_id}")
            
            # Merge slide information with existing slides
            existing_slides = {slide.index: slide for slide in powerpoint.slides}
            
            for slide_model in slide_models:
                if slide_model.index in existing_slides:
                    # Update existing slide with new information
                    existing_slide = existing_slides[slide_model.index]
                    if self.extractor_type == "image":
                        existing_slide.has_image = slide_model.has_image
                        existing_slide.image_url = slide_model.image_url
                    else:  # script
                        existing_slide.has_script = slide_model.has_script
                        existing_slide.script_url = slide_model.script_url
                else:
                    # Add new slide
                    existing_slides[slide_model.index] = slide_model
            
            # Convert back to list and sort by index
            powerpoint.slides = [existing_slides[index] for index in sorted(existing_slides.keys())]
            powerpoint.number_of_slides = max(powerpoint.number_of_slides, len(powerpoint.slides))
            
            # Update the appropriate extraction status to completed
            now = datetime.utcnow()
            if self.extractor_type == "image":
                powerpoint.image_extraction_status.status = StatusEnum.COMPLETED
                powerpoint.image_extraction_status.completed_at = now
            else:  # script
                powerpoint.script_extraction_status.status = StatusEnum.COMPLETED
                powerpoint.script_extraction_status.completed_at = now
            
            # Save to Cosmos DB
            await self.cosmos_service.update_powerpoint_record(powerpoint)
            self.logger.info(f"Updated PowerPoint record {ppt_id} with {len(slide_models)} slides")
            
        except Exception as e:
            error_msg = f"Failed to update PowerPoint record: {str(e)}"
            self.logger.error(error_msg)
            raise CosmosDBError(error_msg)
    
    async def cleanup(self):
        """Cleanup extraction service resources"""
        try:
            if hasattr(self, 'blob_service'):
                await self.blob_service.close()
            if hasattr(self, 'cosmos_service'):
                await self.cosmos_service.close()
        except Exception as e:
            self.logger.error(f"Error during extraction service cleanup: {str(e)}")
    
    @abstractmethod
    async def _extract_content(self, ppt_id: str, ppt_data: bytes) -> List[SlideExtractionModel]:
        """Extract content from PowerPoint file - to be implemented by subclasses"""
        pass