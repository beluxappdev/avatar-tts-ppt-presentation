import { UserData } from '../types/powerPoint';
import { API_BASE_URL } from '../config/apiConfig';


export class PowerPointsService {
  static async getPowerPoints(userId: string, token: string): Promise<UserData> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/user/${userId}/powerpoints`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized access. Please log in again.');
        }
        if (response.status === 404) {
          throw new Error('User not found.');
        }
        throw new Error(`Failed to fetch PowerPoints: ${response.status} ${response.statusText}`);
      }

      const data: UserData = await response.json();
      return data;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('An unexpected error occurred while fetching PowerPoints');
    }
  }

  static async deletePowerPoint(pptId: string, userId: string, token: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/powerpoint/${pptId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized access. Please log in again.');
        }
        if (response.status === 404) {
          throw new Error('PowerPoint not found.');
        }
        if (response.status === 403) {
          throw new Error('You do not have permission to delete this PowerPoint.');
        }
        throw new Error(`Failed to delete PowerPoint: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('An unexpected error occurred while deleting PowerPoint');
    }
  }

  static async deleteVideo(pptId: string, videoId: string, userId: string, token: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/powerpoint/${pptId}/video/${videoId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized access. Please log in again.');
        }
        if (response.status === 404) {
          throw new Error('Video not found.');
        }
        if (response.status === 403) {
          throw new Error('You do not have permission to delete this video.');
        }
        throw new Error(`Failed to delete video: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('An unexpected error occurred while deleting video');
    }
  }
}