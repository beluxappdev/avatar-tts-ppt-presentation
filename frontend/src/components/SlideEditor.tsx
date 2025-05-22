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
  TextField
} from '@mui/material';

import HarryAvatar from '../assets/avatars/harry.png';
import JeffAvatar from '../assets/avatars/jeff.png';
import LisaAvatar from '../assets/avatars/lisa.png';
import LoriAvatar from '../assets/avatars/lori.png';
import MaxAvatar from '../assets/avatars/max.png';

import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import DeleteIcon from '@mui/icons-material/Delete';

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
  position: EditorSlide['avatarPosition']
): React.CSSProperties => {
  const style: React.CSSProperties = {
    position: 'absolute',
    objectFit: 'contain',
    transition: 'all 0.3s ease',
    pointerEvents: 'none',
  };

  switch (size) {
    case 'Small': style.width = '30px'; style.height = '30px'; break;
    case 'Medium': style.width = '50px'; style.height = '50px'; break;
    case 'Large': style.width = '70px'; style.height = '70px'; break;
  }

  switch (position) {
    case 'Left':
      style.left = '5px';
      style.bottom = '5px';
      break;
    case 'Center':
      style.left = '50%';
      style.bottom = '5px';
      style.transform = 'translateX(-50%)';
      break;
    case 'Right':
      style.right = '5px';
      style.bottom = '5px';
      break;
    case 'UpperLeft':
      style.left = '5px';
      style.top = '5px';
      break;
    case 'UpperCenter':
      style.left = '50%';
      style.top = '5px';
      style.transform = 'translateX(-50%)';
      break;
    case 'UpperRight':
      style.right = '5px';
      style.top = '5px';
      break;
  }
  return style;
};

const SlideEditor: React.FC<SlideEditorProps> = ({ slides: initialSlides, pptId }) => {
  const [slides, setSlides] = useState<EditorSlide[]>(initialSlides);
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    setSlides(initialSlides);
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

  const handleGenerateVideo = () => {
    setIsProcessing(true);
    console.log("Generating video with slides data:", slides);
    setTimeout(() => {
      setIsProcessing(false);
      alert('Video generation sent');
    }, 2000);
  };

  const renderSlide = (slide: EditorSlide, index: number) => (
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
        alignItems: 'center', 
        gap: 1,
        opacity: draggedItemIndex === index ? 0.5 : 1,
        transition: 'all 0.2s ease',
        '&:hover': {
          backgroundColor: 'rgba(0, 0, 0, 0.02)'
        }
      }}
    >
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
      
      {/* Slide thumbnail with avatar */}
      <Box sx={{ 
        position: 'relative', 
        width: 160, 
        height: 90, 
        flexShrink: 0, 
        borderRadius: 1, 
        overflow: 'hidden' 
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
            style={getAvatarStyle(slide.avatarSize, slide.avatarPosition)}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        )}
      </Box>
      
      <CardContent sx={{ flexGrow: 1, p: '0 !important', ml: 1 }}>
        <Typography variant="subtitle1" gutterBottom>
          {slide.title} (Index: {slide.index})
        </Typography>
        
        {/* Script text-area/field */}
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
          maxRows={4}
          sx={{ mt: 1, mb: 1, userSelect: 'text!important' }}
        />
        
        {/* Voice config */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
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
      </CardContent>
      
      {/* Delete button */}
      <IconButton
        aria-label="delete slide"
        onClick={() => handleDeleteSlide(slide.id)}
        sx={{ flexShrink: 0 }}
        color="error"
      >
        <DeleteIcon />
      </IconButton>
    </Paper>
  );

  return (
    <Box sx={{ p: 2 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5">
          Slide Editor (PPT ID: {pptId || 'N/A'})
        </Typography>
        <Button 
          variant="contained" 
          color="primary"
          disabled={slides.length === 0 || isProcessing}
          onClick={handleGenerateVideo}
        >
          {isProcessing ? 'Processing...' : 'Generate Video'}
        </Button>
      </Box>
      
      <Divider sx={{ mb: 2 }} />
      
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Drag slides to reorder them. Customize voice, avatar size, and position for each slide.
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