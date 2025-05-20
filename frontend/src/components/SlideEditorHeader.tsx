import React from 'react';
import { Box, Button, Typography, Divider, Alert } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

interface SlideEditorHeaderProps {
  pptId: string | null;
  slideCount: number;
  allExpanded: boolean;
  isProcessing: boolean;
  submitSuccess: boolean;
  submitError: string | null;
  onToggleAllExpansion: () => void;
  onGenerateVideo: () => void;
}

const SlideEditorHeader: React.FC<SlideEditorHeaderProps> = ({
  pptId,
  slideCount,
  allExpanded,
  isProcessing,
  submitSuccess,
  submitError,
  onToggleAllExpansion,
  onGenerateVideo
}) => {
  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5">
          Slide Editor (PPT ID: {pptId || 'N/A'})
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button 
            variant="outlined"
            onClick={onToggleAllExpansion}
            startIcon={allExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          >
            {allExpanded ? 'Collapse All' : 'Expand All'}
          </Button>
          <Button 
            variant="contained" 
            color="primary"
            disabled={slideCount === 0 || isProcessing}
            onClick={onGenerateVideo}
          >
            {isProcessing ? 'Processing...' : 'Generate Video'}
          </Button>
        </Box>
      </Box>
      
      <Divider sx={{ mb: 2 }} />

      {submitSuccess && (
        <Box sx={{ mb: 2 }}>
          <Alert severity="success">
            Video generation request submitted successfully!
          </Alert>
        </Box>
      )}

      {submitError && (
        <Box sx={{ mb: 2 }}>
          <Alert severity="error">
            Error: {submitError}
          </Alert>
        </Box>
      )}
      
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Drag slides to reorder them. {allExpanded ? 'Use the collapse buttons to focus on slide content.' : 'Use the expand buttons to configure avatar settings.'}
      </Typography>
    </>
  );
};

export default SlideEditorHeader;