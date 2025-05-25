from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Request, HTTPException
from fastapi.websockets import WebSocketState
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

# Global progress manager (will be set in main.py)
progress_manager = None


@router.websocket("/ws/powerpoint/{ppt_id}/user/{user_id}")
async def powerpoint_progress_websocket(websocket: WebSocket, ppt_id: str, user_id: str):
    """
    WebSocket endpoint for PowerPoint progress updates
    
    Args:
        websocket: WebSocket connection
        ppt_id: PowerPoint ID to track
        user_id: User ID (for security and data access)
    """
    global progress_manager
    
    if not progress_manager:
        await websocket.close(code=1011, reason="Service not available")
        return
    
    try:
        # Verify the PowerPoint record exists and belongs to the user
        cosmos_service = progress_manager.cosmos_service
        record_data = await cosmos_service.get_powerpoint_record(ppt_id, user_id)
        
        if not record_data:
            await websocket.close(code=1008, reason="PowerPoint not found or access denied")
            return
        
        # Connect to progress manager
        await progress_manager.connect(websocket, ppt_id, user_id)
        
        # Keep connection alive and handle client messages
        while True:
            try:
                # Wait for client messages (like ping/pong for keep-alive)
                data = await websocket.receive_text()
                
                # Handle ping/pong or other client messages
                if data == "ping":
                    await websocket.send_text("pong")
                    
            except WebSocketDisconnect:
                break
            except Exception as e:
                logger.error(f"Error in WebSocket loop: {e}")
                break
                
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for PPT {ppt_id}")
    except Exception as e:
        logger.error(f"Error in WebSocket connection for PPT {ppt_id}: {e}")
    finally:
        # Ensure cleanup happens
        if progress_manager:
            await progress_manager.disconnect(websocket, ppt_id)


@router.get("/powerpoint/{ppt_id}/status")
async def get_powerpoint_status(request: Request, ppt_id: str, user_id: str):
    """
    REST endpoint to get current PowerPoint status
    
    Args:
        request: FastAPI request object
        ppt_id: PowerPoint ID
        user_id: User ID
    """
    try:
        cosmos_service = request.app.state.cosmos_service
        record_data = await cosmos_service.get_powerpoint_record(ppt_id, user_id)
        
        if not record_data:
            raise HTTPException(status_code=404, detail="PowerPoint not found")
        
        powerpoint_record, _ = record_data
        
        # Use the same state extraction logic as the WebSocket manager
        if progress_manager:
            current_state = progress_manager._extract_progress_state(powerpoint_record)
        else:
            # Fallback if WebSocket manager is not available
            current_state = {
                "ppt_id": powerpoint_record.id,
                "user_id": powerpoint_record.user_id,
                "file_name": powerpoint_record.file_name,
                "blob_storage_status": powerpoint_record.blob_storage_status.status if powerpoint_record.blob_storage_status else None,
                "image_extraction_status": powerpoint_record.image_extraction_status.status if powerpoint_record.image_extraction_status else None,
                "script_extraction_status": powerpoint_record.script_extraction_status.status if powerpoint_record.script_extraction_status else None,
            }
        
        return {
            "status": "success",
            "data": current_state,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting PowerPoint status: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")