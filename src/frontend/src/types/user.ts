export interface VideoSummary {
  videoId: string;
  pptId: string;
  status: string;
}

export interface PowerPointSummary {
  pptId: string;
  filename: string;
  videos: string[];
  status: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  powerpoints: PowerPointSummary[];
  videos: VideoSummary[];
}