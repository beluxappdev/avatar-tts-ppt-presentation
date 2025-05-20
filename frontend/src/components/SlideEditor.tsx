import React, { useState, DragEvent, useEffect, useMemo } from 'react';
import {
  Box,
  CardContent,
  CardMedia,
  Typography,
  IconButton,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  SelectChangeEvent,
  Paper,
  Divider,
  Stack,
  TextField,
  Collapse,
  Alert
} from '@mui/material';

import axios from 'axios';

// reset all
// restore deleted

import HarryAvatar from '../assets/avatars/harry.png';
import JeffAvatar from '../assets/avatars/jeff.png';
import LisaAvatar from '../assets/avatars/lisa.png';
import LoriAvatar from '../assets/avatars/lori.png';
import MaxAvatar from '../assets/avatars/max.png';

import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

const VOICE_OPTIONS = ['Harry', 'Jeff', 'Lisa', 'Lori', 'Max'];
const AVATAR_SIZES = ['Small', 'Medium', 'Large'] as const;
const AVATAR_POSITIONS = [
  'Left', 
  'Center', 
  'Right', 
  'UpperLeft', 
  'UpperCenter', 
  'UpperRight'
] as const;

const AVATAR_IMAGE_MAP = {
  Harry: HarryAvatar,
  Jeff: JeffAvatar,
  Lisa: LisaAvatar,
  Lori: LoriAvatar,
  Max: MaxAvatar,
};

export interface EditorSlide {
  id: string;
  index: number;
  title: string;
  thumbnailUrl: string;
  voice: string;
  avatarSize: typeof AVATAR_SIZES[number];
  avatarPosition: typeof AVATAR_POSITIONS[number];
  script?: string;
}

interface SlideEditorProps {
  slides: EditorSlide[];
  pptId: string | null;
}

const getAvatarImageUrl = (voice: string): string => {
  return AVATAR_IMAGE_MAP[voice as keyof typeof AVATAR_IMAGE_MAP] || '';
};

const getAvatarStyle = (
  size: EditorSlide['avatarSize'],
  position: EditorSlide['avatarPosition'],
  isExpanded: boolean
): React.CSSProperties => {
  const style: React.CSSProperties = {
    position: 'absolute',
    objectFit: 'contain',
    transition: 'all 0.3s ease',
    pointerEvents: 'none',
  };

  let baseAvatarWidth: number;
  let baseAvatarHeight: number;
  const baseOffset = 5;

  switch (size) {
  case 'Small':
    baseAvatarWidth = 30;
    baseAvatarHeight = 30;
    break;
  case 'Medium':
    baseAvatarWidth = 50;
    baseAvatarHeight = 50;
    break;
  case 'Large':
    baseAvatarWidth = 70;
    baseAvatarHeight = 70;
    break;
  default:
    baseAvatarWidth = 50; 
    baseAvatarHeight = 50;
  }

  const scaleFactor = isExpanded ? 1 : 1.5; 

  style.width = `${baseAvatarWidth * scaleFactor}px`;
  style.height = `${baseAvatarHeight * scaleFactor}px`;
  const currentOffset = `${baseOffset * scaleFactor}px`;

  switch (position) {
    case 'Left':
      style.left = currentOffset;
      style.bottom = currentOffset;
      break;
    case 'Center':
      style.left = '50%';
      style.bottom = currentOffset;
      style.transform = `translateX(-50%) scale(${scaleFactor})`;
      style.transformOrigin = 'bottom center';
      break;
    case 'Right':
      style.right = currentOffset;
      style.bottom = currentOffset;
      break;
    case 'UpperLeft':
      style.left = currentOffset;
      style.top = currentOffset;
      break;
    case 'UpperCenter':
      style.left = '50%';
      style.top = currentOffset;
      style.transform = `translateX(-50%) scale(${scaleFactor})`;
      style.transformOrigin = 'top center';
      break;
    case 'UpperRight':
      style.right = currentOffset;
      style.top = currentOffset;
      break;
  }
  return style;
};

const SlideEditor: React.FC<SlideEditorProps> = ({ slides: initialSlides, pptId }) => {
  const [slides, setSlides] = useState<EditorSlide[]>(initialSlides);
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [expandedSlides, setExpandedSlides] = useState<Record<string, boolean>>({});
  const [allExpanded, setAllExpanded] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  useEffect(() => {
    setSlides(initialSlides);
    const newExpandedState: Record<string, boolean> = {};
    initialSlides.forEach(slide => {
      newExpandedState[slide.id] = allExpanded;
    });
    setExpandedSlides(newExpandedState);
  }, [initialSlides]);

  const handleDeleteSlide = (id: string) => {
    setSlides(prevSlides => prevSlides.filter(slide => slide.id !== id));
  };

  const handleSlideChange = (id: string, field: keyof EditorSlide, value: string) => {
    setSlides(prevSlides =>
      prevSlides.map(slide =>
        slide.id === id ? { ...slide, [field]: value } : slide
      )
    );
  };

  const toggleSlideExpansion = (id: string) => {
    setExpandedSlides(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const toggleAllExpansion = () => {
    const newExpandedState = !allExpanded;
    setAllExpanded(newExpandedState);
    
    const newExpandedSlides: Record<string, boolean> = {};
    slides.forEach(slide => {
      newExpandedSlides[slide.id] = newExpandedState;
    });
    setExpandedSlides(newExpandedSlides);
  };

  const onDragStart = (e: DragEvent<HTMLDivElement>, index: number) => {
    const target = e.target as HTMLElement;
    const isTextField = target.closest('.MuiTextField-root') !== null;
    
    if (isTextField) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    
    setDraggedItemIndex(index);
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
    }
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    const target = e.currentTarget as HTMLDivElement;
    
    if (draggedItemIndex === null || draggedItemIndex === index) return;
    
    target.style.borderTop = draggedItemIndex < index ? '2px solid #1976d2' : 'none';
    target.style.borderBottom = draggedItemIndex > index ? '2px solid #1976d2' : 'none';
  };
  
  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    const target = e.currentTarget as HTMLDivElement;
    target.style.borderTop = 'none';
    target.style.borderBottom = 'none';
  };
  
  const onDrop = (e: DragEvent<HTMLDivElement>, targetIndex: number) => {
    e.preventDefault();
    const target = e.currentTarget as HTMLDivElement;
    target.style.borderTop = 'none';
    target.style.borderBottom = 'none';
    
    if (draggedItemIndex === null || draggedItemIndex === targetIndex) {
      setDraggedItemIndex(null);
      return;
    }

    const newSlides = [...slides];
    const draggedItem = newSlides.splice(draggedItemIndex, 1)[0];
    newSlides.splice(targetIndex, 0, draggedItem);
    
    setSlides(newSlides);
    setDraggedItemIndex(null);
  };

  const onDragEnd = (e: DragEvent<HTMLDivElement>) => {
    const target = e.currentTarget as HTMLDivElement;
    target.style.borderTop = 'none';
    target.style.borderBottom = 'none';
    setDraggedItemIndex(null);
  };

const handleGenerateVideo = async () => {
    if (!pptId) {
      console.error("Missing PPT ID");
      return;
    }

    setIsProcessing(true);
    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);
    
    try {
      const formattedSlides = slides.map(slide => ({
        index: slide.index,
        script: slide.script || "",
        avatarConfig: {
          showAvatar: true,
          avatarPosition: slide.avatarPosition.toLowerCase(),
          avatarSize: slide.avatarSize.toLowerCase(),
          avatarType: slide.voice.toLowerCase()
        }
      }));

      const requestBody = {
        pptId: pptId,
        userId: "K2SO",
        slides: formattedSlides
      };

      console.log("Sending video generation request:", requestBody);
      
      const response = await axios.post(
        'http://localhost:8080/api/generate_video',
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log("Video generation response:", response.data);
      setSubmitSuccess(true);
    } catch (error) {
      console.error("Error generating video:", error);
      setSubmitError(error instanceof Error ? error.message : "An error occurred during video generation");
    } finally {
      setIsProcessing(false);
      setIsSubmitting(false);
      
      if (!submitError) {
        setTimeout(() => {
          setSubmitSuccess(false);
        }, 5000);
      }
    }
  };

  const renderSlide = (slide: EditorSlide, index: number) => {
    const isExpanded = expandedSlides[slide.id] !== undefined ? expandedSlides[slide.id] : true;
    
    return (
      <Paper 
        key={slide.id}
        elevation={3}
        onDragOver={(e) => onDragOver(e, index)}
        onDragLeave={onDragLeave}
        onDrop={(e) => onDrop(e, index)}
        onDragEnd={onDragEnd}
        sx={{ 
          p: 2, 
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'flex-start', 
          gap: 1,
          opacity: draggedItemIndex === index ? 0.5 : 1,
          transition: 'all 0.2s ease',
          '&:hover': {
            backgroundColor: 'rgba(0, 0, 0, 0.02)'
          }
        }}
      >
        {/* Top row with drag handle, thumbnail, title and control buttons */}
        <Box sx={{ 
          display: 'flex', 
          width: '100%',
          alignItems: 'center', 
          gap: 2 
        }}>
          {/* Drag handle */}
          <Box
            draggable
            onDragStart={(e) => onDragStart(e, index)}
            sx={{
              cursor: 'grab',
              display: 'flex',
              alignItems: 'center',
              padding: '4px',
              borderRadius: '4px',
              '&:hover': {
                backgroundColor: 'rgba(0, 0, 0, 0.05)'
              }
            }}
          >
            <DragIndicatorIcon sx={{ color: 'action.active' }} />
          </Box>
          
          {/* Slide thumbnail with avatar - enlarged when collapsed */}
          <Box sx={{ 
            position: 'relative', 
            width: isExpanded ? 160 : 240, 
            height: isExpanded ? 90 : 135,
            flexShrink: 0, 
            borderRadius: 1, 
            overflow: 'hidden',
            transition: 'all 0.3s ease',
            boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
            '&:hover': {
              boxShadow: '0 3px 10px rgba(0,0,0,0.2)',
              transform: 'translateY(-2px)',
              filter: 'brightness(1.05)',
            }
          }}>
            <CardMedia
              component="img"
              sx={{ width: '100%', height: '100%'}}
              image={slide.thumbnailUrl}
              alt={slide.title}
            />
            {getAvatarImageUrl(slide.voice) && (
              <img
                src={getAvatarImageUrl(slide.voice)}
                alt={`${slide.voice} avatar`}
                style={getAvatarStyle(slide.avatarSize, slide.avatarPosition, isExpanded)}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            )}
          </Box>
          
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="subtitle1">
              {slide.title} (Index: {slide.index})
            </Typography>
            
            {/* Always show script even when collapsed */}
            <TextField
              className="slide-script-field"
              label="Script"
              multiline
              fullWidth
              variant="outlined"
              size="small"
              value={slide.script || ''}
              onChange={(e) => handleSlideChange(slide.id, 'script', e.target.value)}
              onMouseDown={(e) => e.stopPropagation()}
              minRows={2}
              maxRows={isExpanded ? 2 : 4}
              sx={{ mt: 1, mb: 1, userSelect: 'text!important' }}
            />
          </Box>
          
          {/* Control buttons */}
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <IconButton 
              size="small" 
              onClick={() => toggleSlideExpansion(slide.id)}
              aria-label={isExpanded ? "Collapse" : "Expand"}
            >
              {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
            <IconButton
              aria-label="delete slide"
              onClick={() => handleDeleteSlide(slide.id)}
              color="error"
            >
              <DeleteIcon />
            </IconButton>
          </Box>
        </Box>

        {/* Collapsible configuration section */}
        <Collapse in={isExpanded} sx={{ width: '100%' }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1, width: '100%' }}>
            {/* Voice selector */}
            <Box sx={{ width: { xs: '100%', sm: 'calc(33.33% - 8px)' } }}>
              <FormControl fullWidth size="small">
                <InputLabel>Voice</InputLabel>
                <Select
                  value={slide.voice}
                  label="Voice"
                  onChange={(e: SelectChangeEvent<string>) =>
                    handleSlideChange(slide.id, 'voice', e.target.value)
                  }
                >
                  {VOICE_OPTIONS.map(voice => (
                    <MenuItem key={voice} value={voice}>{voice}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            
            {/* Avatar size config */}
            <Box sx={{ width: { xs: '100%', sm: 'calc(33.33% - 8px)' } }}>
              <FormControl fullWidth size="small">
                <InputLabel>Avatar Size</InputLabel>
                <Select
                  value={slide.avatarSize}
                  label="Avatar Size"
                  onChange={(e: SelectChangeEvent<string>) =>
                    handleSlideChange(slide.id, 'avatarSize', e.target.value as EditorSlide['avatarSize'])
                  }
                >
                  {AVATAR_SIZES.map(size => (
                    <MenuItem key={size} value={size}>{size}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            
            {/* Avatar position config */}
            <Box sx={{ width: { xs: '100%', sm: 'calc(33.33% - 8px)' } }}>
              <FormControl fullWidth size="small">
                <InputLabel>Avatar Position</InputLabel>
                <Select
                  value={slide.avatarPosition}
                  label="Avatar Position"
                  onChange={(e: SelectChangeEvent<string>) =>
                    handleSlideChange(slide.id, 'avatarPosition', e.target.value as EditorSlide['avatarPosition'])
                  }
                >
                  {AVATAR_POSITIONS.map(pos => (
                    <MenuItem key={pos} value={pos}>{pos}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          </Box>
        </Collapse>
      </Paper>
    );
  };

  return (
    <Box sx={{ p: 2 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5">
          Slide Editor (PPT ID: {pptId || 'N/A'})
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button 
            variant="outlined"
            onClick={toggleAllExpansion}
            startIcon={allExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          >
            {allExpanded ? 'Collapse All' : 'Expand All'}
          </Button>
          <Button 
            variant="contained" 
            color="primary"
            disabled={slides.length === 0 || isProcessing}
            onClick={handleGenerateVideo}
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
      
      {/* Slides list */}
      <Stack spacing={2}>
        {slides.map(renderSlide)}
      </Stack>

      {/* Empty state */}
      {slides.length === 0 && (
        <Typography sx={{ mt: 2 }}>
          {pptId 
            ? "Waiting for slides to be processed or no slides found." 
            : "Upload a presentation to see slides here."
          }
        </Typography>
      )}
    </Box>
  );
};

export default SlideEditor;