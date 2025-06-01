from azure.storage.blob.aio import BlobServiceClient # type: ignore
from azure.storage.blob import generate_blob_sas, BlobSasPermissions # type: ignore
from azure.identity.aio import DefaultAzureCredential # type: ignore
from azure.core.exceptions import AzureError # type: ignore
from datetime import datetime, timedelta
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

    async def delete_folder(self, container_name: str, folder_name: str) -> None:
        """Delete all blobs under a virtual folder in a container.

        Args:
            container_name (str): The name of the container.
            folder_name (str): The virtual folder path to delete (e.g., 'myfolder/').
        """
        try:
            client = await self._get_client()
            container_client = client.get_container_client(container_name)

            # Ensure folder_name ends with a slash
            if not folder_name.endswith('/'):
                folder_name += '/'

            # List all blobs with the given prefix
            async for blob in container_client.list_blobs(name_starts_with=folder_name):
                blob_client = container_client.get_blob_client(blob.name)
                await blob_client.delete_blob()
                logger.info(f"Deleted blob: {blob.name}")

            logger.info(f"All blobs under folder '{folder_name}' in container '{container_name}' have been deleted.")

        except AzureError as e:
            logger.error(f"Azure error deleting folder '{folder_name}' in container '{container_name}': {e}")
        except Exception as e:
            logger.error(f"Unexpected error deleting folder '{folder_name}' in container '{container_name}': {e}")

    async def get_blob_url_with_sas(self, container_name: str, blob_name: str, expiry_hours: int = 24) -> str:
        """ Generate a blob URL with SAS token for secure access

        Args:
            container_name (str): The name of the container in blob storage.
            blob_name (str): The name of the blob (file) to generate SAS URL for.
            expiry_hours (int): Hours from now when the SAS token expires (default: 24).

        Returns:
            str: The blob URL with SAS token for secure access.
        """
        try:
            client = await self._get_client()
            blob_client = client.get_blob_client(
                container=container_name, 
                blob=blob_name
            )
        
            # Calculate expiry time
            start_time = datetime.utcnow()
            expiry_time = start_time + timedelta(hours=expiry_hours)
        
            try:
                # Try to get user delegation key for managed identity/service principal auth
                user_delegation_key = await client.get_user_delegation_key(
                    key_start_time=start_time,
                    key_expiry_time=expiry_time
                )
            
                # Generate SAS token with user delegation key
                sas_token = generate_blob_sas(
                    account_name=client.account_name,
                    container_name=container_name,
                    blob_name=blob_name,
                    user_delegation_key=user_delegation_key,
                    permission=BlobSasPermissions(read=True),
                    expiry=expiry_time,
                    start=start_time
                )
            
                logger.info(f"Generated SAS URL with user delegation key for blob: {blob_name}")
            
            except Exception as delegation_error:
                logger.warning(f"Could not get user delegation key: {delegation_error}")
                # Fallback: try with account key (if available)
                if hasattr(client.credential, 'account_key') and client.credential.account_key:
                    sas_token = generate_blob_sas(
                        account_name=client.account_name,
                        container_name=container_name,
                        blob_name=blob_name,
                        account_key=client.credential.account_key,
                        permission=BlobSasPermissions(read=True),
                        expiry=expiry_time,
                        start=start_time
                    )
                    logger.info(f"Generated SAS URL with account key for blob: {blob_name}")
                else:
                    # If neither method works, return the blob URL without SAS
                    logger.warning(f"Cannot generate SAS token, returning blob URL without SAS for: {blob_name}")
                    return blob_client.url
        
            # Construct URL with SAS token
            blob_url_with_sas = f"{blob_client.url}?{sas_token}"
            return blob_url_with_sas
        
        except AzureError as e:
            logger.error(f"Azure error generating SAS URL for blob: {e}")
            # Return the blob URL without SAS as fallback
            return blob_client.url
        except Exception as e:
            logger.error(f"Unexpected error generating SAS URL for blob: {e}")
            # Return the blob URL without SAS as fallback
            return blob_client.url
    
    async def close(self):
        """Close the blob service client"""
        if self.blob_service_client:
            await self.blob_service_client.close()