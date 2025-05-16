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
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField
} from '@mui/material';
import Grid from '@mui/material/Grid';
import axios from 'axios';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import SettingsIcon from '@mui/icons-material/Settings';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import MegBusinessAvatar from '../assets/meg-business-transparent.png';
import HarryBusinessAvatar from '../assets/harry-business-transparent.png';

interface Slide {
  index: number;
  blobUrl: string;
  script: string | null;
}

interface PowerPointViewerProps {
  pptId: string;
  onBack: () => void;
}

// Avatar position and size options
type AvatarPosition = 'left' | 'center' | 'right';
type AvatarSize = 'small' | 'medium' | 'large';
type AvatarType = 'meg' | 'harry';

// Interface for storing per-slide avatar configuration
interface SlideAvatarConfig {
  showAvatar: boolean;
  avatarPosition: AvatarPosition;
  avatarSize: AvatarSize;
  avatarType: AvatarType;
}

// Interface for the API payload
interface VideoGenerationPayload {
  pptId: string;
  slides: Array<{
    index: number;
    script: string | null;
    avatarConfig: SlideAvatarConfig;
  }>;
}

const PowerPointViewer: React.FC<PowerPointViewerProps> = ({ pptId, onBack }) => {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  
  // Video generation states
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [videoGenerationError, setVideoGenerationError] = useState<string | null>(null);
  const [showDebugDialog, setShowDebugDialog] = useState(false);
  const [debugPayload, setDebugPayload] = useState<string>('');
  
  // Default avatar configuration
  const defaultAvatarConfig: SlideAvatarConfig = {
    showAvatar: true,
    avatarPosition: 'right',
    avatarSize: 'medium',
    avatarType: 'meg'
  };
  
  // Store configurations for each slide
  const [slideConfigs, setSlideConfigs] = useState<{[key: number]: SlideAvatarConfig}>({});
  
  // Current slide configuration (derived from slideConfigs or default)
  const getCurrentConfig = (): SlideAvatarConfig => {
    return slideConfigs[currentSlide] || defaultAvatarConfig;
  };
  
  // Avatar configuration getters
  const showAvatar = getCurrentConfig().showAvatar;
  const avatarPosition = getCurrentConfig().avatarPosition;
  const avatarSize = getCurrentConfig().avatarSize;
  const avatarType = getCurrentConfig().avatarType;
  
  // State to track the dimensions of the slide image
  const [slideImageDimensions, setSlideImageDimensions] = useState({ width: 0, height: 0 });
  const [fullscreenImageDimensions, setFullscreenImageDimensions] = useState({ width: 0, height: 0 });

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

        console.log('Slides data:', data);
        
        if (data.slides && data.slides.length > 0) {
          setSlides(data.slides.map((slide: any, index: number) => ({
            index: index,
            blobUrl: slide.blobUrl,
            script: slide.script || null
          })));
          console.log('slides state:', slides);
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

  // Generate video with current configuration
  const generateVideo = async () => {
    try {
      setIsGeneratingVideo(true);
      setVideoGenerationError(null);
      
      // Prepare the payload
      const payload: VideoGenerationPayload = {
        pptId,
        slides: slides.map(slide => ({
          index: slide.index,
          script: slide.script,
          avatarConfig: slideConfigs[slide.index - 1] || defaultAvatarConfig
        }))
      };
      
      // Set debug payload for display
      setDebugPayload(JSON.stringify(payload, null, 2));
      
      // Make the API call
      const response = await axios.post('/api/generate_video', payload);
      
      if (response.status === 200) {
        // Handle successful video generation
        console.log('Video generation started successfully:', response.data);
        // You might want to navigate to a video status page or show a success message
      } else {
        throw new Error(`Failed to generate video: ${response.status}`);
      }
    } catch (err) {
      console.error('Error generating video:', err);
      setVideoGenerationError(`Error generating video: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsGeneratingVideo(false);
    }
  };

  // Handle image load to get dimensions
  const handleImageLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    setSlideImageDimensions({
      width: img.offsetWidth,
      height: img.offsetHeight
    });
  };

  // Handle fullscreen image load
  const handleFullscreenImageLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    setFullscreenImageDimensions({
      width: img.offsetWidth,
      height: img.offsetHeight
    });
  };

  // Get the avatar image based on the current type
  const getAvatarImage = (): string => {
    return avatarType === 'meg' ? MegBusinessAvatar : HarryBusinessAvatar;
  };

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

  // Update slide configuration
  const updateSlideConfig = (partialConfig: Partial<SlideAvatarConfig>) => {
    const currentConfig = getCurrentConfig();
    const newConfig = { ...currentConfig, ...partialConfig };
    
    setSlideConfigs(prevConfigs => ({
      ...prevConfigs,
      [currentSlide]: newConfig
    }));
  };

  // Handle avatar position change
  const handlePositionChange = (event: SelectChangeEvent) => {
    updateSlideConfig({ avatarPosition: event.target.value as AvatarPosition });
  };

  // Handle avatar size change
  const handleSizeChange = (event: SelectChangeEvent) => {
    updateSlideConfig({ avatarSize: event.target.value as AvatarSize });
  };

  // Handle avatar type change
  const handleAvatarTypeChange = (event: SelectChangeEvent) => {
    updateSlideConfig({ avatarType: event.target.value as AvatarType });
  };

  // Toggle avatar visibility
  const toggleAvatar = () => {
    updateSlideConfig({ showAvatar: !showAvatar });
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

  // Get avatar style based on size and position for normal view
  const getAvatarStyle = (): React.CSSProperties => {
    // Size configuration based on slide image dimensions
    let height;
    
    switch(avatarSize) {
      case 'small':
        height = '25%'; // 20% of slide width
        break;
      case 'large':
        height = '75%'; // 40% of slide width
        break;
      case 'medium':
      default:
        height = '50%'; // 30% of slide width
    }

    // Position configuration
    let positionProps: React.CSSProperties = {};
    switch(avatarPosition) {
      case 'left':
        positionProps = { left: '0%', bottom: '0%' };
        break;
      case 'center':
        positionProps = { left: '50%', bottom: '0%', transform: 'translateX(-50%)' };
        break;
      case 'right':
      default:
        positionProps = { right: '0%', bottom: '0%' };
    }

    return {
      height,
      position: 'absolute',
      ...positionProps,
      objectFit: 'contain' as 'contain',
      zIndex: 10
    };
  };

  // Get avatar style for fullscreen view
  const getFullscreenAvatarStyle = (): React.CSSProperties => {
    // Size configuration based on fullscreen image dimensions
    let height;
    
    switch(avatarSize) {
      case 'small':
        height = '25%'; // 20% of slide width
        break;
      case 'large':
        height = '100%'; // 40% of slide width
        break;
      case 'medium':
      default:
        height = '50%'; // 30% of slide width
    }

    // Position configuration
    let positionProps: React.CSSProperties = {};
    switch(avatarPosition) {
      case 'left':
        positionProps = { left: '0%', bottom: '0%' };
        break;
      case 'center':
        positionProps = { left: '50%', bottom: '0%', transform: 'translateX(-50%)' };
        break;
      case 'right':
      default:
        positionProps = { right: '0%', bottom: '0%' };
    }

    return {
      height,
      position: 'absolute',
      ...positionProps,
      objectFit: 'contain' as 'contain',
      zIndex: 10
    };
  };

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
      <Card sx={{ maxWidth: 1200, mx: 'auto', mt: 4 }}>
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
      <Card sx={{ maxWidth: 1200, mx: 'auto', mt: 4 }}>
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
          
          <Box sx={{ position: 'relative', display: 'inline-block' }}>
            <img 
              src={slides[currentSlide].blobUrl} 
              alt={`Slide ${currentSlide + 1}`} 
              style={{ 
                maxWidth: '90%', 
                maxHeight: '90vh',
                objectFit: 'contain'
              }}
              onLoad={handleFullscreenImageLoad}
            />
            
            {showAvatar && fullscreenImageDimensions.width > 0 && (
              <Box 
                sx={{ 
                  position: 'absolute',
                  width: fullscreenImageDimensions.width,
                  height: fullscreenImageDimensions.height,
                  top: 0,
                  left: 0
                }}
              >
                <img 
                  src={getAvatarImage()}
                  alt="Virtual presenter" 
                  style={getFullscreenAvatarStyle()}
                />
              </Box>
            )}
          </Box>
          
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
    <Card sx={{ maxWidth: 1200, mx: 'auto', mt: 4 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <IconButton onClick={onBack} sx={{ mr: 1 }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h5">PowerPoint Viewer</Typography>
        </Box>
        
        {/* Video Generation Section */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              color="success"
              startIcon={<VideoLibraryIcon />}
              onClick={generateVideo}
              disabled={isGeneratingVideo}
              size="large"
            >
              {isGeneratingVideo ? 'Generating Video...' : 'Generate Video'}
            </Button>
            
            <Button
              variant="outlined"
              onClick={() => setShowDebugDialog(true)}
              size="large"
            >
              View Debug Info
            </Button>
            
            {isGeneratingVideo && <CircularProgress size={24} />}
          </Box>
          
          {videoGenerationError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              <AlertTitle>Video Generation Error</AlertTitle>
              {videoGenerationError}
            </Alert>
          )}
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
        
        {/* Main Content Grid */}
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3 }}>
          {/* Slide Content - Left Side */}
          <Box sx={{ flex: { xs: '1 1 100%', md: '1 1 66.66%' } }}>
            {/* Slide Image */}
            <Paper
              elevation={2}
              sx={{
                p: 3,
                textAlign: 'center',
                bgcolor: 'grey.50',
                borderRadius: 2,
                position: 'relative',
                mb: 3
              }}
            >
              <Box sx={{ position: 'relative', display: 'inline-block' }}>
                <img 
                  src={slides[currentSlide].blobUrl} 
                  alt={`Slide ${currentSlide + 1}`} 
                  style={{ 
                    maxWidth: '100%', 
                    maxHeight: '400px',
                    objectFit: 'contain'
                  }}
                  onLoad={handleImageLoad}
                />
                
                {showAvatar && slideImageDimensions.width > 0 && (
                  <Box 
                    sx={{ 
                      position: 'absolute',
                      width: slideImageDimensions.width,
                      height: slideImageDimensions.height,
                      top: 0,
                      left: 0
                    }}
                  >
                    <img 
                      src={getAvatarImage()}
                      alt="Virtual presenter" 
                      style={getAvatarStyle()}
                    />
                  </Box>
                )}
              </Box>
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
          
          {/* Avatar Configuration - Right Side */}
          <Box sx={{ flex: { xs: '1 1 100%', md: '1 1 33.33%' } }}>
            <Paper
              elevation={2}
              sx={{
                p: 3,
                bgcolor: 'grey.50',
                borderRadius: 2,
                height: '100%'
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <SettingsIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6">Avatar Configuration</Typography>
              </Box>
              
              <Box sx={{ mb: 3 }}>
                <Button 
                  variant="contained" 
                  color={showAvatar ? "primary" : "secondary"}
                  onClick={toggleAvatar}
                  fullWidth
                >
                  {showAvatar ? "Hide Avatar" : "Show Avatar"}
                </Button>
              </Box>
              
              <FormControl fullWidth sx={{ mb: 3 }}>
                <InputLabel id="avatar-type-label">Avatar</InputLabel>
                <Select
                  labelId="avatar-type-label"
                  id="avatar-type"
                  value={avatarType}
                  label="Avatar"
                  onChange={handleAvatarTypeChange}
                  disabled={!showAvatar}
                >
                  <MenuItem value="meg">Meg</MenuItem>
                  <MenuItem value="harry">Harry</MenuItem>
                </Select>
              </FormControl>
              
              <FormControl fullWidth sx={{ mb: 3 }}>
                <InputLabel id="avatar-position-label">Position</InputLabel>
                <Select
                  labelId="avatar-position-label"
                  id="avatar-position"
                  value={avatarPosition}
                  label="Position"
                  onChange={handlePositionChange}
                  disabled={!showAvatar}
                >
                  <MenuItem value="left">Left</MenuItem>
                  <MenuItem value="center">Center</MenuItem>
                  <MenuItem value="right">Right</MenuItem>
                </Select>
              </FormControl>
              
              <FormControl fullWidth sx={{ mb: 3 }}>
                <InputLabel id="avatar-size-label">Size</InputLabel>
                <Select
                  labelId="avatar-size-label"
                  id="avatar-size"
                  value={avatarSize}
                  label="Size"
                  onChange={handleSizeChange}
                  disabled={!showAvatar}
                >
                  <MenuItem value="small">Small</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="large">Large</MenuItem>
                </Select>
              </FormControl>
            </Paper>
          </Box>
        </Box>
      </CardContent>
      
      {/* Debug Dialog */}
      <Dialog
        open={showDebugDialog}
        onClose={() => setShowDebugDialog(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>Debug: Video Generation Payload</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            This is the data that will be sent to /api/generate_video:
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={20}
            value={debugPayload || 'Click "Generate Video" to see the payload'}
            variant="outlined"
            InputProps={{
              readOnly: true,
              style: { fontFamily: 'monospace', fontSize: '0.875rem' }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDebugDialog(false)}>Close</Button>
          <Button
            onClick={() => navigator.clipboard.writeText(debugPayload)}
            variant="contained"
          >
            Copy to Clipboard
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
};

export default PowerPointViewer;