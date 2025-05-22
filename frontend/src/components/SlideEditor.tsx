import React, { useState, useEffect, useCallback } from 'react';
import { Box, Typography, Paper, Stack, Button, Tooltip } from '@mui/material';
import axios from 'axios';
import SlideItem from './SlideItem';
import SlideEditorHeader from './SlideEditorHeader';
import { useDragAndDrop } from '../hooks/useDragAndDrop';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import HistoryIcon from '@mui/icons-material/History';

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

// TODO
// Comments on code
// CONST URL
// Global user state + Login
// Session history (refresh page)
// Gallery
// Fix indexes after dragging
// Editable slide title?
// Gallery functionality
// Better dragging
// Clean up component again
// Drag and drop avatar (add back)
// FIX avatar size when collapsing <-> expanding
// FIX undo redo dragged slides
// Clean up text on UI, currently a bit too verbose
// Large amount of slides? 
// Gradual loading of processed slides => user can start working on them as we are processing
// Mass change all settings/only specific settings (e.g. all slides need to be in Harry's voice on the top left, small)
// Hide avatar


//rm debounce, show, crop images more

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

interface SlideHistory {
  slides: EditorSlide[];
  timestamp: number;
  description: string;
}

const SlideEditor: React.FC<SlideEditorProps> = ({ slides: initialSlides, pptId }) => {
  const [slides, setSlides] = useState<EditorSlide[]>(initialSlides);
  const [isProcessing, setIsProcessing] = useState(false);
  const [expandedSlides, setExpandedSlides] = useState<Record<string, boolean>>({});
  const [allExpanded, setAllExpanded] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const [history, setHistory] = useState<SlideHistory[]>([]);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState(-1);
  const [lastSavedTimestamp, setLastSavedTimestamp] = useState<number>(0);

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

  const handleDragDrop = useCallback((updatedSlides: EditorSlide[]) => {
    setSlides(updatedSlides);
    addToHistory(updatedSlides, "Reordered slides");
  }, []);

  const { 
    draggedItemIndex,
    onDragStart,
    onDragOver,
    onDragLeave,
    onDrop,
    onDragEnd
  } = useDragAndDrop(slides, setSlides);

  // initial slide load
  useEffect(() => {
    setSlides(initialSlides);
    const newExpandedState: Record<string, boolean> = {};
    initialSlides.forEach(slide => {
      newExpandedState[slide.id] = allExpanded;
    });
    setExpandedSlides(newExpandedState);
  }, [initialSlides]);

  // handle expansion state
  useEffect(() => {
    const newExpandedState: Record<string, boolean> = {};
    slides.forEach(slide => {
      newExpandedState[slide.id] = expandedSlides[slide.id] !== undefined ? 
        expandedSlides[slide.id] : allExpanded;
    });
    setExpandedSlides(newExpandedState);
  }, [allExpanded, slides.length]);

  const addToHistory = useCallback((newSlides: EditorSlide[], description: string) => {
    const newHistoryItem: SlideHistory = {
      slides: [...newSlides],
      timestamp: Date.now(),
      description
    };
    
    // remove future history if we are adding a new entry/not at the end
    if (currentHistoryIndex < history.length - 1) {
      setHistory(prevHistory => prevHistory.slice(0, currentHistoryIndex + 1));
    }
    
    setHistory(prevHistory => [...prevHistory, newHistoryItem]);
    setCurrentHistoryIndex(prevIndex => prevIndex + 1);
    setLastSavedTimestamp(Date.now());
  }, [history, currentHistoryIndex]);

  // this only really applies to script changes right now (<3 seconds) to not clutter too much
  const debouncedScriptChange = useCallback((id: string, value: string, slideTitle: string) => {
    const now = Date.now();
    if (now - lastSavedTimestamp > 3000) {
      const updatedSlides = slides.map(slide => 
        slide.id === id ? { ...slide, script: value } : slide
      );
      addToHistory(updatedSlides, `Updated script for slide "${slideTitle}"`);
    }
  }, [slides, addToHistory, lastSavedTimestamp]);

  const handleUndoRedo = useCallback((isUndo: boolean) => {
    if (isUndo && currentHistoryIndex > 0) {
      
      // UNDO
      setCurrentHistoryIndex(prevIndex => prevIndex - 1);
      setSlides(history[currentHistoryIndex - 1].slides);
    } else if (!isUndo && currentHistoryIndex < history.length - 1) {
      
      // REDO
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
    
    if (field === 'script') {
      const slideTitle = slides.find(s => s.id === id)?.title || 'Unknown';
      debouncedScriptChange(id, value, slideTitle);
    } else {
      const slideTitle = slides.find(s => s.id === id)?.title || 'Unknown';
      addToHistory(newSlides, `Changed ${field} for slide "${slideTitle}"`);
    }
  }, [slides, addToHistory, debouncedScriptChange]);

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

  const getCurrentHistoryDescription = () => {
    if (currentHistoryIndex >= 0 && currentHistoryIndex < history.length) {
      return history[currentHistoryIndex].description;
    }
    return "";
  };

  return (
    <Box sx={{ p: 2 }}>
      <SlideEditorHeader 
        pptId={pptId}
        slideCount={slides.length}
        allExpanded={allExpanded}
        isProcessing={isProcessing}
        submitSuccess={submitSuccess}
        submitError={submitError}
        onToggleAllExpansion={toggleAllExpansion}
        onGenerateVideo={handleGenerateVideo}
      />
      
      {/* History Controls */}
      <Box sx={{ display: 'flex', mb: 2, alignItems: 'center' }}>
        <Tooltip title="Undo last action">
          <span>
            <Button 
              startIcon={<UndoIcon />} 
              onClick={() => handleUndoRedo(true)}
              disabled={currentHistoryIndex <= 0}
              size="small"
              variant="outlined"
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
              sx={{ ml: 1 }}
            >
              Redo
            </Button>
          </span>
        </Tooltip>
        
        <Box sx={{ ml: 2, display: 'flex', alignItems: 'center' }}>
          <HistoryIcon fontSize="small" sx={{ mr: 0.5, color: 'text.secondary' }} />
          <Typography variant="body2" color="text.secondary">
            {getCurrentHistoryDescription()}
          </Typography>
        </Box>
      </Box>
      
      {/* Slides list */}
      <Stack spacing={2}>
        {slides.map((slide, index) => (
          <Paper key={slide.id} elevation={3}>
            <SlideItem
              slide={slide}
              index={index}
              isExpanded={expandedSlides[slide.id] !== undefined ? expandedSlides[slide.id] : true}
              draggedItemIndex={draggedItemIndex}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onDragEnd={onDragEnd}
              onSlideChange={handleSlideChange}
              onToggleExpand={toggleSlideExpansion}
              onDelete={handleDeleteSlide}
            />
          </Paper>
        ))}
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