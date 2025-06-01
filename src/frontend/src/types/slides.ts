export interface Slide {
  index: number;
  blobUrl: string;
  script: string;
}

export interface SlidesResponse {
  pptId: string;
  totalSlides: number;
  slides: Slide[];
  timestamp: string;
}