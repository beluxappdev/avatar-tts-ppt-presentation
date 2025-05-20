import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, Stack } from '@mui/material';
import axios from 'axios';
import SlideItem from './SlideItem';
import SlideEditorHeader from './SlideEditorHeader';
import { useDragAndDrop } from '../hooks/useDragAndDrop';

export const VOICE_OPTIONS = ['Harry', 'Jeff', 'Lisa', 'Lori', 'Max'];
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

interface SlideEditorProps {
  slides: EditorSlide[];
  pptId: string | null;
}

const SlideEditor: React.FC<SlideEditorProps> = ({ slides: initialSlides, pptId }) => {
  const [slides, setSlides] = useState<EditorSlide[]>(initialSlides);
  const [isProcessing, setIsProcessing] = useState(false);
  const [expandedSlides, setExpandedSlides] = useState<Record<string, boolean>>({});
  const [allExpanded, setAllExpanded] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const { 
    draggedItemIndex,
    onDragStart,
    onDragOver,
    onDragLeave,
    onDrop,
    onDragEnd
  } = useDragAndDrop(slides, setSlides);

  useEffect(() => {
    setSlides(initialSlides);
    const newExpandedState: Record<string, boolean> = {};
    initialSlides.forEach(slide => {
      newExpandedState[slide.id] = allExpanded;
    });
    setExpandedSlides(newExpandedState);
  }, [initialSlides, allExpanded]);

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