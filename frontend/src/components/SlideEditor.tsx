import React, { useState, DragEvent, useEffect } from 'react';
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
  Stack
} from '@mui/material';

// Import avatar images
import HarryAvatar from '../assets/avatars/harry.png';
import JeffAvatar from '../assets/avatars/jeff.png';
import LisaAvatar from '../assets/avatars/lisa.png';
import LoriAvatar from '../assets/avatars/lori.png';
import MaxAvatar from '../assets/avatars/max.png';

// import DeleteIcon from '@mui/icons-material/Delete';
// import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
// import MovieIcon from '@mui/icons-material/Movie';


export interface EditorSlide {
  id: string;
  index: number;
  title: string;
  thumbnailUrl: string;
  voice: string;
  avatarSize: 'Small' | 'Medium' | 'Large';
  avatarPosition: 'Left' | 'Center' | 'Right';
  script?: string;
}

const VOICE_OPTIONS = ['Harry', 'Jeff', 'Lisa', 'Lori', 'Max'];
const AVATAR_SIZES: EditorSlide['avatarSize'][] = ['Small', 'Medium', 'Large'];
const AVATAR_POSITIONS: EditorSlide['avatarPosition'][] = ['Left', 'Center', 'Right'];

interface SlideEditorProps {
  slides: EditorSlide[];
  pptId: string | null;
}

const avatarImageMap: Record<string, string> = {
  Harry: HarryAvatar,
  Jeff: JeffAvatar,
  Lisa: LisaAvatar,
  Lori: LoriAvatar,
  Max: MaxAvatar,
};

const SlideEditor: React.FC<SlideEditorProps> = ({ slides: initialSlides, pptId }) => {
  const [slides, setSlides] = useState<EditorSlide[]>(initialSlides);
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    setSlides(initialSlides);
  }, [initialSlides]);

  const getAvatarImageUrl = (voice: string): string => {
    return avatarImageMap[voice] || '';
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
      case 'Small':
        style.width = '30px';
        style.height = '30px';
        break;
      case 'Medium':
        style.width = '50px';
        style.height = '50px';
        break;
      case 'Large':
        style.width = '70px';
        style.height = '70px';
        break;
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
    }
    return style;
  };


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
    setDraggedItemIndex(index);
    if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = "move";
    }
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    const target = e.currentTarget as HTMLDivElement;
    if (draggedItemIndex === null || draggedItemIndex === index) {
      return;
    }
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

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5">
          Slide Editor (PPT ID: {pptId || 'N/A'})
        </Typography>
        <Button 
          variant="contained" 
          color="primary" 
        //   startIcon={<MovieIcon />}
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
      
      <Stack spacing={2}>
        {slides.map((slide, index) => (
          <Paper 
            key={slide.id}
            elevation={3}
            draggable
            onDragStart={(e) => onDragStart(e, index)}
            onDragOver={(e) => onDragOver(e, index)}
            onDragLeave={onDragLeave}
            onDrop={(e) => onDrop(e, index)}
            onDragEnd={onDragEnd}
            sx={{ 
              p: 2, 
              display: 'flex', 
              alignItems: 'center', 
              gap: 1,
              cursor: 'grab',
              opacity: draggedItemIndex === index ? 0.5 : 1,
              transition: 'all 0.2s ease',
              '&:hover': {
                backgroundColor: 'rgba(0, 0, 0, 0.02)'
              }
            }}
          >
            {/* <DragIndicatorIcon sx={{ cursor: 'grab', color: 'action.active' }} /> */}
            <Box sx={{ position: 'relative', width: 160, height: 90, flexShrink: 0, borderRadius: 1, overflow: 'hidden' }}>
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
              <Typography variant="caption" display="block" gutterBottom sx={{ maxHeight: '4.5em', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                Script: {slide.script || "No script available"}
              </Typography>
              
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                <Box sx={{ width: { xs: '100%', sm: 'calc(33.33% - 8px)' } }}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Voice</InputLabel>
                    <Select
                      value={slide.voice}
                      label="Voice"
                      onChange={(e: SelectChangeEvent<string>) =>
                        handleSlideChange(slide.id, 'voice', e.target.value as EditorSlide['voice'])
                      }
                    >
                      {VOICE_OPTIONS.map(voice => (
                        <MenuItem key={voice} value={voice}>
                          {voice}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
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
                        <MenuItem key={size} value={size}>
                          {size}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
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
                        <MenuItem key={pos} value={pos}>
                          {pos}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
              </Box>
            </CardContent>
            <IconButton
              aria-label="delete slide"
              onClick={() => handleDeleteSlide(slide.id)}
              sx={{ flexShrink: 0 }}
              color="error"
            >
              {/* <DeleteIcon /> */}
              <Typography variant="caption">Delete</Typography>
            </IconButton>
          </Paper>
        ))}
      </Stack>

      {slides.length === 0 && (
        <Typography sx={{mt: 2}}>
          {pptId ? "Waiting for slides to be processed or no slides found." : "Upload a presentation to see slides here."}
        </Typography>
      )}
    </Box>
  );
};

export default SlideEditor;