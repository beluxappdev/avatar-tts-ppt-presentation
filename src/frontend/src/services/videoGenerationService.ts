import { GenerateVideoRequest, GenerateVideoResponse } from "../types/videoGenerationTypes";
import { API_BASE_URL } from "../config/apiConfig";

export class VideoGenerationService {
  static async generateVideo(
    request: GenerateVideoRequest,
    token: string
  ): Promise<GenerateVideoResponse> {
    const response = await fetch(`${API_BASE_URL}/api/powerpoint/generate_video`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Video generation failed: ${response.statusText}`);
    }

    const apiResponse = await response.json();
    
    // Return the response as-is since it already matches our expected format
    return apiResponse;
  }
}