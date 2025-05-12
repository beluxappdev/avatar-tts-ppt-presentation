import React, { useState, useEffect, useRef } from 'react';
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
  CircularProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper
} from '@mui/material';
import FileUpload from './components/FileUpload';
import SlideEditor, { EditorSlide } from './components/SlideEditor';
import { HubConnection, HubConnectionBuilder, LogLevel, HubConnectionState } from '@microsoft/signalr';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import ErrorIcon from '@mui/icons-material/Error';
import axios from 'axios';

// theme instance, change later
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

const API_BASE_URL = 'http://localhost:8080';
const SIGNALR_HUB_URL = `${API_BASE_URL}/processingStatusHub`;
const SLIDES_API_URL = (pptId: string) => `${API_BASE_URL}/api/ppt/${pptId}/slides`;

interface ProcessingStep {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  label: string;
  error?: string;
}

const App: React.FC = () => {
  const [showSlideEditor, setShowSlideEditor] = useState(false);
  const [pptId, setPptId] = useState<string | null>(null);
  const [slidesData, setSlidesData] = useState<EditorSlide[]>([]);
  const connection = useRef<HubConnection | null>(null);
  const [overallStatusMessage, setOverallStatusMessage] = useState<string | null>(null);

  const [processingSteps, setProcessingSteps] = useState<Record<string, ProcessingStep>>({
    blobStorage: { status: 'pending', label: 'Saving PowerPoint' },
    scriptProcessing: { status: 'pending', label: 'Extracting Scripts' },
    imageProcessing: { status: 'pending', label: 'Extracting Images' },
  });
  const [allProcessingComplete, setAllProcessingComplete] = useState(false);


  const resetProcessingStates = () => {
    setProcessingSteps({
      blobStorage: { status: 'pending', label: 'Saving PowerPoint' },
      scriptProcessing: { status: 'pending', label: 'Extracting Scripts' },
      imageProcessing: { status: 'pending', label: 'Extracting Images' },
    });
    setAllProcessingComplete(false);
    setSlidesData([]);
    setOverallStatusMessage(null);
  };

  const handleFileUploaded = (uploadedFileId: string) => {
    resetProcessingStates();
    setPptId(uploadedFileId);
    setProcessingSteps(prev => ({ ...prev, blobStorage: { ...prev.blobStorage, status: 'processing' } }));
    setShowSlideEditor(true);
  };

  const handleBackToUpload = () => {
    setPptId(null);
    setShowSlideEditor(false);
    resetProcessingStates();
  };

  const fetchSlides = async (currentPptId: string) => {
    setOverallStatusMessage('Fetching slides...');
    try {
      const response = await axios.get(SLIDES_API_URL(currentPptId));
      if (response.data && response.data.slides) {
        const fetchedSlides: EditorSlide[] = response.data.slides.map((apiSlide: any, index: number) => ({
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
      setProcessingSteps(prev => ({
        ...prev,
        imageProcessing: { ...prev.imageProcessing, status: 'failed', error: 'Failed to load slides' },
        scriptProcessing: { ...prev.scriptProcessing, status: 'failed', error: 'Failed to load slides' }
      }));
    }
  };

  useEffect(() => {
    if (pptId) {
      if (connection.current && connection.current.state !== HubConnectionState.Disconnected) {
        console.log('Stopping existing SignalR connection before creating a new one.');
        connection.current.stop().catch(err => console.error("Error stopping previous connection:", err));
      }

      console.log(`Setting up SignalR connection for pptId: ${pptId}`);
      const newConnection = new HubConnectionBuilder()
        .withUrl(SIGNALR_HUB_URL)
        .withAutomaticReconnect() // currently does not make too much sense since when restart the browser, the connection will be lost anyway
        .configureLogging(LogLevel.Trace) 
        .build();

      connection.current = newConnection;
      setOverallStatusMessage('Attempting to connect to real-time updates...');

      const receiveStatusUpdateHandler = (data: { pptId: string; status: string; detail?: string }) => {
        if (data.pptId === pptId) {
          console.log('Client ReceiveStatusUpdate:', data);
          setOverallStatusMessage(`Overall status: ${data.status}${data.detail ? ` - ${data.detail}` : ''}`);
          if (data.status === 'Completed') {
            setAllProcessingComplete(true);
            setProcessingSteps(prev => ({
              blobStorage: { ...prev.blobStorage, status: 'completed' },
              scriptProcessing: { ...prev.scriptProcessing, status: 'completed' },
              imageProcessing: { ...prev.imageProcessing, status: 'completed' },
            }));
            fetchSlides(pptId);
          } else if (data.status === 'Processing') {
            setProcessingSteps(prev => {
              if (prev.blobStorage.status === 'pending') {
                return { ...prev, blobStorage: { ...prev.blobStorage, status: 'processing' } };
              }
              return prev;
            });
          } else if (data.status === 'Failed') {
            setOverallStatusMessage(`Processing failed: ${data.detail || 'Unknown error'}`);
            setAllProcessingComplete(true); // will end any further processing
            setProcessingSteps(prev => ({
              blobStorage: { ...prev.blobStorage, status: prev.blobStorage.status === 'completed' ? 'completed' : 'failed', error: data.detail },
              scriptProcessing: { ...prev.scriptProcessing, status: 'failed', error: data.detail },
              imageProcessing: { ...prev.imageProcessing, status: 'failed', error: data.detail },
            }));
          }
        }
      };

      const receiveProcessingUpdateHandler = (data: { pptId: string; processingType: string; status: string; }) => {
        if (data.pptId === pptId) {
          console.log('Client ReceiveProcessingUpdate:', data);
          const stepKey = data.processingType.charAt(0).toLowerCase() + data.processingType.slice(1);
          setProcessingSteps(prev => {
            const currentStep = prev[stepKey];
            if (!currentStep) {
                console.warn(`Received processing update for unknown stepKey: ${stepKey} (Type: ${data.processingType})`);
                return prev;
            }
            const updatedStep = {
              ...currentStep,
              status: data.status.toLowerCase() as ProcessingStep['status'],
            };
            return { ...prev, [stepKey]: updatedStep };
          });
        }
      };

      newConnection.on('ReceiveStatusUpdate', receiveStatusUpdateHandler);
      newConnection.on('ReceiveProcessingUpdate', receiveProcessingUpdateHandler);

      newConnection.start()
        .then(() => {
          console.log(`SignalR Connected successfully for pptId: ${pptId}. Connection ID: ${newConnection.connectionId}`);
          setOverallStatusMessage('Connected to real-time updates.');
          if (newConnection.state === HubConnectionState.Connected) {
            newConnection.invoke('SubscribeToPptUpdates', pptId)
              .then(() => console.log(`Subscribed to updates for: ${pptId}`))
              .catch(err => console.error(`Error subscribing to updates for ${pptId}:`, err));
          }
        })
        .catch(err => {
          console.error(`SignalR Connection Failed to Start for pptId ${pptId}: `, err);
          setOverallStatusMessage(`Failed to connect: ${err.message}. Auto-reconnect will attempt.`);
        });

      return () => {
        console.log(`Cleaning up SignalR connection for pptId: ${pptId}. Current state: ${newConnection.state}`);
        newConnection.off('ReceiveStatusUpdate', receiveStatusUpdateHandler);
        newConnection.off('ReceiveProcessingUpdate', receiveProcessingUpdateHandler);
        
        newConnection.stop()
          .then(() => console.log(`SignalR connection for ${pptId} stopped.`))
          .catch(err => console.error(`Error stopping SignalR connection for ${pptId}:`, err));
        connection.current = null;
      };
    } else {
      if (connection.current) {
        console.log('pptId is null, stopping existing SignalR connection.');
        connection.current.stop()
            .then(() => console.log('SignalR connection stopped due to null pptId.'))
            .catch(err => console.error("Error stopping connection on null pptId:", err));
        connection.current = null;
        setOverallStatusMessage("Disconnected from real-time updates.");
      }
    }
  }, [pptId]);


  const getStatusIcon = (status: ProcessingStep['status']) => {
    if (status === 'completed') return <CheckCircleIcon color="success" />;
    if (status === 'processing') return <CircularProgress size={20} />;
    if (status === 'failed') return <ErrorIcon color="error" />;
    return <HourglassEmptyIcon color="disabled" />;
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppBar
        position="static"
        sx={{
          height: '40px'
        }}
      >
        <Toolbar
          sx={{
            minHeight: '40px !important',
            paddingTop: '0px',
            paddingBottom: '0px',
            display: 'flex',
            justifyContent: 'space-between'
          }}
        >
          <Typography
            variant="subtitle2"
            sx={{
              fontSize: '0.9rem',
              fontWeight: 500
            }}
          >
            Microsoft
          </Typography>
          
          {showSlideEditor && (
            <Button
              color="inherit"
              size="small"
              onClick={handleBackToUpload}
            >
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
              {pptId && (
                <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>PPT ID: {pptId}</Typography>
                  <List dense>
                    {Object.entries(processingSteps).map(([key, step]) => (
                      <ListItem key={key} disablePadding>
                        <ListItemIcon sx={{minWidth: '30px'}}>
                          {getStatusIcon(step.status)}
                        </ListItemIcon>
                        <ListItemText
                          primary={step.label}
                          secondary={step.status === 'failed' && step.error ? `Error: ${step.error}` : step.status}
                        />
                      </ListItem>
                    ))}
                  </List>
                  {overallStatusMessage && <Typography variant="caption" display="block" sx={{mt: 1}}>{overallStatusMessage}</Typography>}
                </Paper>
              )}
              {allProcessingComplete && slidesData.length > 0 ? (
                <SlideEditor slides={slidesData} pptId={pptId} />
              ) : allProcessingComplete && slidesData.length === 0 && !overallStatusMessage?.includes("Error") ? (
                 <Typography>No slides were processed or found for this presentation.</Typography>
              ) : !allProcessingComplete && pptId ? (
                <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'center', my: 2}}>
                   <CircularProgress />
                   <Typography sx={{ml:1, display: 'flex', alignItems: 'center'}}>Processing presentation...</Typography>
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