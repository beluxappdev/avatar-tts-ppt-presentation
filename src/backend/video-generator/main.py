from common.services.base_service import run_service
from video_generator import VideoGeneratorService
from common.utils.config import Settings

if __name__ == "__main__":
    settings = Settings()
    service = VideoGeneratorService(settings)
    run_service(service)