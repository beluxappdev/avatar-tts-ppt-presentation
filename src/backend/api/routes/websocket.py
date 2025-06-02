from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Request, HTTPException # type: ignore
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


@router.websocket("/ws/powerpoint/{ppt_id}/video/{video_id}/user/{user_id}")
async def video_progress_websocket(websocket: WebSocket, ppt_id: str, video_id: str, user_id: str):
    """
    WebSocket endpoint for video-specific progress updates
    
    Args:
        websocket: WebSocket connection
        ppt_id: PowerPoint ID to track
        video_id: Video ID to track within the PowerPoint
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
        
        # Verify the video exists within the PowerPoint
        powerpoint_record, _ = record_data
        video_exists = False
        if powerpoint_record.video_information:
            video_exists = any(video.video_id == video_id for video in powerpoint_record.video_information)
        
        if not video_exists:
            await websocket.close(code=1008, reason="Video not found in PowerPoint")
            return
        
        # Connect to progress manager with video ID
        await progress_manager.connect(websocket, ppt_id, user_id, video_id)
        
        # Keep connection alive and handle client messages
        while True:
            try:
                # Wait for client messages (like ping/pong for keep-alive)
                data = await websocket.receive_text()
                
                # Handle ping/pong or other client messages
                if data == "ping":
                    await websocket.send_text("pong")
                elif data == "get_status":
                    # Send current video status
                    await progress_manager._send_current_state(ppt_id, video_id)
                    
            except WebSocketDisconnect:
                break
            except Exception as e:
                logger.error(f"Error in video WebSocket loop: {e}")
                break
                
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for PPT {ppt_id}, Video {video_id}")
    except Exception as e:
        logger.error(f"Error in video WebSocket connection for PPT {ppt_id}, Video {video_id}: {e}")
    finally:
        # Ensure cleanup happens
        if progress_manager:
            await progress_manager.disconnect(websocket, ppt_id, video_id)


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
                "video_information": []
            }
            
            # Add video information if available
            if powerpoint_record.video_information:
                for video_info in powerpoint_record.video_information:
                    video_data = {
                        "video_id": video_info.video_id,
                        "status": video_info.status.model_dump() if video_info.status else None,
                        "video_url": video_info.video_url,
                        "total_slides": video_info.total_slides,
                        "completed_slides": video_info.completed_slides,
                        "progress_percentage": round((video_info.completed_slides / video_info.total_slides) * 100, 2) if video_info.total_slides > 0 else 0.0
                    }
                    current_state["video_information"].append(video_data)
        
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


@router.get("/powerpoint/{ppt_id}/video/{video_id}/status")
async def get_video_status(request: Request, ppt_id: str, video_id: str, user_id: str):
    """
    REST endpoint to get current video status within a PowerPoint
    
    Args:
        request: FastAPI request object
        ppt_id: PowerPoint ID
        video_id: Video ID within the PowerPoint
        user_id: User ID
    """
    try:
        cosmos_service = request.app.state.cosmos_service
        record_data = await cosmos_service.get_powerpoint_record(ppt_id, user_id)
        
        if not record_data:
            raise HTTPException(status_code=404, detail="PowerPoint not found")
        
        powerpoint_record, _ = record_data
        
        # Find the specific video
        video_state = None
        if progress_manager:
            video_state = progress_manager._extract_video_state(powerpoint_record, video_id)
        else:
            # Fallback if WebSocket manager is not available
            if powerpoint_record.video_information:
                for video_info in powerpoint_record.video_information:
                    if video_info.video_id == video_id:
                        video_state = {
                            "video_id": video_info.video_id,
                            "status": video_info.status.model_dump() if video_info.status else None,
                            "video_url": video_info.video_url,
                            "total_slides": video_info.total_slides,
                            "completed_slides": video_info.completed_slides,
                            "progress_percentage": round((video_info.completed_slides / video_info.total_slides) * 100, 2) if video_info.total_slides > 0 else 0.0
                        }
                        break
        
        if not video_state:
            raise HTTPException(status_code=404, detail="Video not found in PowerPoint")
        
        return {
            "status": "success",
            "data": video_state,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting video status: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/powerpoint/{ppt_id}/videos")
async def get_all_videos_status(request: Request, ppt_id: str, user_id: str):
    """
    REST endpoint to get status of all videos within a PowerPoint
    
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
        
        videos_status = []
        if powerpoint_record.video_information:
            for video_info in powerpoint_record.video_information:
                video_data = {
                    "video_id": video_info.video_id,
                    "status": video_info.status.model_dump() if video_info.status else None,
                    "video_url": video_info.video_url,
                    "total_slides": video_info.total_slides,
                    "completed_slides": video_info.completed_slides,
                    "progress_percentage": round((video_info.completed_slides / video_info.total_slides) * 100, 2) if video_info.total_slides > 0 else 0.0
                }
                videos_status.append(video_data)
        
        return {
            "status": "success",
            "data": {
                "ppt_id": ppt_id,
                "total_videos": len(videos_status),
                "videos": videos_status
            },
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting videos status: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")