from pydantic import BaseModel, Field # type: ignore
from typing import List
from datetime import datetime

class AvatarConfigModel(BaseModel):
    """Configuration for avatar generation"""
    show_avatar: bool = Field(alias="showAvatar")
    avatar_persona: str = Field(alias="avatarPersona")
    avatar_position: str = Field(alias="avatarPosition")
    avatar_size: str = Field(alias="avatarSize")

    class Config:
        populate_by_name = True
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }

class SlideVideoConfigModel(BaseModel):
    """Configuration for slide video generation"""
    index: str
    script: str
    avatar_config: AvatarConfigModel = Field(alias="avatarConfig")

    class Config:
        populate_by_name = True
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }

class VideoGenerationRequestModel(BaseModel):
    """Model for video generation request"""
    ppt_id: str = Field(alias="pptId")
    user_id: str = Field(alias="userId")
    slides_config: List[SlideVideoConfigModel] = Field(alias="slidesConfig")

    class Config:
        populate_by_name = True
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }