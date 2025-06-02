import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { PowerPointsService } from '../services/powerpointsService';
import { UserData } from '../types/powerPoint';

export const usePowerPoints = () => {
  const { user, getAccessToken } = useAuth();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPowerPoints = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const token = await getAccessToken();
      if (!token) {
        throw new Error('Failed to get access token');
      }

      const response = await PowerPointsService.getPowerPoints(user.id, token);
      setUserData(response);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch PowerPoints';
      setError(errorMessage);
      console.error('Error fetching PowerPoints:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPowerPoints();
  }, [user]);

  const refetch = () => {
    fetchPowerPoints();
  };

  return {
    userData,
    powerpoints: userData?.powerpoints || [],
    loading,
    error,
    refetch
  };
};