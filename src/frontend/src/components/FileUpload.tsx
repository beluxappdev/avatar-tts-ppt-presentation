import React, { useCallback, useState, useRef, useEffect } from 'react';
import { 
  Box, 
  Button, 
  Card, 
  CardContent, 
  CircularProgress, 
  Typography, 
  Alert,
  AlertTitle,
  Stepper,
  Step,
  StepLabel,
  LinearProgress
} from '@mui/material';
import { ReactComponent as PowerPointLogo } from '../assets/powerpoint.svg';
import axios from 'axios';
import { HubConnectionBuilder } from '@microsoft/signalr';
import PowerPointViewer from './PowerPointViewer';

const API_URL = '/api/save_ppt';
const SIGNALR_URL = '/processingStatusHub';

const FileUpload: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{
    success: boolean;
    message: string;
    fileId?: string;
  } | null>(null);

  // Processing status states
  const [uploadedPptId, setUploadedPptId] = useState<string | null>(null);
  const [savingPpt, setSavingPpt] = useState({ status: 'pending', completed: false });
  const [extractingScripts, setExtractingScripts] = useState({ status: 'pending', completed: false });
  const [extractingImages, setExtractingImages] = useState({ status: 'pending', completed: false });
  const [processingComplete, setProcessingComplete] = useState(false);
  
  // Show viewer state
  const [showViewer, setShowViewer] = useState(false);
  
  // SignalR connection
  const connection = useRef<any>(null);

  // Reset the state for new upload
  const resetState = () => {
    setFile(null);
    setUploadStatus(null);
    setUploadedPptId(null);
    setSavingPpt({ status: 'pending', completed: false });
    setExtractingScripts({ status: 'pending', completed: false });
    setExtractingImages({ status: 'pending', completed: false });
    setProcessingComplete(false);
    setShowViewer(false);
  };

  // Connect to SignalR hub when a PowerPoint is uploaded
  useEffect(() => {
    if (!uploadedPptId) return;
    
    // Reset processing state
    setSavingPpt({ status: 'pending', completed: false });
    setExtractingScripts({ status: 'pending', completed: false });
    setExtractingImages({ status: 'pending', completed: false });
    setProcessingComplete(false);
    setShowViewer(false);
    
    // Create SignalR connection
    const newConnection = new HubConnectionBuilder()
      .withUrl(SIGNALR_URL)
      .withAutomaticReconnect()
      .build();
    
    connection.current = newConnection;
    
    // Set up event handlers for different message types
    newConnection.on('ReceiveStatusUpdate', (data: any) => {
      console.log('Status update:', data);
      
      // Handle overall status updates
      if (data.status === 'Completed') {
        setProcessingComplete(true);
        
        // Ensure all checkboxes are marked as completed
        setSavingPpt({ status: 'completed', completed: true });
        setExtractingScripts({ status: 'completed', completed: true });
        setExtractingImages({ status: 'completed', completed: true });
        
        setUploadStatus({
          success: true,
          message: 'PowerPoint processing completed successfully!',
          fileId: uploadedPptId
        });
        
        // Show the viewer when processing is complete
        setShowViewer(true);
      } else if (data.status === 'Processing') {
        setSavingPpt({ status: 'completed', completed: true });
      } else if (data.status === 'Failed') {
        setUploadStatus({
          success: false,
          message: `Processing failed: ${data.detail || 'Unknown error'}`
        });
      }
    });
    
    newConnection.on('ReceiveProcessingUpdate', (data: any) => {
      console.log('Processing update:', data);
      
      // Handle specific processing updates
      if (data.processingType === 'BlobStorage' && data.status === 'Completed') {
        setSavingPpt({ status: 'completed', completed: true });
      } else if (data.processingType === 'ScriptProcessing') {
        if (data.status === 'Processing') {
          setExtractingScripts({ status: 'processing', completed: false });
        } else if (data.status === 'Completed') {
          setExtractingScripts({ status: 'completed', completed: true });
        }
      } else if (data.processingType === 'ImageProcessing') {
        if (data.status === 'Processing') {
          setExtractingImages({ status: 'processing', completed: false });
        } else if (data.status === 'Completed') {
          setExtractingImages({ status: 'completed', completed: true });
        }
      }
    });
    
    // Start the connection and subscribe to updates for this PowerPoint
    const startConnection = async () => {
      try {
        await newConnection.start();
        console.log('SignalR connected');
        
        // Subscribe to updates for this PowerPoint
        await newConnection.invoke('SubscribeToPptUpdates', uploadedPptId);
        console.log('Subscribed to updates for:', uploadedPptId);
      } catch (err) {
        console.error('Error connecting to SignalR:', err);
      }
    };
    
    startConnection();
    
    // Clean up when component unmounts or pptId changes
    return () => {
      if (connection.current) {
        connection.current.stop();
      }
    };
  }, [uploadedPptId]);

  // File validation function
  const validateFile = (file: File): boolean => {
    const validExtensions = ['.ppt', '.pptx'];
    const fileName = file.name.toLowerCase();
    const fileExtension = fileName.substring(fileName.lastIndexOf('.'));
    
    return validExtensions.includes(fileExtension);
  };

  // Handle file drop
  const handleFileDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      
      if (validateFile(droppedFile)) {
        setFile(droppedFile);
        setUploadStatus(null);
      } else {
        setUploadStatus({
          success: false,
          message: 'Invalid file type. Please upload a PowerPoint file (.ppt or .pptx).'
        });
      }
    }
  }, []);

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      
      if (validateFile(selectedFile)) {
        setFile(selectedFile);
        setUploadStatus(null);
      } else {
        setUploadStatus({
          success: false,
          message: 'Invalid file type. Please upload a PowerPoint file (.ppt or .pptx).'
        });
      }
    }
  };

  // File upload function
  const uploadFile = async () => {
    if (!file) return;

    setIsUploading(true);
    setUploadStatus(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', 'anonymous'); // Replace with actual user ID if available

      const response = await axios.post(API_URL, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      // Set the uploaded PowerPoint ID to trigger the SignalR connection
      setUploadedPptId(response.data.pptId);
      
      // Start with saving PPT in progress
      setSavingPpt({ status: 'processing', completed: false });
      
      setUploadStatus({
        success: true,
        message: `Successfully uploaded ${file.name}`,
        fileId: response.data.pptId
      });
    } catch (error) {
      let errorMessage = 'Failed to upload file';
      if (axios.isAxiosError(error) && error.response) {
        errorMessage = error.response.data || errorMessage;
      }
      
      setUploadStatus({
        success: false,
        message: errorMessage
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Status indicator component
  const StatusIndicator = ({ status, label }: { status: { status: string, completed: boolean }, label: string }) => {
    const getStatusColor = () => {
      switch (status.status) {
        case 'completed':
          return '#4ade80'; // Green
        case 'processing':
          return '#3b82f6'; // Blue
        case 'pending':
        default:
          return '#d1d5db'; // Gray
      }
    };
    
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          mb: 1.5
        }}
      >
        <Box
          sx={{
            width: 20,
            height: 20,
            border: `2px solid ${getStatusColor()}`,
            borderRadius: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mr: 1.5,
            bgcolor: status.completed ? getStatusColor() : 'transparent'
          }}
        >
          {status.completed && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M5 12L10 17L19 8" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </Box>
        <Typography>{label}</Typography>
        {status.status === 'processing' && (
          <Box
            sx={{
              ml: 1,
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <Box
              sx={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                bgcolor: '#3b82f6',
                mr: 0.5,
                animation: 'pulse 1.5s infinite',
                '@keyframes pulse': {
                  '0%': { opacity: 0.4 },
                  '50%': { opacity: 1 },
                  '100%': { opacity: 0.4 }
                }
              }}
            />
            <Typography variant="body2">Processing...</Typography>
          </Box>
        )}
      </Box>
    );
  };

  // If viewer is shown, hide the upload form and show the PowerPointViewer component
  if (showViewer && uploadedPptId) {
    return <PowerPointViewer pptId={uploadedPptId} onBack={() => setShowViewer(false)} />;
  }

  return (
    <Card sx={{ maxWidth: 600, mx: 'auto', mt: 4 }}>
      <CardContent>
        {uploadStatus && !uploadStatus.success && (
          <Alert severity="error" sx={{ mb: 2 }}>
            <AlertTitle>Error</AlertTitle>
            {uploadStatus.message}
          </Alert>
        )}
        {uploadStatus && uploadStatus.success && !processingComplete && (
          <Alert severity="success" sx={{ mb: 2 }}>
            <AlertTitle>Success</AlertTitle>
            {uploadStatus.message}
            {uploadStatus.fileId && (
              <Typography variant="body2">
                File ID: {uploadStatus.fileId}
              </Typography>
            )}
          </Alert>
        )}
        
        <Box
          sx={{
            border: isDragging ? '2px dashed primary.main' : '2px dashed grey.400',
            borderRadius: 2,
            p: 4,
            mb: 2,
            textAlign: 'center',
            bgcolor: isDragging ? 'rgba(25, 118, 210, 0.05)' : 'transparent'
          }}
          onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleFileDrop}
        >
          <PowerPointLogo
            width={60}
            height={60}
            style={{ fill: '#D24726', marginBottom: 16 }}
          />

          <Typography variant="h6" gutterBottom>
            Drag & Drop
          </Typography>
          <input
            type="file"
            accept=".ppt,.pptx"
            id="file-input"
            style={{ display: 'none' }}
            onChange={handleFileSelect}
          />
          <label htmlFor="file-input">
            <Button variant="outlined" component="span">
              Browse Files
            </Button>
          </label>
        </Box>

        {file && (
          <Box
            sx={{
              mt: 2,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center'
            }}
          >
            <Typography variant="body1" gutterBottom>
              Selected file: <strong>{file.name}</strong> ({(file.size / (1024 * 1024)).toFixed(2)} MB)
            </Typography>
            <Box
              sx={{
                display: 'flex',
                gap: 2,
                mt: 1
              }}
            >
              <Button
                variant="contained"
                color="primary"
                onClick={uploadFile}
                disabled={isUploading}
              >
                {isUploading ? <CircularProgress size={24} color="inherit" /> : 'Upload File'}
              </Button>
              <Button 
                variant="outlined" 
                color="secondary" 
                onClick={resetState} 
                disabled={isUploading}
              >
                Cancel
              </Button>
            </Box>
          </Box>
        )}
        
        {/* Processing Status Section */}
        {uploadedPptId && (
          <Box
            sx={{
              mt: 3,
              p: 2,
              bgcolor: 'background.paper',
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'divider'
            }}
          >
            <Typography variant="h6" gutterBottom>
              Processing Status
            </Typography>
            
            <StatusIndicator status={savingPpt} label="Saving PowerPoint" />
            <StatusIndicator status={extractingScripts} label="Extracting Scripts" />
            <StatusIndicator status={extractingImages} label="Extracting Images" />
            
            {processingComplete && (
              <Alert severity="success" sx={{ mt: 2 }}>
                <AlertTitle>Success</AlertTitle>
                Processing completed successfully!
              </Alert>
            )}
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default FileUpload;