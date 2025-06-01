import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { VideoGenerationService } from '../services/videoGenerationService';
import { GenerateVideoRequest, GenerateVideoResponse } from '../types/videoGenerationTypes';

export interface UseVideoGenerationReturn {
  generateVideo: (request: GenerateVideoRequest) => Promise<GenerateVideoResponse | null>;
  isGenerating: boolean;
  generationError: string | null;
  generationSuccess: boolean;
  clearError: () => void;
  clearSuccess: () => void;
}

export const useVideoGeneration = (): UseVideoGenerationReturn => {
  const { user, getAccessToken } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generationSuccess, setGenerationSuccess] = useState(false);

  const generateVideo = async (request: GenerateVideoRequest): Promise<GenerateVideoResponse | null> => {
    if (!user) {
      setGenerationError('User not authenticated');
      return null;
    }

    setIsGenerating(true);
    setGenerationError(null);
    setGenerationSuccess(false);

    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error('Failed to get access token');
      }

      const result = await VideoGenerationService.generateVideo(request, token);
      setGenerationSuccess(true);
      
      // Auto-clear success after 5 seconds (longer than upload since video generation is a bigger action)
      setTimeout(() => setGenerationSuccess(false), 5000);
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Video generation failed';
      setGenerationError(errorMessage);
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  const clearError = () => setGenerationError(null);
  const clearSuccess = () => setGenerationSuccess(false);

  return {
    generateVideo,
    isGenerating,
    generationError,
    generationSuccess,
    clearError,
    clearSuccess,
  };
};