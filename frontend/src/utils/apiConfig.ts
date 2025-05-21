export const API_BASE_URL = 'http://localhost:8080';
export const SIGNALR_HUB_URL = `${API_BASE_URL}/processingStatusHub`;
export const SLIDES_API_URL = (pptId: string) => `${API_BASE_URL}/api/ppt/${pptId}/slides`;