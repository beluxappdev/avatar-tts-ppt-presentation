import { SlidesResponse } from "../types/slides";
import { API_BASE_URL } from "../config/apiConfig";

export class SlidesService {
  static async getSlides(
    pptId: string,
    userId: string,
    token: string
  ): Promise<SlidesResponse> {
    const response = await fetch(
      `${API_BASE_URL}/api/powerpoint/${pptId}/slides/user/${userId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch slides: ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
        pptId: data.ppt_id,
        totalSlides: data.total_slides,
        slides: data.slides,
        timestamp: new Date().toISOString()
    };
  }
}