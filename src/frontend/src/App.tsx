// App.tsx
import React, { useState, useCallback, useEffect } from 'react';
import { CssBaseline, ThemeProvider, createTheme, Box } from '@mui/material';
import FileUpload from './components/FileUpload';
import { EditorSlide } from './components/SlideList';
import Sidebar from './components/Sidebar';
import PresentationView from './components/PresentationView';
import { useWebSocket, ProcessingStatusUpdate, ProcessingUpdate } from './hooks/useWebSocket';
import { useProcessingStatus } from './hooks/useProcessingStatus';
import { useSlidesFetcher } from './hooks/useSlidesFetcher';

const theme = createTheme({
  palette: {
    primary: { main: '#1976d2' },
    secondary: { main: '#dc004e' },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff'
    }
  },
});

// Configuration - add this to your .env file
const WEBSOCKET_URL = process.env.REACT_APP_WEBSOCKET_URL || 'ws://localhost:8000/api/ws/powerpoint';

const App: React.FC = () => {
  const [showSlideEditor, setShowSlideEditor] = useState(false);
  const [pptId, setPptId] = useState<string | null>(null);
  const [slidesData, setSlidesData] = useState<EditorSlide[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  const {
    processingSteps,
    allProcessingComplete,
    overallStatusMessage,
    resetStatus,
    handleStatusUpdate,
    handleProcessingUpdate,
    setOverallStatusMessage
  } = useProcessingStatus();

  const fetchSlides = useSlidesFetcher(setSlidesData, setOverallStatusMessage);

  // WebSocket handlers
  const handleWebSocketStatusUpdate = useCallback((data: ProcessingStatusUpdate) => {
    console.log('Processing status update:', data);
    handleStatusUpdate(data);
  }, [handleStatusUpdate]);

  const handleWebSocketProcessingUpdate = useCallback((data: ProcessingUpdate) => {
    console.log('Processing update:', data);
    handleProcessingUpdate(data);
  }, [handleProcessingUpdate]);

  // WebSocket hook
  const {
    connectionState,
    connectionError,
    isConnected,
    reconnect
  } = useWebSocket({
    url: WEBSOCKET_URL,
    pptId: pptId || undefined,
    onStatusUpdate: handleWebSocketStatusUpdate,
    onProcessingUpdate: handleWebSocketProcessingUpdate,
    autoReconnect: true,
    reconnectInterval: 3000,
    maxReconnectAttempts: 10
  });

  // Event handlers
  const handleFileUploaded = useCallback((uploadedFileId: string) => {
    console.log('File uploaded with ID:', uploadedFileId);
    resetStatus();
    setPptId(uploadedFileId);
    setShowSlideEditor(true);
    
    // Set initial status
    setOverallStatusMessage('File uploaded successfully. Connecting to updates...');
  }, [resetStatus, setOverallStatusMessage]);

  const handleBackToUpload = useCallback(() => {
    setPptId(null);
    setShowSlideEditor(false);
    resetStatus();
    setSlidesData([]);
  }, [resetStatus]);

  const handleSelectPresentation = useCallback((id: string) => {
    resetStatus();
    setPptId(id);
    setShowSlideEditor(true);
  }, [resetStatus]);

  const handleNewPresentation = useCallback(() => {
    handleBackToUpload();
  }, [handleBackToUpload]);

  // Effect to fetch slides when processing is complete
  useEffect(() => {
    if (pptId && allProcessingComplete && slidesData.length === 0) {
      fetchSlides(pptId);
    }
  }, [pptId, allProcessingComplete, slidesData.length, fetchSlides]);

  // Effect to update status message based on WebSocket connection state
  useEffect(() => {
    console.log('Connection state changed:', connectionState, 'for pptId:', pptId);
    
    if (pptId) {
      switch (connectionState) {
        case 'connecting':
          setOverallStatusMessage('Connecting to PowerPoint updates...');
          break;
        case 'connected':
          setOverallStatusMessage('Connected to real-time updates');
          break;
        case 'disconnected':
          setOverallStatusMessage('Disconnected from updates');
          break;
        case 'error':
          setOverallStatusMessage(connectionError || 'Connection error');
          break;
      }
    }
  }, [connectionState, connectionError, pptId, setOverallStatusMessage]);

  const recentPresentations = pptId ? 
    [{ id: pptId, name: `Presentation ${pptId.substring(0, 8)}` }] : 
    [];

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex' }}>
        <Sidebar
          username="User"
          recentPresentations={recentPresentations}
          onNewPresentation={handleNewPresentation}
          onSelectPresentation={handleSelectPresentation}
          onSidebarToggle={setSidebarOpen}
        />
        
        <Box sx={{
          flexGrow: 1,
          marginLeft: sidebarOpen ? '280px' : '60px',
          transition: 'margin-left 0.15s ease',
          display: 'flex',
          justifyContent: 'center',
          minHeight: '100vh',
        }}>
          <Box sx={{ 
            maxWidth: '1200px', 
            width: '100%', 
            p: 3,
          }}>
            {!showSlideEditor ? (
              <FileUpload onFileUploaded={handleFileUploaded} />
            ) : (
              <PresentationView 
                pptId={pptId}
                processingSteps={processingSteps}
                statusMessage={overallStatusMessage}
                allProcessingComplete={allProcessingComplete}
                slides={slidesData}
              />
            )}
          </Box>
        </Box>
      </Box>
    </ThemeProvider>
  );
};

export default App;