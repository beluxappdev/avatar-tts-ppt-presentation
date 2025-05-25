from typing import List
from common.services.base_extractor import BaseExtractorService
from common.models.powerpoint import SlideExtractionModel
from common.models.service_config import ServiceBusConfig
from common.utils.config import Settings
from common.parsers.powerpoint_parser import PowerPointParser


class ImageExtractorService(BaseExtractorService):
    """Service for processing PowerPoint files and extracting slide images"""
    
    def __init__(self, settings: Settings):
        config = ServiceBusConfig.for_subscription(
            settings.service_bus_topic_name,
            settings.service_bus_image_subscription_name
        )
        super().__init__(settings, "image", config)
        self.parser = PowerPointParser()
    
    async def _extract_content(self, ppt_id: str, ppt_data: bytes) -> List[SlideExtractionModel]:
        """Extract images from PowerPoint file"""
        # Convert PowerPoint to images
        images = self.parser.convert_to_images(ppt_data)
        self.logger.info(f"Extracted {len(images)} slides from PowerPoint {ppt_id}")
        
        # Upload images to blob storage and create slide models
        return await self._upload_slide_images(ppt_id, images)
    
    async def _upload_slide_images(self, ppt_id: str, images) -> List[SlideExtractionModel]:
        """Upload slide images to blob storage"""
        slide_models = []
        
        for index, image in enumerate(images):
            try:
                # Convert image to bytes
                image_data = self.parser.image_to_bytes(image, 'PNG')
                
                # Create blob path: {ppt_id}/images/{index}.png
                blob_name = f"{ppt_id}/images/{index}.png"
                
                # Upload to blob storage
                image_url = await self.blob_service.upload_file(
                    self.settings.blob_container_name,
                    blob_name,
                    image_data
                )
                
                # Create slide model
                slide_model = SlideExtractionModel(
                    index=index,
                    hasImage=True,
                    hasScript=False,
                    imageUrl=image_url,
                    scriptUrl=None
                )
                
                slide_models.append(slide_model)
                self.logger.info(f"Uploaded image for slide {index}: {blob_name}")
                
            except Exception as e:
                self.logger.error(f"Failed to upload image for slide {index}: {str(e)}")
                # Create slide model with error state
                slide_model = SlideExtractionModel(
                    index=index,
                    hasImage=False,
                    hasScript=False,
                    imageUrl=None,
                    scriptUrl=None
                )
                slide_models.append(slide_model)
        
        return slide_models