import os
import json
import tempfile
import logging
from datetime import datetime
from abc import ABC, abstractmethod

# Azure libraries
from azure.identity import ClientSecretCredential
from azure.servicebus import ServiceBusClient
from azure.storage.blob import BlobServiceClient
from azure.cosmos import CosmosClient

# PowerPoint processing
from pptx import Presentation

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class BaseExtractor(ABC):
    """Base class for PowerPoint content extractors with shared functionality"""
    
    def __init__(self, extractor_type):
        """Initialize the base extractor with common functionality
        
        Args:
            extractor_type (str): Type of extractor ('image' or 'script')
        """
        self.extractor_type = extractor_type
        
        # Load configuration from environment variables
        self.tenant_id = os.environ["AzureAd__TenantId"]
        self.client_id = os.environ["AzureAd__ClientId"]
        self.client_secret = os.environ["AzureAd__ClientSecret"]
        
        self.cosmos_endpoint = os.environ["AzureServices__CosmosDb__Endpoint"]
        self.cosmos_db_name = os.environ["AzureServices__CosmosDb__Database"]
        self.cosmos_container_name = os.environ["AzureServices__CosmosDb__Container"]
        
        self.blob_endpoint = os.environ["AzureServices__BlobStorage__Endpoint"]
        self.blob_container_name = os.environ["AzureServices__BlobStorage__Container"]
        
        self.servicebus_namespace = os.environ["AzureServices__ServiceBus__Namespace"]
        self.servicebus_topic = os.environ["AzureServices__ServiceBus__Topic"]
        self.servicebus_subscription = os.environ.get(f"AzureServices__ServiceBus__Subscription__{extractor_type.capitalize()}")
        
        # Initialize Azure credentials
        self.credential = ClientSecretCredential(
            tenant_id=self.tenant_id,
            client_id=self.client_id,
            client_secret=self.client_secret
        )
        
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
        """Initialize Azure Service Bus client"""
        servicebus_fqdn = f"{self.servicebus_namespace}.servicebus.windows.net"
        self.servicebus_client = ServiceBusClient(servicebus_fqdn, self.credential)
        logger.info(f"Initialized Service Bus client for namespace: {self.servicebus_namespace}")
    
    def start_processing(self):
        """Main method to start processing messages from Service Bus subscription"""
        logger.info(f"Starting to process messages from topic: {self.servicebus_topic}, subscription: {self.servicebus_subscription}")
        
        with self.servicebus_client:
            # Create a receiver client for the subscription
            receiver = self.servicebus_client.get_subscription_receiver(
                topic_name=self.servicebus_topic,
                subscription_name=self.servicebus_subscription,
                max_wait_time=60  # Wait up to 60 seconds for a message
            )
            
            with receiver:
                logger.info("Listening for messages...")
                while True:
                    try:
                        # Receive messages batch
                        received_msgs = receiver.receive_messages(max_message_count=10, max_wait_time=5)
                        
                        for msg in received_msgs:
                            try:
                                # Process the message
                                self.process_message(msg)
                                
                                # Complete the message to remove it from the queue
                                receiver.complete_message(msg)
                                logger.info(f"Message processed and completed")
                            except Exception as e:
                                logger.error(f"Error processing message: {str(e)}")
                                # Abandon the message to make it available again
                                receiver.abandon_message(msg)
                    except Exception as e:
                        logger.error(f"Error receiving messages: {str(e)}")
    
    def process_message(self, message):
        """Process a PowerPoint uploaded message"""
        try:
            # Handle generator message bodies
            if hasattr(message.body, '__iter__') and not isinstance(message.body, (str, bytes)):
                # Convert generator to bytes
                message_body_bytes = b''.join(message.body)
                message_body = message_body_bytes.decode('utf-8')
            else:
                # Normal case - bytes
                message_body = message.body.decode('utf-8')
            
            message_data = json.loads(message_body)
        
            if message_data.get("MessageType") != "PowerPointUploaded":
                logger.warning(f"Skipping message with unsupported type: {message_data.get('MessageType')}")
                return
        
            logger.info(f"Processing PowerPointUploaded message: {message_data}")
        
            # Extract message properties
            ppt_id = message_data.get("PptId")
            file_name = message_data.get("FileName")
            blob_url = message_data.get("BlobUrl")
            user_id = message_data.get("UserId")
            timestamp = message_data.get("Timestamp") or datetime.utcnow().isoformat()
        
            if not all([ppt_id, file_name, blob_url, user_id]):
                error_msg = "Message missing required fields"
                logger.error(error_msg)
                
                # Create a basic failure record in Cosmos even with missing fields
                if ppt_id and user_id:
                    self._log_failure(ppt_id, user_id, file_name or "unknown", blob_url or "unknown", 
                                     timestamp, error_msg)
                return
        
            # Reset extraction results tracking
            self.extraction_results = None
            
            try:
                # Download PowerPoint file
                temp_path = self._download_ppt_file(blob_url)
                
                # Process the PowerPoint based on extractor type
                presentation = Presentation(temp_path)
                
                if self.extractor_type == "image":
                    self.extract_images(ppt_id, presentation)
                else:  # script extractor
                    self.extract_scripts(ppt_id, presentation)
                
                # Log the extraction to Cosmos DB
                self.log_extraction(ppt_id, file_name, user_id, timestamp)
                
                # Cleanup temporary file
                if os.path.exists(temp_path):
                    os.unlink(temp_path)
                
            except Exception as e:
                error_msg = f"Error processing PowerPoint: {str(e)}"
                logger.error(error_msg)
                
                # Log the failure to Cosmos DB
                self._log_failure(ppt_id, user_id, file_name, blob_url, timestamp, error_msg)
                
                # Cleanup temporary file if it exists
                if 'temp_path' in locals() and os.path.exists(temp_path):
                    os.unlink(temp_path)
                
                raise
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse message as JSON: {str(e)}")
        except Exception as e:
            logger.error(f"Unhandled error processing message: {str(e)}")
            raise
    
    def _download_ppt_file(self, blob_url):
        """Download PowerPoint file from blob storage
        
        Args:
            blob_url (str): URL of the PowerPoint file in blob storage
            
        Returns:
            str: Path to the downloaded file
        """
        logger.info(f"Downloading PowerPoint from: {blob_url}")
        
        # Create a temp file to download the PowerPoint
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pptx') as temp_file:
            temp_path = temp_file.name
        
        try:
            # Parse the blob URL to get the container and blob path
            # Assuming URL format: https://account.blob.core.windows.net/container/path/to/blob
            url_parts = blob_url.replace("https://", "").split("/", 1)
            if len(url_parts) < 2:
                raise ValueError(f"Invalid blob URL format: {blob_url}")
            
            host = url_parts[0]
            container_blob_path = url_parts[1].split("/", 1)
            if len(container_blob_path) < 2:
                raise ValueError(f"Invalid blob path in URL: {blob_url}")
            
            container_name = container_blob_path[0]
            blob_path = container_blob_path[1]
            
            # Download the PowerPoint file from blob storage
            blob_client = self.blob_service_client.get_blob_client(container=container_name, blob=blob_path)
            with open(temp_path, "wb") as download_file:
                download_file.write(blob_client.download_blob().readall())
            
            logger.info(f"Downloaded PowerPoint to {temp_path}")
            return temp_path
            
        except Exception as e:
            # Clean up the temp file if download fails
            if os.path.exists(temp_path):
                os.unlink(temp_path)
            
            logger.error(f"Failed to download PowerPoint: {str(e)}")
            raise
    
    def _log_failure(self, ppt_id, user_id, file_name, blob_url, timestamp, error_msg):
        """Log failure to Cosmos DB
        
        Args:
            ppt_id (str): ID of the PowerPoint
            user_id (str): ID of the user
            file_name (str): Name of the PowerPoint file
            blob_url (str): URL of the PowerPoint file in blob storage
            timestamp (str): Timestamp of the message
            error_msg (str): Error message
        """
        try:
            # First check if document exists
            try:
                item = self.cosmos_container.read_item(item=ppt_id, partition_key=user_id)
            except:
                # Create new document if it doesn't exist
                item = {
                    "id": ppt_id,
                    "userId": user_id,
                    "type": "outboxEntry",
                    "createdAt": timestamp,
                    "fileName": file_name,
                    "blobUrl": blob_url,
                    "messageType": "PowerPointUploaded"
                }
            
            # Update with failure information
            process_type = "image" if self.extractor_type == "image" else "script"
            
            # Only update the fields relevant to this extractor
            item.update({
                f"{process_type}ProcessingStatus": "Failed",
                f"{process_type}ProcessingError": error_msg,
                f"{process_type}ProcessingErrorAt": datetime.utcnow().isoformat(),
            })
            
            # Add extraction results if available
            if self.extraction_results:
                item[f"{process_type}ExtractionResults"] = self.extraction_results
            
            # Check if both extractors have failed
            if (item.get("imageProcessingStatus") == "Failed" and 
                item.get("scriptProcessingStatus") == "Failed"):
                item.update({
                    "status": "Failed",
                    "failedAt": datetime.utcnow().isoformat(),
                    "errorDetails": error_msg
                })
            
            self.cosmos_container.upsert_item(body=item)
            logger.info(f"Recorded {process_type} failure in CosmosDB for presentation: {ppt_id}")
            
        except Exception as cosmos_error:
            logger.error(f"Failed to record failure in CosmosDB: {str(cosmos_error)}")
    
    def log_extraction(self, ppt_id, file_name, user_id, timestamp):
        """Log the content extraction to Cosmos DB
        
        Args:
            ppt_id (str): ID of the PowerPoint
            file_name (str): Name of the PowerPoint file
            user_id (str): ID of the user
            timestamp (str): Timestamp of the message
        """
        logger.info(f"Logging {self.extractor_type} extraction for presentation: {ppt_id}")
        
        try:
            # First, try to get the existing document if it exists
            try:
                item = self.cosmos_container.read_item(item=ppt_id, partition_key=user_id)
                logger.info(f"Found existing document for presentation: {ppt_id}")
            except Exception as e:
                logger.info(f"Document not found, creating new: {str(e)}")
                # Create a new document with initial state
                item = {
                    "id": ppt_id,
                    "userId": user_id,
                    "type": "outboxEntry",
                    "status": "Processing",
                    "createdAt": timestamp or datetime.utcnow().isoformat(),
                    "fileName": file_name,
                    "blobUrl": f"https://{self.blob_endpoint}/{self.blob_container_name}/{ppt_id}",
                    "messageType": "PowerPointUploaded",
                    "ttl": 7 * 24 * 60 * 60,  # 7 days in seconds
                    "slides": [],
                    "imageProcessingStatus": "Pending" if self.extractor_type == "script" else None,
                    "scriptProcessingStatus": "Pending" if self.extractor_type == "image" else None
                }
            
            # Call the extractor-specific method to update the document
            self._update_extraction_data(item, ppt_id)
            
            # Update overall status if both extractors have completed
            if self.extractor_type == "image":
                item["imageProcessingStatus"] = "Completed"
                item["imageProcessedAt"] = datetime.utcnow().isoformat()
                
                if item.get("scriptProcessingStatus") == "Completed":
                    item["status"] = "Completed"
                    item["completedAt"] = datetime.utcnow().isoformat()
                
            elif self.extractor_type == "script":
                item["scriptProcessingStatus"] = "Completed"
                item["scriptProcessedAt"] = datetime.utcnow().isoformat()
                
                if item.get("imageProcessingStatus") == "Completed":
                    item["status"] = "Completed"
                    item["completedAt"] = datetime.utcnow().isoformat()
            
            # Add extraction results if available
            if self.extraction_results:
                item[f"{self.extractor_type}ExtractionDetails"] = self.extraction_results
            
            # Save the updated document back to CosmosDB
            self.cosmos_container.upsert_item(body=item)
            logger.info(f"Successfully updated document for {self.extractor_type} extraction: {ppt_id}")
            
        except Exception as e:
            logger.error(f"Critical error updating CosmosDB: {str(e)}")
            raise
    
    @abstractmethod
    def extract_images(self, ppt_id, presentation):
        """Extract images from PowerPoint presentation - to be implemented by ImageExtractor"""
        pass
    
    @abstractmethod
    def extract_scripts(self, ppt_id, presentation):
        """Extract scripts from PowerPoint presentation - to be implemented by ScriptExtractor"""
        pass
    
    @abstractmethod
    def _update_extraction_data(self, item, ppt_id):
        """Update extraction data in the Cosmos DB document - to be implemented by derived classes"""
        pass