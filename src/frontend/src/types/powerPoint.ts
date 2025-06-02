export interface Video {
  videoId: string;
  videoName: string;
  status: string;
}

export interface PowerPoint {
  pptId: string;
  filename: string;
  status: string;
  videos: Video[];
  blobUrl?: string;
}

export interface UserData {
  userId: string;
  username: string;
  email: string;
  powerpoints: PowerPoint[];
}
