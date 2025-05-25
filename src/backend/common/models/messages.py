from pydantic import BaseModel, Field # type: ignore
from datetime import datetime
from typing import Optional

class ExtractionMessage(BaseModel):
    ppt_id: str
    user_id: str
    file_name: str
    blob_url: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }

class VideoGenerationMessage(BaseModel):
    ppt_id: str
    user_id: str
    video_id: str
    index: str
    script: str
    show_avatar: bool
    avatar_persona: str
    avatar_position: str
    avatar_size: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }

class VideoTransformationMessage(BaseModel):
    ppt_id: str
    user_id: str
    video_id: str
    index: str
    show_avatar: bool
    avatar_persona: str
    avatar_position: str
    avatar_size: str
    avatar_video_url: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }