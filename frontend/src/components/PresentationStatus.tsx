import React from 'react';
import { 
  Paper, 
  Typography, 
  List, 
  ListItem, 
  ListItemIcon, 
  ListItemText,
  CircularProgress
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import ErrorIcon from '@mui/icons-material/Error';
import { ProcessingStep } from '../hooks/useProcessingStatus';

interface PresentationStatusProps {
  pptId: string | null;
  processingSteps: Record<string, ProcessingStep>;
  statusMessage: string | null;
}

const PresentationStatus: React.FC<PresentationStatusProps> = ({ 
  pptId, 
  processingSteps, 
  statusMessage 
}) => {
  const getStatusIcon = (status: ProcessingStep['status']) => {
    if (status === 'completed') return <CheckCircleIcon color="success" />;
    if (status === 'processing') return <CircularProgress size={20} />;
    if (status === 'failed') return <ErrorIcon color="error" />;
    return <HourglassEmptyIcon color="disabled" />;
  };

  if (!pptId) return null;

  return (
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
      {statusMessage && (
        <Typography variant="caption" display="block" sx={{mt: 1}}>
          {statusMessage}
        </Typography>
      )}
    </Paper>
  );
};

export default PresentationStatus;