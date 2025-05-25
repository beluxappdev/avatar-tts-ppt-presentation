import asyncio
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Set
from fastapi import WebSocket
from common.models.powerpoint import PowerPointModel
from common.services.cosmos_db import CosmosDBService

logger = logging.getLogger(__name__)


class PowerPointProgressManager:
    def __init__(self, cosmos_service: CosmosDBService):
        self.cosmos_service = cosmos_service
        self.active_connections: Dict[str, List[WebSocket]] = {}  # ppt_id -> [websockets]
        self.last_states: Dict[str, dict] = {}  # ppt_id -> last_known_state
        self.user_mapping: Dict[str, str] = {}  # ppt_id -> user_id
        self.polling_task: Optional[asyncio.Task] = None
        self.is_polling = False
        
    async def connect(self, websocket: WebSocket, ppt_id: str, user_id: str):
        """Connect a WebSocket for a specific PowerPoint ID"""
        await websocket.accept()
        
        if ppt_id not in self.active_connections:
            self.active_connections[ppt_id] = []
            
        self.active_connections[ppt_id].append(websocket)
        self.user_mapping[ppt_id] = user_id
        
        logger.info(f"WebSocket connected for PPT {ppt_id}, total connections: {len(self.active_connections[ppt_id])}")
        
        # Send current state immediately upon connection
        await self._send_current_state(ppt_id)
        
        # Start polling if this is the first connection
        if not self.is_polling:
            await self._start_polling()
    
    async def disconnect(self, websocket: WebSocket, ppt_id: str):
        """Disconnect a WebSocket"""
        if ppt_id in self.active_connections:
            try:
                self.active_connections[ppt_id].remove(websocket)
                logger.info(f"WebSocket disconnected for PPT {ppt_id}")
                
                # Clean up if no more connections for this PPT
                if not self.active_connections[ppt_id]:
                    del self.active_connections[ppt_id]
                    if ppt_id in self.last_states:
                        del self.last_states[ppt_id]
                    if ppt_id in self.user_mapping:
                        del self.user_mapping[ppt_id]
                    logger.info(f"Cleaned up tracking for PPT {ppt_id}")
                
                # Stop polling if no active connections
                if not self.active_connections and self.is_polling:
                    await self._stop_polling()
                    
            except ValueError:
                # WebSocket was already removed
                pass
    
    async def _send_current_state(self, ppt_id: str):
        """Send the current state of a PowerPoint to connected clients"""
        try:
            user_id = self.user_mapping.get(ppt_id)
            if not user_id:
                return
                
            record_data = await self.cosmos_service.get_powerpoint_record(ppt_id, user_id)
            if not record_data:
                return
                
            powerpoint_record, _ = record_data
            current_state = self._extract_progress_state(powerpoint_record)
            
            # Store current state
            self.last_states[ppt_id] = current_state
            
            # Send to all connected clients for this PPT
            message = {
                "type": "progress_update",
                "ppt_id": ppt_id,
                "timestamp": datetime.utcnow().isoformat(),
                "data": current_state
            }
            
            await self._send_to_connections(ppt_id, message)
            
        except Exception as e:
            logger.error(f"Error sending current state for PPT {ppt_id}: {e}")
    
    async def _start_polling(self):
        """Start the database polling task"""
        if not self.is_polling:
            self.is_polling = True
            self.polling_task = asyncio.create_task(self._poll_database())
            logger.info("Started database polling for PowerPoint progress")
    
    async def _stop_polling(self):
        """Stop the database polling task"""
        if self.is_polling and self.polling_task:
            self.is_polling = False
            self.polling_task.cancel()
            try:
                await self.polling_task
            except asyncio.CancelledError:
                pass
            logger.info("Stopped database polling for PowerPoint progress")
    
    async def _poll_database(self):
        """Background task that polls Cosmos DB for PowerPoint updates"""
        while self.is_polling:
            try:
                # Check each active PowerPoint
                for ppt_id in list(self.active_connections.keys()):
                    await self._check_powerpoint_updates(ppt_id)
                    
            except Exception as e:
                logger.error(f"Error in database polling: {e}")
            
            # Wait 2 seconds before next poll
            await asyncio.sleep(2)
    
    async def _check_powerpoint_updates(self, ppt_id: str):
        """Check for updates on a specific PowerPoint"""
        try:
            user_id = self.user_mapping.get(ppt_id)
            if not user_id:
                return
                
            record_data = await self.cosmos_service.get_powerpoint_record(ppt_id, user_id)
            if not record_data:
                return
                
            powerpoint_record, _ = record_data
            current_state = self._extract_progress_state(powerpoint_record)
            
            # Compare with last known state
            last_state = self.last_states.get(ppt_id, {})
            
            if current_state != last_state:
                logger.info(f"State change detected for PPT {ppt_id}")
                
                # Update stored state
                self.last_states[ppt_id] = current_state
                
                # Send update to connected clients
                message = {
                    "type": "progress_update",
                    "ppt_id": ppt_id,
                    "timestamp": datetime.utcnow().isoformat(),
                    "data": current_state,
                    "changes": self._get_changes(last_state, current_state)
                }
                
                await self._send_to_connections(ppt_id, message)
                
        except Exception as e:
            logger.error(f"Error checking updates for PPT {ppt_id}: {e}")
    
    def _extract_progress_state(self, powerpoint_record: PowerPointModel) -> dict:
        """Extract the current progress state from PowerPoint record"""
        state = {
            "ppt_id": powerpoint_record.id,
            "user_id": powerpoint_record.user_id,
            "file_name": powerpoint_record.file_name,
            "blob_storage_status": powerpoint_record.blob_storage_status.status if powerpoint_record.blob_storage_status else None,
            "image_extraction_status": powerpoint_record.image_extraction_status.status if powerpoint_record.image_extraction_status else None,
            "script_extraction_status": powerpoint_record.script_extraction_status.status if powerpoint_record.script_extraction_status else None,
            "video_information": []
        }
        
        # Extract video information
        if powerpoint_record.video_information:
            for video_info in powerpoint_record.video_information:
                video_data = {
                    "video_id": video_info.video_id,
                    "status": video_info.status.model_dump() if video_info.status else None,
                    "generation_status": video_info.generation_status.model_dump() if video_info.generation_status else None,
                    "transformation_status": video_info.transformation_status.model_dump() if video_info.transformation_status else None,
                    "slides": []
                }
                
                # Extract slide information
                if video_info.slides:
                    for slide in video_info.slides:
                        slide_data = {
                            "index": slide.index,
                            "status": slide.status.model_dump() if slide.status else None,
                            "generation_status": slide.generation_status.model_dump() if slide.generation_status else None,
                            "transformation_status": slide.transformation_status.model_dump() if slide.transformation_status else None,
                            "blob_url": slide.blob_url
                        }
                        video_data["slides"].append(slide_data)
                
                state["video_information"].append(video_data)
        
        return state
    
    def _get_changes(self, old_state: dict, new_state: dict) -> dict:
        """Identify what changed between states"""
        changes = {}
        
        # Simple comparison - you can make this more sophisticated
        for key in new_state:
            if key not in old_state or old_state[key] != new_state[key]:
                changes[key] = {
                    "old": old_state.get(key),
                    "new": new_state[key]
                }
        
        return changes
    
    async def _send_to_connections(self, ppt_id: str, message: dict):
        """Send message to all connections for a PowerPoint"""
        if ppt_id not in self.active_connections:
            return
            
        dead_connections = []
        
        for websocket in self.active_connections[ppt_id]:
            try:
                await websocket.send_text(json.dumps(message))
            except Exception as e:
                logger.error(f"Error sending message to WebSocket: {e}")
                dead_connections.append(websocket)
        
        # Clean up dead connections
        for dead_ws in dead_connections:
            await self.disconnect(dead_ws, ppt_id)
    
    async def close(self):
        """Close all connections and stop polling"""
        await self._stop_polling()
        
        # Close all WebSocket connections
        for ppt_id, connections in self.active_connections.items():
            for websocket in connections:
                try:
                    await websocket.close()
                except:
                    pass
        
        self.active_connections.clear()
        self.last_states.clear()
        self.user_mapping.clear()