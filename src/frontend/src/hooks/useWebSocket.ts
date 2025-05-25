// hooks/useWebSocket.ts
import { useState, useEffect, useRef, useCallback } from 'react';

export interface WebSocketStatusMessage {
  type: 'status_update' | 'connection_established' | 'progress_update';
  ppt_id: string;
  image_extraction_status?: string;
  script_extraction_status?: string;
  timestamp: string;
  // New fields for progress_update messages
  data?: {
    blob_storage_status?: string;
    image_extraction_status?: string;
    script_extraction_status?: string;
    file_name?: string;
    user_id?: string;
    video_information?: any[];
  };
  changes?: {
    [key: string]: any;
  };
}

export interface ProcessingStatusUpdate {
  pptId: string;
  status: string;
  detail?: string;
}

export interface ProcessingUpdate {
  processingType: string;
  status: string;
}

interface WebSocketHookOptions {
  url: string;
  pptId?: string;
  onStatusUpdate?: (data: ProcessingStatusUpdate) => void;
  onProcessingUpdate?: (data: ProcessingUpdate) => void;
  autoReconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export const useWebSocket = ({
  url,
  pptId,
  onStatusUpdate,
  onProcessingUpdate,
  autoReconnect = true,
  reconnectInterval = 3000,
  maxReconnectAttempts = 10
}: WebSocketHookOptions) => {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const startHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }

    heartbeatIntervalRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send('ping');
      }
    }, 30000);
  }, []);

  const handleMessage = useCallback((data: WebSocketStatusMessage) => {
    if (!pptId || data.ppt_id !== pptId) {
      return;
    }

    console.log('WebSocket message received:', data);

    if (data.type === 'progress_update' && data.data) {
      // Handle new progress_update format
      const { data: progressData } = data;
      
      // Map backend status values to frontend values
      const mapStatus = (status: string) => {
        const statusMap: Record<string, string> = {
          'Pending': 'pending',
          'Processing': 'processing',
          'Completed': 'completed',
          'Failed': 'failed'
        };
        return statusMap[status] || status.toLowerCase();
      };

      // Send individual processing updates for each extraction type
      if (progressData.blob_storage_status) {
        const blobUpdate: ProcessingUpdate = {
          processingType: 'blobStorage',
          status: mapStatus(progressData.blob_storage_status)
        };
        onProcessingUpdate?.(blobUpdate);
      }

      if (progressData.image_extraction_status) {
        const imageUpdate: ProcessingUpdate = {
          processingType: 'imageProcessing',
          status: mapStatus(progressData.image_extraction_status)
        };
        onProcessingUpdate?.(imageUpdate);
      }

      if (progressData.script_extraction_status) {
        const scriptUpdate: ProcessingUpdate = {
          processingType: 'scriptProcessing',
          status: mapStatus(progressData.script_extraction_status)
        };
        onProcessingUpdate?.(scriptUpdate);
      }

      // Create overall status update
      const allCompleted = 
        progressData.blob_storage_status === 'Completed' &&
        progressData.image_extraction_status === 'Completed' &&
        progressData.script_extraction_status === 'Completed';

      const anyProcessing = 
        progressData.blob_storage_status === 'Processing' ||
        progressData.image_extraction_status === 'Processing' ||
        progressData.script_extraction_status === 'Processing';

      const anyFailed = 
        progressData.blob_storage_status === 'Failed' ||
        progressData.image_extraction_status === 'Failed' ||
        progressData.script_extraction_status === 'Failed';

      let overallStatus = 'In Progress';
      if (allCompleted) {
        overallStatus = 'Completed';
      } else if (anyFailed) {
        overallStatus = 'Failed';
      } else if (anyProcessing) {
        overallStatus = 'Processing';
      }

      const statusUpdate: ProcessingStatusUpdate = {
        pptId: data.ppt_id,
        status: overallStatus,
        detail: `Blob: ${progressData.blob_storage_status}, Image: ${progressData.image_extraction_status}, Script: ${progressData.script_extraction_status}`
      };
      
      onStatusUpdate?.(statusUpdate);

    } else if (data.type === 'status_update') {
      // Handle legacy status_update format (keeping for backward compatibility)
      const mapStatus = (status: string) => {
        const statusMap: Record<string, string> = {
          'Pending': 'pending',
          'Processing': 'processing',
          'Completed': 'completed',
          'Failed': 'failed'
        };
        return statusMap[status] || status.toLowerCase();
      };

      if (data.image_extraction_status) {
        const imageUpdate: ProcessingUpdate = {
          processingType: 'imageProcessing',
          status: mapStatus(data.image_extraction_status)
        };
        onProcessingUpdate?.(imageUpdate);
      }

      if (data.script_extraction_status) {
        const scriptUpdate: ProcessingUpdate = {
          processingType: 'scriptProcessing',
          status: mapStatus(data.script_extraction_status)
        };
        onProcessingUpdate?.(scriptUpdate);
      }

      const statusUpdate: ProcessingStatusUpdate = {
        pptId: data.ppt_id,
        status: `Image: ${data.image_extraction_status || 'Unknown'}, Script: ${data.script_extraction_status || 'Unknown'}`,
        detail: `Last updated: ${new Date(data.timestamp).toLocaleTimeString()}`
      };
      
      onStatusUpdate?.(statusUpdate);
    }
  }, [pptId, onStatusUpdate, onProcessingUpdate]);

  const connect = useCallback(() => {
    if (!pptId || !isMountedRef.current) {
      return;
    }

    cleanup();

    const wsUrl = `${url}/${pptId}/user/tenant123`;
    console.log(`Connecting to WebSocket: ${wsUrl}`);
    
    setConnectionState('connecting');
    setConnectionError(null);

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log(`WebSocket connected for PowerPoint: ${pptId}`);
        if (isMountedRef.current) {
          setConnectionState('connected');
          setConnectionError(null);
          reconnectAttemptsRef.current = 0;
          startHeartbeat();
        }
      };

      ws.onmessage = (event) => {
        try {
          const messageText = event.data;
          
          // Handle ping/pong messages (they're not JSON)
          if (messageText === 'pong') {
            console.log('Received pong response');
            return;
          }
          
          const data: WebSocketStatusMessage = JSON.parse(messageText);
          handleMessage(data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error, 'Raw message:', event.data);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        if (isMountedRef.current) {
          setConnectionState('error');
          setConnectionError('WebSocket connection error');
        }
      };

      ws.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        
        if (isMountedRef.current) {
          setConnectionState('disconnected');
          
          if (heartbeatIntervalRef.current) {
            clearInterval(heartbeatIntervalRef.current);
            heartbeatIntervalRef.current = null;
          }

          if (autoReconnect && 
              reconnectAttemptsRef.current < maxReconnectAttempts && 
              event.code !== 1000) {
            
            const delay = Math.min(reconnectInterval * Math.pow(1.5, reconnectAttemptsRef.current), 30000);
            console.log(`Attempting to reconnect in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1})`);
            
            setConnectionError(`Connection lost. Reconnecting in ${Math.ceil(delay / 1000)}s...`);
            
            reconnectTimeoutRef.current = setTimeout(() => {
              if (isMountedRef.current) {
                reconnectAttemptsRef.current++;
                connect();
              }
            }, delay);
          } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
            setConnectionError('Max reconnection attempts reached');
          }
        }
      };

    } catch (error) {
      console.error('Error creating WebSocket:', error);
      if (isMountedRef.current) {
        setConnectionState('error');
        setConnectionError('Failed to create WebSocket connection');
      }
    }
  }, [url, pptId, autoReconnect, reconnectInterval, maxReconnectAttempts, cleanup, startHeartbeat, handleMessage]);

  const disconnect = useCallback(() => {
    console.log('Manually disconnecting WebSocket');
    isMountedRef.current = false;
    cleanup();
    setConnectionState('disconnected');
    setConnectionError(null);
  }, [cleanup]);

  const reconnect = useCallback(() => {
    console.log('Manually reconnecting WebSocket');
    reconnectAttemptsRef.current = 0;
    connect();
  }, [connect]);

  useEffect(() => {
    isMountedRef.current = true;

    if (pptId) {
      connect();
    } else {
      cleanup();
      setConnectionState('disconnected');
    }

    return () => {
      isMountedRef.current = false;
      cleanup();
    };
  }, [pptId, connect, cleanup]);

  return {
    connectionState,
    connectionError,
    connect,
    disconnect,
    reconnect,
    isConnected: connectionState === 'connected',
    isConnecting: connectionState === 'connecting',
    isDisconnected: connectionState === 'disconnected'
  };
};