export const API_BASE_URL = 'http://localhost:8000';
export const SIGNALR_HUB_URL = `${API_BASE_URL}/processingStatusHub`;
export const SLIDES_API_URL = (pptId: string, userId: string) => `${API_BASE_URL}/api/powerpoint/${pptId}/slides/user/${userId}`;
export const UPLOAD_PPT_URL = `${API_BASE_URL}/api/powerpoint/upload`;
export const GENERATE_VIDEO_URL = `${API_BASE_URL}/api/generate_video`;