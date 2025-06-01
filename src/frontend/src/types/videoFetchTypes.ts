export interface FetchVideoResponse {
    ppt_id: string;
    video_id: string;
    user_id: string;
    status: string;
    timestamp: string;
    video_url?: string;
    message?: string; // Optional message for additional context
}