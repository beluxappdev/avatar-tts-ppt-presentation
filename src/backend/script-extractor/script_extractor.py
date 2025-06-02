from typing import List
from common.services.base_extractor import BaseExtractorService
from common.models.powerpoint import SlideExtractionModel
from common.models.service_config import ServiceBusConfig
from common.utils.config import Settings
from common.parsers.powerpoint_parser import PowerPointParser


class ScriptExtractorService(BaseExtractorService):
    """Service for processing PowerPoint files and extracting slide scripts/notes"""
    
    def __init__(self, settings: Settings):
        config = ServiceBusConfig.for_subscription(
            settings.service_bus_topic_name,
            settings.service_bus_script_subscription_name
        )
        super().__init__(settings, "script", config)
        self.parser = PowerPointParser()
    
    async def _extract_content(self, ppt_id: str, ppt_data: bytes) -> List[SlideExtractionModel]:
        """Extract scripts/notes from PowerPoint file"""
        # Extract notes from PowerPoint
        slide_notes = self.parser.extract_notes(ppt_data)
        self.logger.info(f"Extracted notes from {len(slide_notes)} slides in PowerPoint {ppt_id}")
        
        # Upload scripts to blob storage and create slide models
        return await self._upload_slide_scripts(ppt_id, slide_notes)
    
    async def _upload_slide_scripts(self, ppt_id: str, slide_notes: List[dict]) -> List[SlideExtractionModel]:
        """Upload slide scripts to blob storage"""
        slide_models = []
        
        for slide_info in slide_notes:
            index = slide_info["index"]
            notes_text = slide_info["notes_text"]
            has_notes = slide_info["has_notes"]
            
            try:
                script_url = None
                
                # Only upload if there are actual notes
                if has_notes and notes_text:
                    # Create blob path: {ppt_id}/scripts/{index}.txt
                    blob_name = f"{ppt_id}/scripts/{index}.txt"
                    
                    # Upload to blob storage
                    script_url = await self.blob_service.upload_file(
                        self.settings.blob_container_name,
                        blob_name,
                        notes_text.encode('utf-8')
                    )
                    
                    self.logger.info(f"Uploaded script for slide {index}: {blob_name}")
                
                # Create slide model
                slide_model = SlideExtractionModel(
                    index=index,
                    hasImage=False,
                    hasScript=has_notes,
                    imageUrl=None,
                    scriptUrl=script_url
                )
                
                slide_models.append(slide_model)
                
                if not has_notes:
                    self.logger.info(f"No script found for slide {index}")
                
            except Exception as e:
                self.logger.error(f"Failed to upload script for slide {index}: {str(e)}")
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