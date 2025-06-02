from common.models.service_config import ServiceConfig

# Service configurations
SERVICE_CONFIGS = {
    'video_generator': ServiceConfig(
        name="Video Generator Service",
        service_class=None,  # Will be set by each service
    ),
    
    'image_extractor': ServiceConfig(
        name="Image Extractor Service",
        service_class=None,
    ),
    
    'script_extractor': ServiceConfig(
        name="Script Extractor Service", 
        service_class=None,
    )
}
