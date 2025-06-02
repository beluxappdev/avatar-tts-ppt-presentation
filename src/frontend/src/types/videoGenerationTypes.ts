export interface SlideConfig {
  index: string;
  script: string;
  avatar_config: {
    show_avatar: boolean;
    avatar_persona: string;
    avatar_position: string;
    avatar_size: string;
    pause_before: number;
    pause_after: number;
  };
}

export interface GenerateVideoRequest {
  ppt_id: string;
  user_id: string;
  language: string;
  slides_config: SlideConfig[];
}

export interface GenerateVideoResponse {
  message: string;
  ppt_id: string;
  user_id: string;
  video_id: string;
  timestamp: string;
}