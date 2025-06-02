from pydantic import BaseModel, Field # type: ignore
from typing import List, Optional
from datetime import datetime
from enum import Enum


class StatusEnum(str, Enum):
    PENDING = "Pending"
    PROCESSING = "Processing"
    COMPLETED = "Completed"
    FAILED = "Failed"


class StatusInformation(BaseModel):
    status: str = Field(default=StatusEnum.PENDING)
    created_at: datetime = Field(default_factory=datetime.utcnow, alias="createdAt")
    processed_at: Optional[datetime] = Field(default=None, alias="processedAt")
    completed_at: Optional[datetime] = Field(default=None, alias="completedAt")
    failed_at: Optional[datetime] = Field(default=None, alias="failedAt")
    error_message: Optional[str] = Field(default=None, alias="errorMessage")

    class Config:
        populate_by_name = True
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }


class SlideExtractionModel(BaseModel):
    index: int
    has_image: bool = Field(alias="hasImage")
    has_script: bool = Field(alias="hasScript")
    image_url: Optional[str] = Field(default=None, alias="imageUrl")
    script_url: Optional[str] = Field(default=None, alias="scriptUrl")

    class Config:
        populate_by_name = True


class SlideVideoModel(BaseModel):
    index: str
    status: StatusInformation
    generation_status: StatusInformation
    transformation_status: StatusInformation
    video_url: Optional[str] = Field(default=None, alias="videoUrl")

    class Config:
        populate_by_name = True
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }


class VideoInformationModel(BaseModel):
    video_id: str = Field(alias="videoId")
    status: StatusInformation
    video_url: Optional[str] = Field(default=None, alias="videoUrl")
    total_slides: int = Field(alias="totalSlides")
    completed_slides: int = Field(default=0, alias="completedSlides")
    slides: List[SlideVideoModel] = Field(default_factory=list)

    class Config:
        populate_by_name = True
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }


class PowerPointModel(BaseModel):
    id: str
    user_id: str = Field(alias="userId")
    blob_storage_status: StatusInformation = Field(default_factory=StatusInformation, alias="blobStorageStatus")
    image_extraction_status: StatusInformation = Field(default_factory=StatusInformation, alias="imageExtractionStatus")
    script_extraction_status: StatusInformation = Field(default_factory=StatusInformation, alias="scriptExtractionStatus")
    number_of_slides: int = Field(default=0, alias="numberOfSlides")
    file_name: str = Field(alias="fileName")
    blob_url: Optional[str] = Field(default=None, alias="blobUrl")
    slides: List[SlideExtractionModel] = Field(default_factory=list, alias="slideExtractionModels")
    video_information: List[VideoInformationModel] = Field(default_factory=list, alias="videoInformation")
    ttl: Optional[int] = Field(default=7 * 24 * 60 * 60, alias="timeToLive")  # 7 days in seconds

    @property
    def partition_key(self) -> str:
        """Using UserId as the partition key for Cosmos DB"""
        return self.user_id

    class Config:
        populate_by_name = True
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }