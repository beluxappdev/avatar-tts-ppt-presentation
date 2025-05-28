import React from 'react';
import { Typography, Box, CircularProgress } from '@mui/material';
import SlideEditor, { EditorSlide } from './SlideEditor';
import PresentationStatus from './PresentationStatus';

interface PresentationViewProps {
  pptId: string | null;
  processingSteps: Record<string, any>;
  statusMessage: string | null;
  allProcessingComplete: boolean;
  slides: EditorSlide[];
}

const PresentationView: React.FC<PresentationViewProps> = ({
  pptId,
  processingSteps,
  statusMessage,
  allProcessingComplete,
  slides
}) => {
  return (
    <>
      <Typography variant="h5" gutterBottom>Presentation Status</Typography>
      
      <PresentationStatus 
        pptId={pptId}
        processingSteps={processingSteps}
        statusMessage={statusMessage}
      />
      
      {allProcessingComplete && slides.length > 0 ? (
        <SlideEditor slides={slides} pptId={pptId} />
      ) : allProcessingComplete && slides.length === 0 && !statusMessage?.includes("Error") ? (
        <Typography>No slides were processed or found for this presentation.</Typography>
      ) : !allProcessingComplete && pptId ? (
        <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'center', my: 2}}>
          <CircularProgress />
          <Typography sx={{ml:1}}>Processing presentation...</Typography>
        </Box>
      ) : null}
    </>
  );
};

export default PresentationView;