import React, { useState, useCallback, useEffect } from 'react';
import { CssBaseline, Container, ThemeProvider, createTheme, Box } from '@mui/material';
import FileUpload from './components/FileUpload';
import { EditorSlide } from './components/SlideEditor';
import AppHeader from './components/AppHeader';
import PresentationView from './components/PresentationView';
import { useSignalR } from './hooks/useSignalR';
import { useProcessingStatus } from './hooks/useProcessingStatus';
import { useSlidesFetcher } from './hooks/useSlidesFetcher';
import { SIGNALR_HUB_URL } from './utils/apiConfig';

const theme = createTheme({
  palette: {
    primary: { main: '#1976d2' },
    secondary: { main: '#dc004e' },
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

  useEffect(() => {
    if (pptId && allProcessingComplete && slidesData.length === 0) {
      fetchSlides(pptId);
    }
  }, [pptId, allProcessingComplete, slidesData.length, fetchSlides]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppHeader 
        showBackButton={showSlideEditor} 
        onBackClick={handleBackToUpload} 
      />
      
      <Container>
        <Box sx={{ my: 4 }}>
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
      </Container>
    </ThemeProvider>
  );
};

export default App;