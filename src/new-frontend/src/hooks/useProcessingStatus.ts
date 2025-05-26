import { useState, useCallback } from 'react';
import { StatusStep, WebSocketMessage } from '../types/status';
import { useWebSocket } from './useWebSocket';
import { API_BASE_URL } from '../config/apiConfig';

interface UseProcessingStatusProps {
  presentationId: string;
  userId: string;
}

export const useProcessingStatus = ({ presentationId, userId }: UseProcessingStatusProps) => {
  const [statusSteps, setStatusSteps] = useState<StatusStep[]>([
    {
      id: 'blob_storage',
      label: 'Saving PowerPoint',
      status: 'Pending',
      statusKey: 'blob_storage_status'
    },
    {
      id: 'script_extraction',
      label: 'Extracting Scripts',
      status: 'Pending',
      statusKey: 'script_extraction_status'
    },
    {
      id: 'image_extraction',
      label: 'Extracting Images',
      status: 'Pending',
      statusKey: 'image_extraction_status'
    }
  ]);

  const handleWebSocketMessage = useCallback((message: WebSocketMessage) => {
    console.log('Processing WebSocket message:', message);
    
    // Handle the message structure from your backend
    if (message.type === 'progress_update' && message.ppt_id === presentationId) {
      const statusData = message.data;
      
      setStatusSteps(prevSteps => 
        prevSteps.map(step => {
          const newStatus = statusData[step.statusKey];
          if (newStatus && newStatus !== step.status) {
            console.log(`Updating ${step.label} from ${step.status} to ${newStatus}`);
            return { ...step, status: newStatus };
          }
          return step;
        })
      );
    }
  }, [presentationId]);

  const handleWebSocketError = useCallback((error: Event) => {
    console.error('WebSocket connection error:', error);
  }, []);

  const handleWebSocketClose = useCallback(() => {
    console.log('WebSocket connection closed');
  }, []);

  // Construct WebSocket URL
  const wsUrl = `ws://${API_BASE_URL.replace('http://', '').replace('https://', '')}/api/ws/powerpoint/${presentationId}/user/${userId}`;

  const { isConnected, connectionError } = useWebSocket({
    url: wsUrl,
    onMessage: handleWebSocketMessage,
    onError: handleWebSocketError,
    onClose: handleWebSocketClose,
    enabled: !!presentationId && !!userId
  });

  // Helper functions
  const getCompletedStepsCount = () => {
    return statusSteps.filter(step => step.status === 'Completed').length;
  };

  const getTotalStepsCount = () => {
    return statusSteps.length;
  };

  const isProcessingComplete = () => {
    return statusSteps.every(step => step.status === 'Completed');
  };

  const hasFailedSteps = () => {
    return statusSteps.some(step => step.status === 'Failed');
  };

  const getCurrentProcessingStep = () => {
    return statusSteps.find(step => step.status === 'Processing');
  };

  return {
    statusSteps,
    isConnected,
    connectionError,
    getCompletedStepsCount,
    getTotalStepsCount,
    isProcessingComplete,
    hasFailedSteps,
    getCurrentProcessingStep
  };
};
