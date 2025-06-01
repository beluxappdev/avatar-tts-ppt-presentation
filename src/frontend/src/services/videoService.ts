import { API_BASE_URL } from '../config/apiConfig';
import { FetchVideoResponse } from '../types/videoFetchTypes';

export const videoService = {
  async getVideoUrl(videoId: string, pptId: string, userId: string, token: string): Promise<FetchVideoResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/powerpoint/${pptId}/video/${videoId}/user/${userId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch video: ${response.status} ${response.statusText}`);
      }

      const data: FetchVideoResponse = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching video URL:', error);
      throw error;
    }
  },
};