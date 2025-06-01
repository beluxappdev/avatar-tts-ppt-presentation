import { useState, useEffect } from 'react';
import { videoService } from '../services/videoService';
import { FetchVideoResponse } from '../types/videoFetchTypes';
import { useAuth } from '../context/AuthContext';

interface UseVideoResult {
  videoUrl: string | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export const useVideo = (videoId: string, pptId: string): UseVideoResult => {
  const { user, getAccessToken } = useAuth();
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchVideo = async () => {
    if (!videoId || !pptId || !user) {
      setError('Video ID, Presentation ID, and User ID are required');
      return;
    }

    setIsLoading(true);
    setError(null);

    const token = await getAccessToken();
    if (!token) {
    throw new Error('Failed to get access token');
    }

    try {
      const response: FetchVideoResponse = await videoService.getVideoUrl(videoId, pptId, user.id, token);
      setVideoUrl(response.video_url || null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load video';
      setError(errorMessage);
      console.error('Error fetching video:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchVideo();
  }, [videoId]);

  const refetch = () => {
    fetchVideo();
  };

  return {
    videoUrl,
    isLoading,
    error,
    refetch,
  };
};