import React, { useState, useCallback } from 'react';
import {
  CssBaseline,
  Container,
  ThemeProvider,
  createTheme,
  AppBar,
  Toolbar,
  Typography,
  Box,
  Button,
  CircularProgress
} from '@mui/material';
import FileUpload from './components/FileUpload';
import SlideEditor, { EditorSlide } from './components/SlideEditor';
import PresentationStatus from './components/PresentationStatus';
import { useSignalR } from './hooks/useSignalR';
import { useProcessingStatus } from './hooks/useProcessingStatus';
import axios from 'axios';

const theme = createTheme({
  palette: {
    primary: { main: '#1976d2' },
    secondary: { main: '#dc004e' },
  },
});

const API_BASE_URL = 'http://localhost:8080';
const SIGNALR_HUB_URL = `${API_BASE_URL}/processingStatusHub`;
const SLIDES_API_URL = (pptId: string) => `${API_BASE_URL}/api/ppt/${pptId}/slides`;

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

  /*
   * Fetch slide data from the API for the presentation
   * - Get slide content, imges, and extracted scripts
   * - Populate the slidesData state with the fetched data
   * - Updates the overall status message
  */
  const fetchSlides = useCallback(async (currentPptId: string) => {
    setOverallStatusMessage('Fetching slides...');
    try {
      const response = await axios.get(SLIDES_API_URL(currentPptId));
      if (response.data && response.data.slides) {
        const fetchedSlides = response.data.slides.map((apiSlide: any, index: number) => ({
          id: `slide-${apiSlide.index !== undefined ? apiSlide.index : index}`,
          index: apiSlide.index !== undefined ? apiSlide.index : index,
          title: `Slide ${apiSlide.index !== undefined ? apiSlide.index + 1 : index + 1}`,
          thumbnailUrl: apiSlide.blobUrl,
          script: apiSlide.script || '',
          voice: 'Harry',
          avatarSize: 'Medium',
          avatarPosition: 'Left',
        }));
        setSlidesData(fetchedSlides);
        setOverallStatusMessage('Slides loaded successfully.');
      } else {
        setOverallStatusMessage('No slides found or invalid format.');
      }
    } catch (error) {
      console.error('Error fetching slides:', error);
      setOverallStatusMessage(`Error fetching slides: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [setOverallStatusMessage]);

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

  React.useEffect(() => {
    if (pptId && allProcessingComplete && slidesData.length === 0) {
      fetchSlides(pptId);
    }
  }, [pptId, allProcessingComplete, slidesData.length, fetchSlides]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppBar position="static" sx={{ height: '40px' }}>
        <Toolbar sx={{
          minHeight: '40px !important',
          py: 0,
          display: 'flex',
          justifyContent: 'space-between'
        }}>
          <Typography variant="subtitle2" sx={{ fontSize: '0.9rem', fontWeight: 500 }}>
            Microsoft
          </Typography>
          
          {showSlideEditor && (
            <Button color="inherit" size="small" onClick={handleBackToUpload}>
              Back to Upload
            </Button>
          )}
        </Toolbar>
      </AppBar>
      
      <Container>
        <Box sx={{ my: 4 }}>
          {!showSlideEditor ? (
            <FileUpload onFileUploaded={handleFileUploaded} />
          ) : (
            <>
              <Typography variant="h5" gutterBottom>Presentation Status</Typography>
              
              <PresentationStatus 
                pptId={pptId}
                processingSteps={processingSteps}
                statusMessage={overallStatusMessage}
              />
              
              {allProcessingComplete && slidesData.length > 0 ? (
                <SlideEditor slides={slidesData} pptId={pptId} />
              ) : allProcessingComplete && slidesData.length === 0 && !overallStatusMessage?.includes("Error") ? (
                <Typography>No slides were processed or found for this presentation.</Typography>
              ) : !allProcessingComplete && pptId ? (
                <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'center', my: 2}}>
                  <CircularProgress />
                  <Typography sx={{ml:1}}>Processing presentation...</Typography>
                </Box>
              ) : null}
            </>
          )}
        </Box>
      </Container>
    </ThemeProvider>
  );
};

export default App;