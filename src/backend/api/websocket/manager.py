import asyncio
import json
import logging
from datetime import datetime
from typing import Dict, List, Optional
from fastapi import WebSocket # type: ignore
from common.models.powerpoint import PowerPointModel
from common.services.cosmos_db import CosmosDBService

logger = logging.getLogger(__name__)


class PowerPointProgressManager:
    def __init__(self, cosmos_service: CosmosDBService):
        self.cosmos_service = cosmos_service
        self.active_connections: Dict[str, List[WebSocket]] = {}  # ppt_id -> [websockets]
        self.last_states: Dict[str, dict] = {}  # ppt_id -> last_known_state
        self.user_mapping: Dict[str, str] = {}  # ppt_id -> user_id
        # Track video-specific connections and states - using ||| as separator to avoid conflicts
        self.video_connections: Dict[str, List[WebSocket]] = {}  # f"{ppt_id}|||{video_id}" -> [websockets]
        self.video_states: Dict[str, dict] = {}  # f"{ppt_id}|||{video_id}" -> last_video_state
        self.polling_task: Optional[asyncio.Task] = None
        self.is_polling = False
        
    async def connect(self, websocket: WebSocket, ppt_id: str, user_id: str, video_id: str = None):
        """Connect a WebSocket for a specific PowerPoint ID and optionally video ID"""
        await websocket.accept()
        
        if ppt_id not in self.active_connections:
            self.active_connections[ppt_id] = []
            
        self.active_connections[ppt_id].append(websocket)
        self.user_mapping[ppt_id] = user_id
        
        # Handle video-specific connections
        if video_id:
            video_key = f"{ppt_id}|||{video_id}"
            if video_key not in self.video_connections:
                self.video_connections[video_key] = []
            self.video_connections[video_key].append(websocket)
            logger.info(f"WebSocket connected for PPT {ppt_id}, Video {video_id}")
        else:
            logger.info(f"WebSocket connected for PPT {ppt_id}")
        
        # Send current state immediately upon connection
        await self._send_current_state(ppt_id, video_id)
        
        # Start polling if this is the first connection
        if not self.is_polling:
            await self._start_polling()
    
    async def disconnect(self, websocket: WebSocket, ppt_id: str, video_id: str = None):
        """Disconnect a WebSocket"""
        if ppt_id in self.active_connections:
            try:
                self.active_connections[ppt_id].remove(websocket)
                logger.info(f"WebSocket disconnected for PPT {ppt_id}")
                
                # Handle video-specific disconnections
                if video_id:
                    video_key = f"{ppt_id}|||{video_id}"
                    if video_key in self.video_connections:
                        try:
                            self.video_connections[video_key].remove(websocket)
                            if not self.video_connections[video_key]:
                                del self.video_connections[video_key]
                                if video_key in self.video_states:
                                    del self.video_states[video_key]
                        except ValueError:
                            pass
                
                # Clean up if no more connections for this PPT
                if not self.active_connections[ppt_id]:
                    del self.active_connections[ppt_id]
                    if ppt_id in self.last_states:
                        del self.last_states[ppt_id]
                    if ppt_id in self.user_mapping:
                        del self.user_mapping[ppt_id]
                    logger.info(f"Cleaned up tracking for PPT {ppt_id}")
                
                # Stop polling if no active connections
                if not self.active_connections and not self.video_connections and self.is_polling:
                    await self._stop_polling()
                    
            except ValueError:
                # WebSocket was already removed
                pass
    
    async def _send_current_state(self, ppt_id: str, video_id: str = None):
        """Send the current state of a PowerPoint to connected clients"""
        try:
            user_id = self.user_mapping.get(ppt_id)
            if not user_id:
                logger.warning(f"No user_id found for ppt_id: {ppt_id}")
                return
                
            record_data = await self.cosmos_service.get_powerpoint_record(ppt_id, user_id)
            if not record_data:
                logger.warning(f"No record found for ppt_id: {ppt_id}, user_id: {user_id}")
                return
                
            powerpoint_record, _ = record_data
            
            if video_id:
                # Send video-specific state
                video_state = self._extract_video_state(powerpoint_record, video_id)
                if video_state:
                    video_key = f"{ppt_id}|||{video_id}"
                    self.video_states[video_key] = video_state
                    
                    message = {
                        "type": "video_progress_update",
                        "ppt_id": ppt_id,
                        "video_id": video_id,
                        "timestamp": datetime.utcnow().isoformat(),
                        "data": video_state
                    }
                    
                    await self._send_to_video_connections(video_key, message)
                    logger.info(f"Sent current video state for PPT {ppt_id}, Video {video_id}")
                else:
                    logger.warning(f"No video state found for video_id: {video_id} in PPT {ppt_id}")
            else:
                # Send general PowerPoint state
                current_state = self._extract_progress_state(powerpoint_record)
                self.last_states[ppt_id] = current_state
                
                message = {
                    "type": "progress_update",
                    "ppt_id": ppt_id,
                    "timestamp": datetime.utcnow().isoformat(),
                    "data": current_state
                }
                
                await self._send_to_connections(ppt_id, message)
            
        except Exception as e:
            logger.error(f"Error sending current state for PPT {ppt_id}, Video {video_id}: {e}")
    
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
                
                # Check video-specific updates
                for video_key in list(self.video_connections.keys()):
                    if '|||' in video_key:
                        ppt_id, video_id = video_key.split('|||', 1)
                        await self._check_video_updates(ppt_id, video_id)
                    else:
                        logger.warning(f"Invalid video_key format: {video_key}")
                    
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
    
    async def _check_video_updates(self, ppt_id: str, video_id: str):
        """Check for updates on a specific video within a PowerPoint"""
        try:
            user_id = self.user_mapping.get(ppt_id)
            if not user_id:
                logger.warning(f"No user_id found for ppt_id: {ppt_id}")
                return
                
            record_data = await self.cosmos_service.get_powerpoint_record(ppt_id, user_id)
            if not record_data:
                logger.warning(f"No record found for ppt_id: {ppt_id}")
                return
                
            powerpoint_record, _ = record_data
            current_video_state = self._extract_video_state(powerpoint_record, video_id)
            
            if not current_video_state:
                logger.warning(f"No video state found for video_id: {video_id}")
                return
                
            video_key = f"{ppt_id}|||{video_id}"
            last_video_state = self.video_states.get(video_key, {})
            
            # Check if video state changed, particularly completedSlides
            if current_video_state != last_video_state:
                logger.info(f"Video state change detected for PPT {ppt_id}, Video {video_id}")
                logger.debug(f"Old state: {last_video_state}")
                logger.debug(f"New state: {current_video_state}")
                
                # Check specifically for completedSlides changes
                completed_slides_changed = (
                    last_video_state.get('completed_slides') != current_video_state.get('completed_slides')
                )
                
                # Update stored state
                self.video_states[video_key] = current_video_state
                
                # Prepare message
                message = {
                    "type": "video_progress_update",
                    "ppt_id": ppt_id,
                    "video_id": video_id,
                    "timestamp": datetime.utcnow().isoformat(),
                    "data": current_video_state,
                    "changes": self._get_video_changes(last_video_state, current_video_state),
                    "completed_slides_changed": completed_slides_changed
                }
                
                # Send update to video-specific connections
                await self._send_to_video_connections(video_key, message)
                
                # Also send to general PowerPoint connections if completedSlides changed
                if completed_slides_changed:
                    general_message = {
                        "type": "video_slides_completed_update",
                        "ppt_id": ppt_id,
                        "video_id": video_id,
                        "timestamp": datetime.utcnow().isoformat(),
                        "completed_slides": current_video_state.get('completed_slides'),
                        "total_slides": current_video_state.get('total_slides'),
                        "progress_percentage": self._calculate_progress_percentage(current_video_state)
                    }
                    await self._send_to_connections(ppt_id, general_message)
                
        except Exception as e:
            logger.error(f"Error checking video updates for PPT {ppt_id}, Video {video_id}: {e}")
    
    def _extract_video_state(self, powerpoint_record: PowerPointModel, video_id: str) -> Optional[dict]:
        """Extract the current state of a specific video from PowerPoint record"""
        try:
            if not powerpoint_record.video_information:
                logger.debug(f"No video_information found in PowerPoint record {powerpoint_record.id}")
                return None
                
            for video_info in powerpoint_record.video_information:
                if video_info.video_id == video_id:
                    video_state = {
                        "video_id": video_info.video_id,
                        "status": self._serialize_status(video_info.status) if video_info.status else None,
                        "video_url": video_info.video_url,
                        "total_slides": video_info.total_slides,
                        "completed_slides": video_info.completed_slides,
                        "slides": []
                    }
                    
                    # Extract individual slide information
                    if video_info.slides:
                        for slide in video_info.slides:
                            slide_data = {
                                "index": slide.index,
                                "status": self._serialize_status(slide.status) if slide.status else None,
                                "generation_status": self._serialize_status(slide.generation_status) if slide.generation_status else None,
                                "transformation_status": self._serialize_status(slide.transformation_status) if slide.transformation_status else None,
                                "video_url": slide.video_url
                            }
                            video_state["slides"].append(slide_data)
                    
                    logger.debug(f"Extracted video state for {video_id}: {video_state}")
                    return video_state
            
            logger.debug(f"Video {video_id} not found in PowerPoint record {powerpoint_record.id}")
            return None
            
        except Exception as e:
            logger.error(f"Error extracting video state for {video_id}: {e}")
            return None
    
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
        
        # Extract video information with summary
        if powerpoint_record.video_information:
            for video_info in powerpoint_record.video_information:
                video_data = {
                    "video_id": video_info.video_id,
                    "status": self._serialize_status(video_info.status) if video_info.status else None,
                    "video_url": video_info.video_url,
                    "total_slides": video_info.total_slides,
                    "completed_slides": video_info.completed_slides,
                    "progress_percentage": self._calculate_progress_percentage({
                        "completed_slides": video_info.completed_slides,
                        "total_slides": video_info.total_slides
                    })
                }
                state["video_information"].append(video_data)
        
        return state
    
    def _serialize_status(self, status_obj) -> dict:
        """Properly serialize StatusInformation object with datetime handling"""
        if not status_obj:
            return None
            
        try:
            # Use model_dump with mode='json' to apply json_encoders
            return status_obj.model_dump(mode='json', by_alias=True)
        except Exception as e:
            logger.error(f"Error serializing status object: {e}")
            # Fallback to manual serialization
            return {
                "status": status_obj.status,
                "createdAt": status_obj.created_at.isoformat() if status_obj.created_at else None,
                "processedAt": status_obj.processed_at.isoformat() if status_obj.processed_at else None,
                "completedAt": status_obj.completed_at.isoformat() if status_obj.completed_at else None,
                "failedAt": status_obj.failed_at.isoformat() if status_obj.failed_at else None,
                "errorMessage": status_obj.error_message
            }
    
    def _calculate_progress_percentage(self, video_state: dict) -> float:
        """Calculate progress percentage for video generation"""
        total_slides = video_state.get('total_slides', 0)
        completed_slides = video_state.get('completed_slides', 0)
        
        if total_slides == 0:
            return 0.0
        
        return round((completed_slides / total_slides) * 100, 2)
    
    def _get_changes(self, old_state: dict, new_state: dict) -> dict:
        """Identify what changed between states"""
        changes = {}
        
        for key in new_state:
            if key not in old_state or old_state[key] != new_state[key]:
                changes[key] = {
                    "old": old_state.get(key),
                    "new": new_state[key]
                }
        
        return changes
    
    def _get_video_changes(self, old_video_state: dict, new_video_state: dict) -> dict:
        """Identify what changed between video states"""
        changes = {}
        
        # Focus on key video properties
        important_keys = ['status', 'completed_slides', 'video_url']
        
        for key in important_keys:
            if key in new_video_state and (key not in old_video_state or old_video_state[key] != new_video_state[key]):
                changes[key] = {
                    "old": old_video_state.get(key),
                    "new": new_video_state[key]
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
                logger.debug(f"Sent message to PPT {ppt_id} connection: {message['type']}")
            except Exception as e:
                logger.error(f"Error sending message to WebSocket: {e}")
                dead_connections.append(websocket)
        
        # Clean up dead connections
        for dead_ws in dead_connections:
            await self.disconnect(dead_ws, ppt_id)
    
    async def _send_to_video_connections(self, video_key: str, message: dict):
        """Send message to all video-specific connections"""
        if video_key not in self.video_connections:
            logger.warning(f"No video connections found for key: {video_key}")
            return
            
        dead_connections = []
        
        for websocket in self.video_connections[video_key]:
            try:
                await websocket.send_text(json.dumps(message))
                logger.info(f"Sent video message to {video_key}: {message['type']}")
            except Exception as e:
                logger.error(f"Error sending message to video WebSocket: {e}")
                dead_connections.append(websocket)
        
        # Clean up dead connections
        for dead_ws in dead_connections:
            if '|||' in video_key:
                ppt_id, video_id = video_key.split('|||', 1)
                await self.disconnect(dead_ws, ppt_id, video_id)
    
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
        
        # Close all video-specific connections
        for video_key, connections in self.video_connections.items():
            for websocket in connections:
                try:
                    await websocket.close()
                except:
                    pass
        
        self.active_connections.clear()
        self.last_states.clear()
        self.user_mapping.clear()
        self.video_connections.clear()
        self.video_states.clear()