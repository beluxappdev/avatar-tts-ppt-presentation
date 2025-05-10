import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Card, 
  CardContent, 
  Typography, 
  Button, 
  CircularProgress, 
  Alert, 
  AlertTitle,
  IconButton,
  Paper
} from '@mui/material';
import axios from 'axios';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import FullscreenIcon from '@mui/icons-material/Fullscreen';

interface Slide {
  slideNumber: number;
  blobUrl: string;
  script: string | null;
}

interface PowerPointViewerProps {
  pptId: string;
  onBack: () => void;
}

const PowerPointViewer: React.FC<PowerPointViewerProps> = ({ pptId, onBack }) => {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  // Fetch slides when component mounts or pptId changes
  useEffect(() => {
    const fetchSlides = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await axios.get(`/api/ppt/${pptId}/slides`);
        
        if (response.status !== 200) {
          throw new Error(`Failed to fetch slides: ${response.status}`);
        }
        
        const data = response.data;
        
        if (data.slides && data.slides.length > 0) {
          setSlides(data.slides);
          setCurrentSlide(0); // Start with the first slide
        } else {
          setError('No slides found for this presentation');
        }
      } catch (err) {
        console.error('Error fetching slides:', err);
        setError(`Error fetching slides: ${err instanceof Error ? err.message : 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    };

    fetchSlides();
  }, [pptId]);

  // Navigate to previous slide
  const prevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  // Navigate to next slide
  const nextSlide = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    }
  };

  // Toggle fullscreen mode for the slide
  const toggleFullscreen = () => {
    setFullscreen(!fullscreen);
  };

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        prevSlide();
      } else if (e.key === 'ArrowRight') {
        nextSlide();
      } else if (e.key === 'Escape' && fullscreen) {
        setFullscreen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentSlide, slides.length, fullscreen]);

  if (loading) {
    return (
      <Box 
        sx={{ 
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 400
        }}
      >
        <CircularProgress size={60} sx={{ mb: 2 }} />
        <Typography variant="h6">Loading slides...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Card sx={{ maxWidth: 800, mx: 'auto', mt: 4 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <IconButton onClick={onBack} sx={{ mr: 1 }}>
              <ArrowBackIcon />
            </IconButton>
            <Typography variant="h5">PowerPoint Viewer</Typography>
          </Box>
          <Alert severity="error">
            <AlertTitle>Error</AlertTitle>
            {error}
          </Alert>
          <Box sx={{ mt: 2, textAlign: 'center' }}>
            <Button variant="contained" onClick={onBack}>
              Back to Upload
            </Button>
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (slides.length === 0) {
    return (
      <Card sx={{ maxWidth: 800, mx: 'auto', mt: 4 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <IconButton onClick={onBack} sx={{ mr: 1 }}>
              <ArrowBackIcon />
            </IconButton>
            <Typography variant="h5">PowerPoint Viewer</Typography>
          </Box>
          <Alert severity="warning">
            <AlertTitle>No Slides</AlertTitle>
            No slides were found in this presentation.
          </Alert>
          <Box sx={{ mt: 2, textAlign: 'center' }}>
            <Button variant="contained" onClick={onBack}>
              Back to Upload
            </Button>
          </Box>
        </CardContent>
      </Card>
    );
  }

  // Fullscreen view
  if (fullscreen) {
    return (
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          bgcolor: 'black',
          zIndex: 1300,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          p: 2
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: 16,
            right: 16,
            zIndex: 1301
          }}
        >
          <IconButton 
            sx={{ color: 'white' }}
            onClick={toggleFullscreen}
          >
            <FullscreenIcon />
          </IconButton>
        </Box>
        
        <Box
          sx={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative'
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              left: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1301
            }}
          >
            <IconButton 
              sx={{ color: 'white' }}
              onClick={prevSlide} 
              disabled={currentSlide === 0}
            >
              <NavigateBeforeIcon fontSize="large" />
            </IconButton>
          </Box>
          
          <img 
            src={slides[currentSlide].blobUrl} 
            alt={`Slide ${currentSlide + 1}`} 
            style={{ 
              maxWidth: '90%', 
              maxHeight: '90vh',
              objectFit: 'contain'
            }}
          />
          
          <Box
            sx={{
              position: 'absolute',
              right: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1301
            }}
          >
            <IconButton 
              sx={{ color: 'white' }}
              onClick={nextSlide} 
              disabled={currentSlide === slides.length - 1}
            >
              <NavigateNextIcon fontSize="large" />
            </IconButton>
          </Box>
        </Box>
        
        <Box
          sx={{
            position: 'absolute',
            bottom: 16,
            color: 'white',
            bgcolor: 'rgba(0, 0, 0, 0.5)',
            px: 2,
            py: 0.5,
            borderRadius: 1
          }}
        >
          Slide {currentSlide + 1} of {slides.length}
        </Box>
      </Box>
    );
  }

  return (
    <Card sx={{ maxWidth: 900, mx: 'auto', mt: 4 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <IconButton onClick={onBack} sx={{ mr: 1 }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h5">PowerPoint Viewer</Typography>
        </Box>
        
        {/* Slide Navigation */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 2
          }}
        >
          <Button 
            variant="contained"
            startIcon={<NavigateBeforeIcon />}
            onClick={prevSlide} 
            disabled={currentSlide === 0}
          >
            Previous
          </Button>
          
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Typography variant="body1">
              Slide {currentSlide + 1} of {slides.length}
            </Typography>
            <IconButton onClick={toggleFullscreen} sx={{ ml: 1 }}>
              <FullscreenIcon />
            </IconButton>
          </Box>
          
          <Button 
            variant="contained"
            endIcon={<NavigateNextIcon />}
            onClick={nextSlide} 
            disabled={currentSlide === slides.length - 1}
          >
            Next
          </Button>
        </Box>
        
        {/* Slide Content */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Slide Image */}
          <Paper
            elevation={2}
            sx={{
              p: 3,
              textAlign: 'center',
              bgcolor: 'grey.50',
              borderRadius: 2,
              position: 'relative'
            }}
          >
            <img 
              src={slides[currentSlide].blobUrl} 
              alt={`Slide ${currentSlide + 1}`} 
              style={{ 
                maxWidth: '100%', 
                maxHeight: '400px',
                objectFit: 'contain'
              }}
            />
          </Paper>
          
          {/* Slide Script */}
          <Paper
            elevation={2}
            sx={{
              p: 3,
              bgcolor: 'primary.light',
              color: 'primary.contrastText',
              borderRadius: 2
            }}
          >
            <Typography variant="h6" gutterBottom>
              Slide Script
            </Typography>
            {slides[currentSlide].script ? (
              <Typography
                variant="body1" 
                sx={{ 
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'inherit'
                }}
              >
                {slides[currentSlide].script}
              </Typography>
            ) : (
              <Typography variant="body1" sx={{ fontStyle: 'italic', opacity: 0.8 }}>
                No script available for this slide.
              </Typography>
            )}
          </Paper>
        </Box>
      </CardContent>
    </Card>
  );
};

export default PowerPointViewer;