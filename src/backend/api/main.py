# api/main.py
import uvicorn  # type: ignore
from datetime import datetime
from contextlib import asynccontextmanager
from fastapi import FastAPI # type: ignore
from fastapi.middleware.cors import CORSMiddleware # type: ignore

# Import common modules
from common.services.blob_storage import BlobStorageService
from common.services.service_bus import ServiceBusService
from common.services.cosmos_db import CosmosDBService
from common.utils.config import Settings
from common.utils.logging import setup_logging

# Import routers
from api.routes import powerpoint
from api.routes import websocket
from api.routes import user  # Add this import
from api.websocket.manager import PowerPointProgressManager

# Initialize settings
settings = Settings()

# Setup logging
logger = setup_logging("api")

# Global services (will be set in lifespan)
blob_service = None
service_bus_service = None
cosmos_service = None
progress_manager = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown events"""
    # Startup
    logger.info("Starting up PowerPoint Processing API...")
    
    global blob_service, service_bus_service, cosmos_service, progress_manager
    
    # Initialize services
    blob_service = BlobStorageService(settings.storage_account_url)
    service_bus_service = ServiceBusService(settings.service_bus_fqdn)
    cosmos_service = CosmosDBService(
        settings.cosmos_db_endpoint,
        settings.cosmos_db_database_name,
    )
    
    # Initialize WebSocket progress manager
    progress_manager = PowerPointProgressManager(cosmos_service)
    
    # Set services in app state for access in routes
    app.state.blob_service = blob_service
    app.state.service_bus_service = service_bus_service
    app.state.cosmos_service = cosmos_service
    app.state.settings = settings
    app.state.progress_manager = progress_manager
    
    # Make progress manager available to websocket routes
    websocket.progress_manager = progress_manager
    
    logger.info("Services initialized successfully")
    
    yield
    
    # Shutdown
    logger.info("Shutting down PowerPoint Processing API...")
    
    try:
        # Close WebSocket manager first
        if progress_manager:
            await progress_manager.close()
            
        if service_bus_service:
            await service_bus_service.close()
        if cosmos_service:
            await cosmos_service.close() 
        if blob_service:
            await blob_service.close()
        logger.info("All services closed successfully")
    except Exception as e:
        logger.error(f"Error during shutdown: {e}")


# Initialize FastAPI app with lifespan
app = FastAPI(
    title="PowerPoint Processing API",
    description="API for processing PowerPoint files and generating videos",
    version="1.0.0",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure this properly for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers with /api prefix
app.include_router(powerpoint.router, prefix="/api", tags=["PowerPoint"])
app.include_router(user.router, prefix="/api", tags=["User"]) 
app.include_router(websocket.router, prefix="/api", tags=["WebSocket"])

@app.get("/health")
async def health_check():
    """Basic health check endpoint"""
    return {
        "status": "healthy", 
        "timestamp": datetime.utcnow().isoformat(),
        "service": "PowerPoint Processing API"
    }

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "PowerPoint Processing API",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
        "api_prefix": "/api"
    }


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host='0.0.0.0',
        port='3100',
    )