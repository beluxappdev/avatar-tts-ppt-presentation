from azure.cosmos.aio import CosmosClient # type: ignore
from azure.identity.aio import DefaultAzureCredential # type: ignore
from azure.core.exceptions import AzureError # type: ignore
from common.models.powerpoint import PowerPointModel, StatusEnum
from common.models.user import User, PowerPointSummary, VideoSummary
from typing import Optional
from datetime import datetime
import logging
from common.utils.config import Settings

logger = logging.getLogger(__name__)


class CosmosDBService:
    def __init__(self, endpoint: str, database_name: str):
        settings = Settings()
        self.endpoint = endpoint
        self.database_name = database_name
        self.credential = DefaultAzureCredential()
        self.ppt_container = settings.cosmos_db_ppt_container_name
        self.user_container = settings.cosmos_db_user_container_name
        self.client = None
        self.database = None
    
    async def _get_container(self, container_name: str):
        """Get or create the async Cosmos client and container"""
        if self.client is None:
            self.client = CosmosClient(self.endpoint, self.credential)
            self.database = self.client.get_database_client(self.database_name)
        self.container = self.database.get_container_client(container_name)
        return self.container
    
    async def create_powerpoint_record(self, powerpoint: PowerPointModel) -> PowerPointModel:
        """ Create a new PowerPoint record in Cosmos DB

        Args:
            powerpoint (PowerPointModel): The PowerPoint model instance to be created.

        Returns:
            PowerPointModel: The created PowerPoint model instance with ID and other fields populated.
        """
        try:
            container = await self._get_container(self.ppt_container)
            
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
            Optional[PowerPointModel], etag: The PowerPoint model instance if found, otherwise None and the etag for concurrency control.
        """
        try:
            container = await self._get_container(self.ppt_container)
            
            item = await container.read_item(item=ppt_id, partition_key=user_id)
            etag = item["_etag"]
            return PowerPointModel(**item), etag
            
        except AzureError as e:
            if e.status_code == 404:
                logger.info(f"PowerPoint record not found: {ppt_id}")
                return None
            logger.error(f"Error retrieving PowerPoint record from Cosmos DB: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error retrieving PowerPoint record: {e}")
            raise

    async def delete_powerpoint_record(self, ppt_id: str, user_id: str) -> None:
        """Delete a PowerPoint record from Cosmos DB.

        Args:
            ppt_id (str): The ID of the PowerPoint record to delete.
            user_id (str): The user ID associated with the PowerPoint record (partition key).
        """
        try:
            container = await self._get_container(self.ppt_container)
            await container.delete_item(item=ppt_id, partition_key=user_id)
            logger.info(f"Deleted PowerPoint record with ID: {ppt_id} for user: {user_id}")

            container = await self._get_container(self.user_container)
            # Retrieve the user record to remove the PowerPoint reference
            user_item = await container.read_item(item=user_id, partition_key=user_id)
            user = User(**user_item)    
            # Remove the PowerPoint from the user's list
            user.powerpoints = [ppt for ppt in user.powerpoints if ppt.ppt_id != ppt_id]
            await self.update_user_record(user)

        except AzureError as e:
            if e.status_code == 404:
                logger.warning(f"PowerPoint record not found for deletion: {ppt_id}")
                return
            logger.error(f"Error deleting PowerPoint record from Cosmos DB: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error deleting PowerPoint record: {e}")
            raise

    async def delete_video(self, ppt_id: str, video_id: str, user_id: str) -> None:
        """Delete a video entry from a PowerPoint record's video_info list.

        Args:
            ppt_id (str): The ID of the PowerPoint record.
            video_id (str): The ID of the video to delete.
            user_id (str): The user ID (partition key).
        """
        try:
            container = await self._get_container(self.ppt_container)

            # Retrieve the PowerPoint record
            item = await container.read_item(item=ppt_id, partition_key=user_id)
            powerpoint = PowerPointModel(**item)

            # Filter out the video with the given video_id
            powerpoint.video_information = [video for video in powerpoint.video_information if video.video_id != video_id]

            await self.update_powerpoint_record(powerpoint)

            container = await self._get_container(self.user_container)
            # Retrieve the user record to remove the video reference
            user_item = await container.read_item(item=user_id, partition_key=user_id)
            user = User(**user_item)
            ppt_summary = next((ppt for ppt in user.powerpoints if ppt.ppt_id == ppt_id), None)
            if ppt_summary:
                ppt_summary.videos = [video for video in ppt_summary.videos if video.video_id != video_id]
            await self.update_user_record(user)
            logger.info(f"Deleted video with ID: {video_id} from PowerPoint record: {ppt_id} for user: {user_id}")

        except AzureError as e:
            logger.error(f"Azure error deleting video from PowerPoint record: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error deleting video from PowerPoint record: {e}")
            raise


    async def get_user_by_id(self, user_id: str) -> Optional[User]:
        """
        Get a user by their ID from Cosmos DB.
    
        Args:
            user_id (str): The user ID to retrieve
        
        Returns:
            Optional[User]: The user object if found, None otherwise
        """
        try:
            container = await self._get_container(self.user_container)
            # Add debug logs as info type
            logger.info(f"Retrieving user by ID: {user_id}")
            logger.info(f"Container name: {self.user_container}")

            item = await container.read_item(item=user_id, partition_key=user_id)
            return User(**item)
        
        except AzureError as e:
            if e.status_code == 404:
                logger.info(f"User not found: {user_id}")
                return None
            logger.error(f"Error retrieving user from Cosmos DB: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error retrieving user: {e}")
            raise

    async def create_powerpoint_summary(self, powerpoint: PowerPointSummary, user_id: str) -> PowerPointModel:
        """ Create a Powerpoint summary record for the user in Cosmos DB"""
        user = await self.get_user_by_id(user_id)
        if not user:
            logger.error(f"User not found: {user_id}")
            return None

        user.powerpoints.append(powerpoint)
        await self.update_user_record(user)
        return powerpoint

    async def create_video_summary(self, video: VideoSummary, ppt_id: str, user_id: str) -> PowerPointModel:
        """ Create a Video summary record for the user in Cosmos DB"""
        user = await self.get_user_by_id(user_id)
        if not user:
            logger.error(f"User not found: {user_id}")
            return None

        ppt_summary = next((ppt for ppt in user.powerpoints if ppt.ppt_id == ppt_id), None)
        ppt_summary.videos.append(video)
        await self.update_user_record(user)
        return video

    async def create_user_record(self, user: User) -> User:
        """
        Create a user record in Cosmos DB.
    
        Args:
            user (User): The user object to create
        
        Returns:
            User: The created user object
        """
        try:
            container = await self._get_container(self.user_container)
        
            # Convert to dict for Cosmos DB
            item_dict = user.model_dump(mode='json', by_alias=True)
        
            # Set the id field for Cosmos DB (using user_id as the document id)
            item_dict['id'] = user.id
        
            # Create the item
            created_item = await container.create_item(item_dict)
        
            logger.info(f"User record created with ID: {user.id}")
            return User(**created_item)
        
        except AzureError as e:
            logger.error(f"Error creating user record in Cosmos DB: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error creating user record: {e}")
            raise

    async def update_user_record(self, user: User, etag: str = None) -> User:
        """ Update an existing user record in Cosmos DB

        Args:
            user (User): The User model instance with updated fields.

        Returns:
            User: The updated User model instance with changes applied.
        """
        try:
            container = await self._get_container(self.user_container)
            
            # Convert to dict for Cosmos DB
            item_dict = user.model_dump(mode='json', by_alias=True)
            
            # Update the item
            if etag:
                updated_item = await container.replace_item(
                    item=user.id, 
                    body=item_dict,
                    request_options={"if_match": etag}
                )
            else:
                updated_item = await container.replace_item(
                    item=user.id,
                    body=item_dict
                )
            
            logger.info(f"User record updated with ID: {user.id}")
            return User(**updated_item)
            
        except AzureError as e:
            logger.error(f"Error updating user record in Cosmos DB: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error updating user record: {e}")
            raise
    
    async def update_powerpoint_record(self, powerpoint: PowerPointModel, etag: str = None) -> PowerPointModel:
        """ Update an existing PowerPoint record in Cosmos DB

        Args:
            powerpoint (PowerPointModel): The PowerPoint model instance with updated fields.

        Returns:
            PowerPointModel: The updated PowerPoint model instance with changes applied.
        """
        try:
            container = await self._get_container(self.ppt_container)
            
            # Convert to dict for Cosmos DB
            item_dict = powerpoint.model_dump(mode='json', by_alias=True)
            
            # Update the item
            if etag:
                updated_item = await container.replace_item(
                    item=powerpoint.id, 
                    body=item_dict,
                    request_options={"if_match": etag}
                )
            else:
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

    async def update_video_status(self, ppt_id: str, user_id: str, video_id: str, 
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
                powerpoint_record, _ = await self.get_powerpoint_record(ppt_id, user_id)
        
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
        
                # Get the status object to update
                if status_type == "status":
                    status_obj = video_info.status
                elif status_type == "generation_status":
                    status_obj = video_info.generation_status
                elif status_type == "transformation_status":
                    status_obj = video_info.transformation_status
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
        
                logger.info(f"Updated {status_type} to {new_status} for PPT {ppt_id}, video {video_id}")
                return True
        
            except Exception as e:
                logger.error(f"Error updating slide video status: {str(e)}")
                return False

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
            powerpoint_record, etag = await self.get_powerpoint_record(ppt_id, user_id)
        
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