import React, { useState, useCallback, useEffect } from 'react';
import { CssBaseline, ThemeProvider, createTheme, Box } from '@mui/material';
import FileUpload from './components/FileUpload';
import { EditorSlide } from './components/SlideEditor';
import Sidebar from './components/Sidebar';
import PresentationView from './components/PresentationView';
import { useSignalR } from './hooks/useSignalR';
import { useProcessingStatus } from './hooks/useProcessingStatus';
import { useSlidesFetcher } from './hooks/useSlidesFetcher';
import { SIGNALR_HUB_URL } from './utils/apiConfig';

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

const App: React.FC = () => {
  const [showSlideEditor, setShowSlideEditor] = useState(false);
  const [pptId, setPptId] = useState<string | null>(null);
  const [slidesData, setSlidesData] = useState<EditorSlide[]>([]);
  
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

  useSignalR({
    hubUrl: SIGNALR_HUB_URL,
    subscribeToGroup: pptId || undefined,
    onStatusUpdate: (data) => {
      if (data.pptId === pptId) {
        console.log('Client ReceiveStatusUpdate:', data);
        handleStatusUpdate(data);
      }
    },
    onProcessingUpdate: (data) => {
      if (data.pptId === pptId) {
        console.log('Client ReceiveProcessingUpdate:', data);
        handleProcessingUpdate(data);
      }
    }
  });

  const handleFileUploaded = useCallback((uploadedFileId: string) => {
    resetStatus();
    setPptId(uploadedFileId);
    setShowSlideEditor(true);
  }, [resetStatus]);

  const handleBackToUpload = useCallback(() => {
    setPptId(null);
    setShowSlideEditor(false);
    resetStatus();
    setSlidesData([]);
  }, [resetStatus]);

  // For the sidebar
  const handleNewPresentation = useCallback(() => {
    handleBackToUpload();
  }, [handleBackToUpload]);

  useEffect(() => {
    if (pptId && allProcessingComplete && slidesData.length === 0) {
      fetchSlides(pptId);
    }
  }, [pptId, allProcessingComplete, slidesData.length, fetchSlides]);

  // Recent presentations for the sidebar
  const recentPresentations = pptId ? 
    [{ id: pptId, name: `Presentation ${pptId.substring(0, 8)}` }] : 
    [];

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Sidebar
        username="User"
        recentPresentations={recentPresentations}
        onNewPresentation={handleNewPresentation}
      />
      
      <Box sx={{ 
        ml: { xs: '60px', sm: '280px' }, 
        transition: 'margin-left 0.3s ease',
        p: 3,
        minHeight: '100vh'
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
    </ThemeProvider>
  );
};

export default App;