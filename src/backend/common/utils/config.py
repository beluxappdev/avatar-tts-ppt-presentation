from pydantic_settings import BaseSettings # type: ignore

class Settings(BaseSettings):
    # Azure Storage
    storage_account_name: str
    blob_container_name: str
    
    # Azure Service Bus
    service_bus_namespace: str
    service_bus_topic_name: str
    service_bus_image_subscription_name: str
    service_bus_script_subscription_name: str
    service_bus_video_generation_queue_name: str
    service_bus_video_transformation_queue_name: str
    service_bus_video_concatenation_queue_name: str
    
    # Azure Cosmos DB
    cosmos_db_endpoint: str
    cosmos_db_database_name: str
    cosmos_db_container_name: str

    # Azure Speech
    speech_endpoint: str
    speech_api_version: str = "2024-04-15-preview"
    
    # API Settings
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    debug: bool = False
    
    @property
    def storage_account_url(self) -> str:
        """Generate the full storage account URL"""
        return f"https://{self.storage_account_name}.blob.core.windows.net"

    @property
    def service_bus_fqdn(self) -> str:
        """Generate the fully qualified domain name for the Service Bus namespace"""
        return f"{self.service_bus_namespace}.servicebus.windows.net"
    
    class Config:
        env_file = ".env"
        case_sensitive = False



