import React, { useState, useEffect, useCallback } from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  Tooltip, 
  Paper,
  Container,
  Divider,
  Alert
} from '@mui/material';
import axios from 'axios';
import SingleSlide from './SingleSlide';
import SlideEditorHeader from './SlideEditorHeader';
import { useDragAndDrop } from '../hooks/useDragAndDrop';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import HistoryIcon from '@mui/icons-material/History';
import SlideshowIcon from '@mui/icons-material/Slideshow';
import { GENERATE_VIDEO_URL } from '../utils/apiConfig';

export const VOICE_OPTIONS = ['None', 'Harry', 'Jeff', 'Lisa', 'Lori', 'Max'];
export const AVATAR_SIZES = ['Small', 'Medium', 'Large'] as const;
export const AVATAR_POSITIONS = [
  'Left', 
  'Center', 
  'Right', 
  'UpperLeft', 
  'UpperCenter', 
  'UpperRight'
] as const;

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

interface SlidesListProps {
  slides: EditorSlide[];
  pptId: string | null;
}

interface SlideHistory {
  slides: EditorSlide[];
  timestamp: number;
  description: string;
}

const SlidesList: React.FC<SlidesListProps> = ({ slides: initialSlides, pptId }) => {
  const [slides, setSlides] = useState<EditorSlide[]>(initialSlides);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [history, setHistory] = useState<SlideHistory[]>([]);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState(-1);
  const [lastSavedTimestamp, setLastSavedTimestamp] = useState<number>(0);
  const [expandedSlides, setExpandedSlides] = useState<Record<string, boolean>>({});

  const { 
    draggedItemIndex,
    onDragStart,
    onDragOver,
    onDragLeave,
    onDrop,
    onDragEnd
  } = useDragAndDrop(slides, setSlides);

  // Initialize history when slides load
  useEffect(() => {
    if (initialSlides.length > 0) {
      const initialHistory: SlideHistory = {
        slides: [...initialSlides],
        timestamp: Date.now(),
        description: "Initial slides loaded"
      };
      setHistory([initialHistory]);
      setCurrentHistoryIndex(0);
      setLastSavedTimestamp(Date.now());
    }
  }, [initialSlides]);

  // Update slides when initialSlides change
  useEffect(() => {
    setSlides(initialSlides);
    // Initialize expanded state for new slides
    const newExpandedState: Record<string, boolean> = {};
    initialSlides.forEach(slide => {
      newExpandedState[slide.id] = expandedSlides[slide.id] || false;
    });
    setExpandedSlides(newExpandedState);
  }, [initialSlides]);

  const addToHistory = useCallback((newSlides: EditorSlide[], description: string) => {
    const newHistoryItem: SlideHistory = {
      slides: [...newSlides],
      timestamp: Date.now(),
      description
    };
    
    if (currentHistoryIndex < history.length - 1) {
      setHistory(prevHistory => prevHistory.slice(0, currentHistoryIndex + 1));
    }
    
    setHistory(prevHistory => [...prevHistory, newHistoryItem]);
    setCurrentHistoryIndex(prevIndex => prevIndex + 1);
    setLastSavedTimestamp(Date.now());
  }, [history, currentHistoryIndex]);

  const handleUndoRedo = useCallback((isUndo: boolean) => {
    if (isUndo && currentHistoryIndex > 0) {
      setCurrentHistoryIndex(prevIndex => prevIndex - 1);
      setSlides(history[currentHistoryIndex - 1].slides);
    } else if (!isUndo && currentHistoryIndex < history.length - 1) {
      setCurrentHistoryIndex(prevIndex => prevIndex + 1);
      setSlides(history[currentHistoryIndex + 1].slides);
    }
  }, [history, currentHistoryIndex]);

  const handleDeleteSlide = useCallback((id: string) => {
    const slideToDelete = slides.find(slide => slide.id === id);
    const newSlides = slides.filter(slide => slide.id !== id);
    setSlides(newSlides);
    addToHistory(
      newSlides,
      `Deleted slide "${slideToDelete?.title || 'Unknown'}"`
    );
  }, [slides, addToHistory]);

  const handleSlideChange = useCallback((id: string, field: keyof EditorSlide, value: string) => {
    const newSlides = slides.map(slide =>
      slide.id === id ? { ...slide, [field]: value } : slide
    );
    
    setSlides(newSlides);
    
    const slideTitle = slides.find(s => s.id === id)?.title || 'Unknown';
    addToHistory(newSlides, `Updated ${field} for slide "${slideTitle}"`);
  }, [slides, addToHistory]);

  const toggleSlideExpansion = useCallback((id: string) => {
    setExpandedSlides(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  }, []);

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
          showAvatar: slide.voice !== "None",
          avatarPosition: slide.avatarPosition.toLowerCase(),
          avatarSize: slide.avatarSize.toLowerCase(),
          avatarType: slide.voice === "None" ? "" : slide.voice.toLowerCase()
        }
      }));

      const requestBody = {
        pptId: pptId,
        userId: "K2SO",
        slides: formattedSlides
      };

      console.log("Sending video generation request:", requestBody);
      
      const response = await axios.post(
        GENERATE_VIDEO_URL,
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

  const getCurrentHistoryDescription = () => {
    if (currentHistoryIndex >= 0 && currentHistoryIndex < history.length) {
      return history[currentHistoryIndex].description;
    }
    return "";
  };

  const handleBulkConfigure = (voice: string, size: string, position: string) => {
    const newSlides = slides.map(slide => ({
      ...slide,
      voice,
      avatarSize: size as typeof AVATAR_SIZES[number],
      avatarPosition: position as typeof AVATAR_POSITIONS[number]
    }));
    
    setSlides(newSlides);
    addToHistory(newSlides, `Applied bulk configuration: ${voice} voice, ${size} size, ${position} position`);
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header Section */}
      <Paper elevation={2} sx={{ p: 3, mb: 4, borderRadius: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <SlideshowIcon sx={{ mr: 2, fontSize: 32, color: 'primary.main' }} />
          <Typography variant="h4" sx={{ fontWeight: 700, color: 'text.primary' }}>
            Slide Editor
          </Typography>
        </Box>
        
        <SlideEditorHeader 
          pptId={pptId}
          slideCount={slides.length}
          allExpanded={true}
          isProcessing={isProcessing}
          submitSuccess={submitSuccess}
          submitError={submitError}
          onToggleAllExpansion={() => {}}
          onGenerateVideo={handleGenerateVideo}
          onBulkConfigure={handleBulkConfigure}
        />
      </Paper>

      {/* History Controls */}
      <Paper elevation={1} sx={{ p: 2, mb: 4, borderRadius: 3, backgroundColor: 'rgba(0, 0, 0, 0.02)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Tooltip title="Undo last action">
            <span>
              <Button 
                startIcon={<UndoIcon />} 
                onClick={() => handleUndoRedo(true)}
                disabled={currentHistoryIndex <= 0}
                size="small"
                variant="outlined"
                sx={{ borderRadius: 2 }}
              >
                Undo
              </Button>
            </span>
          </Tooltip>
          
          <Tooltip title="Redo last undone action">
            <span>
              <Button 
                startIcon={<RedoIcon />} 
                onClick={() => handleUndoRedo(false)}
                disabled={currentHistoryIndex >= history.length - 1}
                size="small"
                variant="outlined"
                sx={{ borderRadius: 2 }}
              >
                Redo
              </Button>
            </span>
          </Tooltip>
          
          <Divider orientation="vertical" flexItem />
          
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <HistoryIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
            <Typography variant="body2" color="text.secondary">
              {getCurrentHistoryDescription()}
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* Success/Error Messages */}
      {submitSuccess && (
        <Alert severity="success" sx={{ mb: 3, borderRadius: 2 }}>
          Video generation started successfully!
        </Alert>
      )}
      
      {submitError && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
          Error: {submitError}
        </Alert>
      )}

      {/* Slides List - Single Column */}
      {slides.length > 0 ? (
        <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
          {slides.map((slide, index) => (
            <SingleSlide
              key={slide.id}
              slide={slide}
              index={index}
              isExpanded={expandedSlides[slide.id] || false}
              draggedItemIndex={draggedItemIndex}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onDragEnd={onDragEnd}
              onSlideChange={handleSlideChange}
              onDelete={handleDeleteSlide}
              onToggleExpand={toggleSlideExpansion}
            />
          ))}
        </Box>
      ) : (
        <Paper 
          elevation={1} 
          sx={{ 
            p: 6, 
            textAlign: 'center',
            borderRadius: 3,
            backgroundColor: 'rgba(0, 0, 0, 0.02)'
          }}
        >
          <SlideshowIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
            No slides available
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {pptId 
              ? "Waiting for slides to be processed or no slides found." 
              : "Upload a presentation to see slides here."
            }
          </Typography>
        </Paper>
      )}
    </Container>
  );
};

export default SlidesList;