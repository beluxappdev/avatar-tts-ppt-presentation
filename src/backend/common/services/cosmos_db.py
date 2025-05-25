from azure.cosmos.aio import CosmosClient # type: ignore
from azure.identity.aio import DefaultAzureCredential # type: ignore
from azure.core.exceptions import AzureError # type: ignore
from common.models.powerpoint import PowerPointModel, StatusEnum
from typing import Optional
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class CosmosDBService:
    def __init__(self, endpoint: str, database_name: str, container_name: str):
        self.endpoint = endpoint
        self.database_name = database_name
        self.container_name = container_name
        self.credential = DefaultAzureCredential()
        self.client = None
        self.database = None
        self.container = None
    
    async def _get_container(self):
        """Get or create the async Cosmos client and container"""
        if self.client is None:
            self.client = CosmosClient(self.endpoint, self.credential)
            self.database = self.client.get_database_client(self.database_name)
            self.container = self.database.get_container_client(self.container_name)
        
        return self.container
    
    async def create_powerpoint_record(self, powerpoint: PowerPointModel) -> PowerPointModel:
        """ Create a new PowerPoint record in Cosmos DB

        Args:
            powerpoint (PowerPointModel): The PowerPoint model instance to be created.

        Returns:
            PowerPointModel: The created PowerPoint model instance with ID and other fields populated.
        """
        try:
            container = await self._get_container()
            
            # Convert to dict for Cosmos DB
            item_dict = powerpoint.model_dump(mode='json', by_alias=True)
            
            # Create the item
            created_item = await container.create_item(item_dict)
            
            logger.info(f"PowerPoint record created with ID: {powerpoint.id}")
            return PowerPointModel(**created_item)
            
        except AzureError as e:
            logger.error(f"Error creating PowerPoint record in Cosmos DB: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error creating PowerPoint record: {e}")
            raise
    
    async def get_powerpoint_record(self, ppt_id: str, user_id: str) -> Optional[PowerPointModel]:
        """ Retrieve a PowerPoint record by ID and user ID

        Args:
            ppt_id (str): The ID of the PowerPoint record to retrieve. 
            user_id (str): The user ID associated with the PowerPoint record.

        Returns:
            Optional[PowerPointModel]: The PowerPoint model instance if found, otherwise None.
        """
        try:
            container = await self._get_container()
            
            item = await container.read_item(item=ppt_id, partition_key=user_id)
            return PowerPointModel(**item)
            
        except AzureError as e:
            if e.status_code == 404:
                logger.info(f"PowerPoint record not found: {ppt_id}")
                return None
            logger.error(f"Error retrieving PowerPoint record from Cosmos DB: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error retrieving PowerPoint record: {e}")
            raise
    
    async def update_powerpoint_record(self, powerpoint: PowerPointModel) -> PowerPointModel:
        """ Update an existing PowerPoint record in Cosmos DB

        Args:
            powerpoint (PowerPointModel): The PowerPoint model instance with updated fields.

        Returns:
            PowerPointModel: The updated PowerPoint model instance with changes applied.
        """
        try:
            container = await self._get_container()
            
            # Convert to dict for Cosmos DB
            item_dict = powerpoint.model_dump(mode='json', by_alias=True)
            
            # Update the item
            updated_item = await container.replace_item(
                item=powerpoint.id, 
                body=item_dict
            )
            
            logger.info(f"PowerPoint record updated with ID: {powerpoint.id}")
            return PowerPointModel(**updated_item)
            
        except AzureError as e:
            logger.error(f"Error updating PowerPoint record in Cosmos DB: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error updating PowerPoint record: {e}")
            raise

    async def update_slide_video_status(self, ppt_id: str, user_id: str, video_id: str, slide_index: str, 
                                status_type: str, new_status: StatusEnum, error_message: Optional[str] = None) -> bool:
        """Update slide video status in PowerPoint record
    
        Args:
            ppt_id: PowerPoint ID
            user_id: User ID (partition key)
            video_id: Video ID
            slide_index: Slide index
            status_type: Type of status to update ('status', 'generation_status', 'transformation_status')
            new_status: New status value (StatusEnum)
            error_message: Error message if status is 'Failed'
        
        Returns:
            True if update was successful, False otherwise
        """
        try:
            # Get the PowerPoint record
            powerpoint_record = await self.get_powerpoint_record(ppt_id, user_id)
        
            if not powerpoint_record:
                logger.error(f"PowerPoint record not found: {ppt_id}")
                return False
        
            # Find the video information
            video_info = None
            for vi in powerpoint_record.video_information:
                if vi.video_id == video_id:
                    video_info = vi
                    break
        
            if not video_info:
                logger.error(f"Video information not found for video_id: {video_id}")
                return False
        
            # Find the slide
            slide_video = None
            for slide in video_info.slides:
                if slide.index == slide_index:
                    slide_video = slide
                    break
        
            if not slide_video:
                logger.error(f"Slide not found for index: {slide_index}")
                return False
        
            # Get the status object to update
            if status_type == "status":
                status_obj = slide_video.status
            elif status_type == "generation_status":
                status_obj = slide_video.generation_status
            elif status_type == "transformation_status":
                status_obj = slide_video.transformation_status
            else:
                logger.error(f"Invalid status_type: {status_type}")
                return False
        
            # Update status and timestamps
            status_obj.status = new_status
        
            if new_status == StatusEnum.PROCESSING:
                status_obj.processed_at = datetime.utcnow()
            elif new_status == StatusEnum.COMPLETED:
                status_obj.completed_at = datetime.utcnow()
            elif new_status == StatusEnum.FAILED:
                status_obj.failed_at = datetime.utcnow()
                if error_message:
                    status_obj.error_message = error_message
        
            # Update the record in Cosmos DB
            await self.update_powerpoint_record(powerpoint_record)
        
            logger.info(f"Updated {status_type} to {new_status} for PPT {ppt_id}, video {video_id}, slide {slide_index}")
            return True
        
        except Exception as e:
            logger.error(f"Error updating slide video status: {str(e)}")
            return False
    
    async def close(self):
        """Close the Cosmos client"""
        if self.client:
            await self.client.close()