import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { SlidesService } from '../services/slidesService';
import { Slide } from '../types/slides';

interface UseSlidesProps {
  pptId: string;
}

export const useSlides = ({ pptId }: UseSlidesProps) => {
  const { user, getAccessToken } = useAuth();
  const [slides, setSlides] = useState<Slide[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSlides = async () => {
    if (!user || !pptId) return;

    try {
      setLoading(true);
      setError(null);

      const token = await getAccessToken();
      if (!token) {
        throw new Error('Failed to get access token');
      }

      const response = await SlidesService.getSlides(pptId, user.id, token);
      setSlides(response.slides.sort((a, b) => a.index - b.index)); // Ensure proper ordering
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch slides';
      setError(errorMessage);
      console.error('Error fetching slides:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSlides();
  }, [pptId, user]);

  const refetch = () => {
    fetchSlides();
  };

  return {
    slides,
    loading,
    error,
    refetch
  };
};