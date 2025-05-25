from common.services.base_service import run_service
from video_transformation import VideoTransformation
from common.utils.config import Settings

if __name__ == "__main__":
    settings = Settings()
    service = VideoTransformation(settings)
    run_service(service)