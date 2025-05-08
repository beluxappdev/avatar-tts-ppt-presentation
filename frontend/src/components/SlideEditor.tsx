import React, { useState, DragEvent } from 'react';
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

// needs icons: trash, drag, movie

interface Slide {
  id: string;
  title: string;
  thumbnailUrl: string;
  voice: string;
  avatarSize: 'Small' | 'Medium' | 'Large';
  avatarPosition: 'Left' | 'Center' | 'Right';
  script?: string;
}

const initialSlidesData: Slide[] = [
  { id: 'slide1', title: 'Slide 1: Introduction', thumbnailUrl: 'https://bloburl1', voice: 'Karim', avatarSize: 'Medium', avatarPosition: 'Left', script: 'Manager' },
  { id: 'slide2', title: 'Slide 2: Key Points', thumbnailUrl: 'https://bloblurl2', voice: 'Mateo', avatarSize: 'Large', avatarPosition: 'Center', script: 'AI Avatar' },
  { id: 'slide3', title: 'Slide 3: Details', thumbnailUrl: 'https://bloburl3', voice: 'Nicolas', avatarSize: 'Small', avatarPosition: 'Right', script: 'Azure Devops' },
  { id: 'slide4', title: 'Slide 4: Examples', thumbnailUrl: 'https://bloburl4', voice: 'Youssef', avatarSize: 'Medium', avatarPosition: 'Left', script: 'Terraform' },
  { id: 'slide5', title: 'Slide 5: Conclusion', thumbnailUrl: 'https://bloburl5', voice: 'Andras', avatarSize: 'Large', avatarPosition: 'Center', script: 'AI Avatar' },
];

const VOICE_OPTIONS = ['Mateo', 'Andras', 'Karim', 'Nicolas', 'Youssef'];
const AVATAR_SIZES: Slide['avatarSize'][] = ['Small', 'Medium', 'Large'];
const AVATAR_POSITIONS: Slide['avatarPosition'][] = ['Left', 'Center', 'Right'];

const SlideEditor: React.FC = () => {
  const [slides, setSlides] = useState<Slide[]>(initialSlidesData);
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleDeleteSlide = (id: string) => {
    setSlides(prevSlides => prevSlides.filter(slide => slide.id !== id));
  };

  const handleSlideChange = (id: string, field: keyof Slide, value: string) => {
    setSlides(prevSlides =>
      prevSlides.map(slide =>
        slide.id === id ? { ...slide, [field]: value } : slide
      )
    );
  };

  const onDragStart = (e: DragEvent<HTMLDivElement>, index: number) => {
    setDraggedItemIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    if (draggedItemIndex === null || draggedItemIndex === index) {
      return;
    }
    e.currentTarget.style.borderTop = draggedItemIndex < index ? '2px solid #1976d2' : 'none';
    e.currentTarget.style.borderBottom = draggedItemIndex > index ? '2px solid #1976d2' : 'none';
  };
  
  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.currentTarget.style.borderTop = 'none';
    e.currentTarget.style.borderBottom = 'none';
  };
  
  const onDrop = (e: DragEvent<HTMLDivElement>, targetIndex: number) => {
    e.preventDefault();
    e.currentTarget.style.borderTop = 'none';
    e.currentTarget.style.borderBottom = 'none';
    
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
    e.currentTarget.style.borderTop = 'none';
    e.currentTarget.style.borderBottom = 'none';
    setDraggedItemIndex(null);
  };

// this is just a sample since the api is not connected
  const handleGenerateVideo = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      alert('Video generation request submitted successfully!');
    }, 2000);
  };

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5">
          Slide Editor
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
            {/* drag icon here maybe */}
            <CardMedia
              component="img"
              sx={{ width: 160, height: 90, borderRadius: 1, flexShrink: 0 }}
              image={slide.thumbnailUrl}
              alt={slide.title}
            />
            <CardContent sx={{ flexGrow: 1, p: '0 !important', ml: 1 }}>
              <Typography variant="subtitle1" gutterBottom>
                {slide.title}
              </Typography>
              
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                <Box sx={{ width: { xs: '100%', sm: '32%' } }}>
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
                        <MenuItem key={voice} value={voice}>
                          {voice}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
                <Box sx={{ width: { xs: '100%', sm: '32%' } }}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Avatar Size</InputLabel>
                    <Select
                      value={slide.avatarSize}
                      label="Avatar Size"
                      onChange={(e: SelectChangeEvent<string>) =>
                        handleSlideChange(slide.id, 'avatarSize', e.target.value)
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
                <Box sx={{ width: { xs: '100%', sm: '32%' } }}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Avatar Position</InputLabel>
                    <Select
                      value={slide.avatarPosition}
                      label="Avatar Position"
                      onChange={(e: SelectChangeEvent<string>) =>
                        handleSlideChange(slide.id, 'avatarPosition', e.target.value)
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
            </IconButton>
          </Paper>
        ))}
      </Stack>

      {slides.length === 0 && (
        <Typography sx={{mt: 2}}>No slides to display. You can add new slides (feature to be implemented).</Typography>
      )}
    </Box>
  );
};

export default SlideEditor;