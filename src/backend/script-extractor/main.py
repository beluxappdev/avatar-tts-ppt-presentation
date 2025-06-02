from common.services.base_service import run_service
from script_extractor import ScriptExtractorService
from common.utils.config import Settings

if __name__ == "__main__":
    settings = Settings()
    service = ScriptExtractorService(settings)
    run_service(service)
