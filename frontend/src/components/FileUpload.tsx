import React, { useCallback, useState } from 'react';
import { 
  Box, 
  Button, 
  Card, 
  CardContent, 
  CircularProgress, 
  Typography, 
  Alert,
  AlertTitle 
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { ReactComponent as PowerPointLogo } from '../assets/powerpoint.svg';
import axios from 'axios';

// TODO: Point to backend
const API_URL = 'http://localhost:8080/api/save_ppt';

const FileUpload: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{
    success: boolean;
    message: string;
    fileId?: string;
  } | null>(null);

  const resetState = () => {
    setFile(null);
    setUploadStatus(null);
  };

  const validateFile = (file: File): boolean => {
    const validExtensions = ['.ppt', '.pptx'];
    const fileName = file.name.toLowerCase();
    const fileExtension = fileName.substring(fileName.lastIndexOf('.'));
    
    return validExtensions.includes(fileExtension);
  };

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

  const uploadFile = async () => {
    if (!file) return;

    setIsUploading(true);
    setUploadStatus(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
    //   formData.append('user_id', 'tenant123');

      const response = await axios.post(API_URL, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

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

  return (
    <Card sx={{ maxWidth: 600, mx: 'auto', mt: 4 }}>
      <CardContent>
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
      </CardContent>
    </Card>
  );
};

export default FileUpload;