class PPTProcessingError(Exception):
    """Base exception for PPT processing errors"""
    pass


class BlobStorageError(PPTProcessingError):
    """Exception raised for blob storage errors"""
    pass


class ServiceBusError(PPTProcessingError):
    """Exception raised for service bus errors"""
    pass


class CosmosDBError(PPTProcessingError):
    """Exception raised for Cosmos DB errors"""
    pass


class FileValidationError(PPTProcessingError):
    """Exception raised for file validation errors"""
    pass

class PowerPointNotFoundError(PPTProcessingError):
    """Exception raised when a PowerPoint file is not found in the storage"""