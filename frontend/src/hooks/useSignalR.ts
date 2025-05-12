import { useState, useEffect, useRef } from 'react';
import { 
  HubConnection, 
  HubConnectionBuilder, 
  LogLevel, 
  HubConnectionState,
  HttpTransportType 
} from '@microsoft/signalr';

interface SignalROptions {
  hubUrl: string;
  subscribeToGroup?: string;
  onStatusUpdate?: (data: any) => void;
  onProcessingUpdate?: (data: any) => void;
}

export const useSignalR = ({ hubUrl, subscribeToGroup, onStatusUpdate, onProcessingUpdate }: SignalROptions) => {
  const connection = useRef<HubConnection | null>(null);
  const [connectionState, setConnectionState] = useState<string>('disconnected');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const reconnectAttempts = useRef(0);

  useEffect(() => {
    let isMounted = true;
    let reconnectTimeout: NodeJS.Timeout;

    const startConnection = async () => {
      // Skip if no URL or we shouldn't connect yet
      if (!hubUrl || !subscribeToGroup) return;
      
      // Clean up existing connection
      if (connection.current && connection.current.state !== HubConnectionState.Disconnected) {
        console.log('Stopping existing SignalR connection before creating a new one.');
        try {
          await connection.current.stop();
        } catch (err) {
          console.error("Error stopping previous connection:", err);
        }
      }

      // Create new-connection
      console.log(`Setting up SignalR connection for group: ${subscribeToGroup}`);
      const newConnection = new HubConnectionBuilder()
        .withUrl(hubUrl, {
          skipNegotiation: false,
          transport: HttpTransportType.WebSockets | HttpTransportType.LongPolling
        })
        .withAutomaticReconnect([0, 2000, 5000, 10000, 20000]) // Retry with backoff
        .configureLogging(LogLevel.Information)
        .build();

      // Create status callback
      newConnection.onclose((error) => {
        console.log('SignalR connection closed', error);
        if (isMounted) {
          setConnectionState('disconnected');
          if (error) {
            setConnectionError(`Connection closed with error: ${error}`);
          }
        }
      });

      newConnection.onreconnecting((error) => {
        console.log('SignalR reconnecting', error);
        if (isMounted) {
          setConnectionState('reconnecting');
          setConnectionError(`Reconnecting: ${error ? error.message : 'Connection lost'}`);
        }
      });

      newConnection.onreconnected((connectionId) => {
        console.log('SignalR reconnected', connectionId);
        if (isMounted) {
          setConnectionState('connected');
          setConnectionError(null);
          
          // Re-subscribe after reconnection
          if (subscribeToGroup) {
            newConnection.invoke('SubscribeToPptUpdates', subscribeToGroup)
              .then(() => console.log(`Re-subscribed to updates for: ${subscribeToGroup}`))
              .catch(err => console.error(`Error re-subscribing to updates:`, err));
          }
        }
      });

      // Set up message handlers
      if (onStatusUpdate) {
        newConnection.on('ReceiveStatusUpdate', onStatusUpdate);
      }
      
      if (onProcessingUpdate) {
        newConnection.on('ReceiveProcessingUpdate', onProcessingUpdate);
      }

      // Start connection
      try {
        await newConnection.start();
        console.log(`SignalR Connected: ${newConnection.connectionId}`);
        
        if (isMounted) {
          setConnectionState('connected');
          setConnectionError(null);
          reconnectAttempts.current = 0;
        }
        
        // Subscribe to group updates
        if (subscribeToGroup && newConnection.state === HubConnectionState.Connected) {
          try {
            await newConnection.invoke('SubscribeToPptUpdates', subscribeToGroup);
            console.log(`Subscribed to updates for: ${subscribeToGroup}`);
          } catch (err) {
            console.error(`Error subscribing to updates for ${subscribeToGroup}:`, err);
            if (isMounted) {
              setConnectionError(`Failed to subscribe: ${err instanceof Error ? err.message : String(err)}`);
            }
          }
        }
        
        // Store the connection reference
        if (isMounted) {
          connection.current = newConnection;
        }
      } catch (err) {
        console.error(`SignalR Connection Failed:`, err);
        if (isMounted) {
          setConnectionState('error');
          setConnectionError(`Connection failed: ${err instanceof Error ? err.message : String(err)}`);
          
          // Implement retry with backoff
          const retryDelay = Math.min(1000 * (2 ** reconnectAttempts.current), 30000);
          console.log(`Will retry in ${retryDelay}ms (attempt ${reconnectAttempts.current + 1})`);
          
          reconnectTimeout = setTimeout(() => {
            if (isMounted) {
              reconnectAttempts.current += 1;
              startConnection();
            }
          }, retryDelay);
        }
      }
    };

    startConnection();

    // cleanup
    return () => {
      isMounted = false;
      clearTimeout(reconnectTimeout);
      
      if (connection.current) {
        console.log(`Cleaning up SignalR connection for: ${subscribeToGroup}`);
        
        if (onStatusUpdate) {
          connection.current.off('ReceiveStatusUpdate', onStatusUpdate);
        }
        
        if (onProcessingUpdate) {
          connection.current.off('ReceiveProcessingUpdate', onProcessingUpdate);
        }
        
        connection.current.stop()
          .then(() => console.log(`SignalR connection stopped.`))
          .catch(err => console.error(`Error stopping SignalR connection:`, err));
      }
    };
  }, [hubUrl, subscribeToGroup, onStatusUpdate, onProcessingUpdate]);

  return {
    connection: connection.current,
    connectionState,
    connectionError
  };
};