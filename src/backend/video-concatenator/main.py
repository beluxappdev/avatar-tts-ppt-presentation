from common.services.base_service import run_service
from video_concatenator import VideoConcatenator
from common.utils.config import Settings

if __name__ == "__main__":
    settings = Settings()
    service = VideoConcatenator(settings)
    run_service(service)