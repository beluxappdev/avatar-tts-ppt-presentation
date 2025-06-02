from common.services.base_service import run_service
from image_extractor import ImageExtractorService
from common.utils.config import Settings

if __name__ == "__main__":
    settings = Settings()
    service = ImageExtractorService(settings)
    run_service(service)