import { useEffect, useRef, useState, useCallback } from 'react';
import { WebSocketMessage } from '../types/status';

interface UseWebSocketProps {
  url: string;
  onMessage?: (data: WebSocketMessage) => void;
  onError?: (error: Event) => void;
  onClose?: () => void;
  enabled?: boolean;
}

export const useWebSocket = ({ 
  url, 
  onMessage, 
  onError, 
  onClose, 
  enabled = true 
}: UseWebSocketProps) => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isUnmountingRef = useRef(false);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    if (!enabled || wsRef.current?.readyState === WebSocket.OPEN || isUnmountingRef.current) {
      return;
    }

    try {
      console.log('Connecting to WebSocket:', url);
      wsRef.current = new WebSocket(url);

      wsRef.current.onopen = () => {
        if (isUnmountingRef.current) {
          wsRef.current?.close();
          return;
        }
        console.log('WebSocket connected');
        setIsConnected(true);
        setConnectionError(null);
        reconnectAttemptsRef.current = 0;
      };

      wsRef.current.onmessage = (event) => {
        if (isUnmountingRef.current) return;
        
        try {
          const data: WebSocketMessage = JSON.parse(event.data);
          console.log('WebSocket message received:', data);
          onMessage?.(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      wsRef.current.onclose = (event) => {
        if (isUnmountingRef.current) return;
        
        console.log('WebSocket disconnected', event.code, event.reason);
        setIsConnected(false);
        onClose?.();

        // Auto-reconnect logic - only if not a normal closure and still enabled
        if (enabled && event.code !== 1000 && reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = Math.pow(2, reconnectAttemptsRef.current) * 1000; // Exponential backoff
          console.log(`Reconnecting in ${delay}ms... (attempt ${reconnectAttemptsRef.current + 1})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            if (!isUnmountingRef.current) {
              reconnectAttemptsRef.current++;
              connect();
            }
          }, delay);
        }
      };

      wsRef.current.onerror = (error) => {
        if (isUnmountingRef.current) return;
        
        console.error('WebSocket error:', error);
        setConnectionError('Connection failed');
        onError?.(error);
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setConnectionError('Failed to connect');
    }
  }, [url, enabled, onMessage, onError, onClose]);

  const disconnect = useCallback(() => {
    isUnmountingRef.current = true;
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.close(1000, 'Component unmounting');
    }
    
    wsRef.current = null;
    setIsConnected(false);
  }, []);

  useEffect(() => {
    isUnmountingRef.current = false;
    
    if (enabled) {
      // Small delay to prevent React StrictMode double connection
      const timeoutId = setTimeout(() => {
        if (!isUnmountingRef.current) {
          connect();
        }
      }, 100);
      
      return () => {
        clearTimeout(timeoutId);
        disconnect();
      };
    }

    return disconnect;
  }, [connect, disconnect, enabled]);

  return {
    isConnected,
    connectionError,
    connect,
    disconnect
  };
};