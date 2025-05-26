import { API_BASE_URL } from "../config/apiConfig";
import { UploadPowerPointRequest, UploadPowerPointResponse } from "../types/uploadTypes";

export class UploadService {
  static async uploadPowerPoint(
    request: UploadPowerPointRequest,
    token: string
  ): Promise<UploadPowerPointResponse> {
    const formData = new FormData();
    formData.append('file', request.file);
    formData.append('user_id', request.userId);

    const response = await fetch(`${API_BASE_URL}/api/powerpoint/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    const apiResponse = await response.json();
    
    // Transform API response to match TypeScript type
    return {
      id: apiResponse.ppt_id,
      filename: apiResponse.file_name,
      message: apiResponse.message
    };
  }
}