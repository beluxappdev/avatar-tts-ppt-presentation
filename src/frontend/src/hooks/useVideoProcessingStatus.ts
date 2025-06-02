import { useState, useCallback } from 'react';
import { useWebSocket } from './useWebSocket';
import { API_BASE_URL } from '../config/apiConfig';

interface VideoProgressMessage {
  type: 'video_progress_update';
  video_id: string;
  data: {
    completed_slides: number;
    total_slides: number;
  };
  completed_slides_changed: boolean;
}

interface UseVideoProcessingStatusProps {
  presentationId: string;
  videoId: string;
  userId: string;
}

export const useVideoProcessingStatus = ({ 
  presentationId, 
  videoId, 
  userId 
}: UseVideoProcessingStatusProps) => {
  const [completedVideos, setCompletedVideos] = useState(0);
  const [totalVideos, setTotalVideos] = useState(0);

  const handleWebSocketMessage = useCallback((message: VideoProgressMessage) => {
    console.log('Processing video WebSocket message:', message);
    
    // Handle video progress updates
    if (message.type === 'video_progress_update' && message.video_id === videoId) {
      const { completed_slides, total_slides } = message.data;
      
      if (message.completed_slides_changed) {
        console.log('Completed slides changed!');
        console.log(`Video ${message.video_id} progress:`, completed_slides);
      }
      
      // Update the video progress
      setCompletedVideos(completed_slides);
      setTotalVideos(total_slides);
    }
  }, [videoId]);

  const handleWebSocketError = useCallback((error: Event) => {
    console.error('Video WebSocket connection error:', error);
  }, []);

  const handleWebSocketClose = useCallback(() => {
    console.log('Video WebSocket connection closed');
  }, []);

  // Construct video-specific WebSocket URL
  const wsUrl = `wss://${API_BASE_URL.replace('http://', '').replace('https://', '')}/api/ws/powerpoint/${presentationId}/video/${videoId}/user/${userId}`;

  const { isConnected, connectionError } = useWebSocket({
    url: wsUrl,
    onMessage: handleWebSocketMessage,
    onError: handleWebSocketError,
    onClose: handleWebSocketClose,
    enabled: !!presentationId && !!videoId && !!userId
  });

  // Helper functions
  const getVideoProgress = () => {
    if (totalVideos === 0) return 0;
    return Math.round((completedVideos / totalVideos) * 100);
  };

  const isProcessingComplete = () => {
    return totalVideos > 0 && completedVideos === totalVideos;
  };

  return {
    completedVideos,
    totalVideos,
    isConnected,
    connectionError,
    getVideoProgress,
    isProcessingComplete
    };
};