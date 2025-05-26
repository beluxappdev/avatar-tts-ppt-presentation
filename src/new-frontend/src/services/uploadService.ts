import { API_BASE_URL } from "../config/apiConfig";

export interface UploadPowerPointRequest {
  file: File;
  userId: string;
}

export interface UploadPowerPointResponse {
  id: string;
  filename: string;
  status: 'processing' | 'ready' | 'error';
  message?: string;
}

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

    return response.json();
  }
}