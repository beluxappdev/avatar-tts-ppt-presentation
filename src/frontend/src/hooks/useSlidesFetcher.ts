import { useCallback } from 'react';
import axios from 'axios';
import { SLIDES_API_URL } from '../utils/apiConfig';
import { EditorSlide } from '../components/SlideList';

export const useSlidesFetcher = (setSlides: React.Dispatch<React.SetStateAction<EditorSlide[]>>, setStatusMessage: (message: string) => void) => {
  return useCallback(async (pptId: string) => {
    setStatusMessage('Fetching slides...');
    try {
      const response = await axios.get(SLIDES_API_URL(pptId, "tenant123"));
      if (response.data && response.data.slides) {
        const fetchedSlides = response.data.slides.map((apiSlide: any, index: number) => ({
          id: `slide-${apiSlide.index !== undefined ? apiSlide.index : index}`,
          index: apiSlide.index !== undefined ? apiSlide.index : index,
          title: `Slide ${apiSlide.index !== undefined ? apiSlide.index + 1 : index + 1}`,
          thumbnailUrl: apiSlide.blobUrl,
          script: apiSlide.script || '',
          voice: 'Harry',
          avatarSize: 'Medium',
          avatarPosition: 'Left',
        }));
        setSlides(fetchedSlides);
        setStatusMessage('Slides loaded successfully.');
      } else {
        setStatusMessage('No slides found or invalid format.');
      }
    } catch (error) {
      console.error('Error fetching slides:', error);
      setStatusMessage(`Error fetching slides: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [setSlides, setStatusMessage]);
};