from pydantic import BaseModel, Field # type: ignore
from typing import List, Optional
from datetime import datetime

class VideoSummary(BaseModel):
    """Summary of a video"""
    video_id: str = Field(alias="videoId")

    class Config:
        populate_by_name = True
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }

class PowerPointSummary(BaseModel):
    """Summary of a PowerPoint presentation"""
    ppt_id: str = Field(alias="pptId")
    filename: str
    videos: List[VideoSummary] = Field(default_factory=list)

    class Config:
        populate_by_name = True
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }

class User(BaseModel):
    """User model for the application"""
    id: str
    username: str
    email: str
    powerpoints: List[PowerPointSummary] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow, alias="createdAt")

    class Config:
        populate_by_name = True
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }