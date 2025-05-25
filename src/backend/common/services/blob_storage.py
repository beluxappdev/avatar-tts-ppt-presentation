from azure.storage.blob.aio import BlobServiceClient # type: ignore
from azure.identity.aio import DefaultAzureCredential # type: ignore
from azure.core.exceptions import AzureError # type: ignore
import logging

logger = logging.getLogger(__name__)


class BlobStorageService:
    def __init__(self, account_url: str):
        self.account_url = account_url
        self.credential = DefaultAzureCredential()
        self.blob_service_client = None
    
    async def _get_client(self):
        """Get or create the async blob service client"""
        if self.blob_service_client is None:
            self.blob_service_client = BlobServiceClient(
                account_url=self.account_url, 
                credential=self.credential
            )
        return self.blob_service_client
    
    async def upload_file(self, container_name: str, blob_name: str, file_data: bytes) -> str:
        """ Upload file to blob storage

        Args:
            container_name (str): The name of the container in blob storage.
            blob_name (str): The name of the blob (file) to be created in the container.
            file_data (bytes): The file data to be uploaded as bytes.

        Returns:
            str: The URL of the uploaded blob in blob storage.
        """
        try:
            client = await self._get_client()
            blob_client = client.get_blob_client(
                container=container_name, 
                blob=blob_name
            )
            
            # Upload the file
            await blob_client.upload_blob(file_data, overwrite=True)
            
            logger.info(f"File uploaded successfully to blob storage: {blob_name}")
            
            # Return the blob URL
            return blob_client.url
            
        except AzureError as e:
            logger.error(f"Azure error uploading file to blob storage: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error uploading file to blob storage: {e}")
            raise
    
    async def download_file(self, container_name: str, blob_name: str) -> bytes:
        """ Download file from blob storage

        Args:
            container_name (str): The name of the container in blob storage.
            blob_name (str): The name of the blob (file) to be downloaded from the container.

        Returns:
            bytes: The file data downloaded from blob storage as bytes.
        """
        try:
            client = await self._get_client()
            blob_client = client.get_blob_client(
                container=container_name, 
                blob=blob_name
            )
            
            download_stream = await blob_client.download_blob()
            file_data = await download_stream.readall()
            
            logger.info(f"File downloaded successfully from blob storage: {blob_name}")
            return file_data
            
        except AzureError as e:
            logger.error(f"Azure error downloading file from blob storage: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error downloading file from blob storage: {e}")
            raise
    
    async def file_exists(self, container_name: str, blob_name: str) -> bool:
        """ Check if a file exists in blob storage

        Args:
            container_name (str): The name of the container in blob storage.
            blob_name (str): The name of the blob (file) to check for existence.

        Returns:
            bool: True if the file exists, False otherwise.
        """
        try:
            client = await self._get_client()
            blob_client = client.get_blob_client(
                container=container_name, 
                blob=blob_name
            )
            
            return await blob_client.exists()
            
        except AzureError as e:
            logger.error(f"Azure error checking file existence in blob storage: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error checking file existence in blob storage: {e}")
            raise
    
    async def close(self):
        """Close the blob service client"""
        if self.blob_service_client:
            await self.blob_service_client.close()