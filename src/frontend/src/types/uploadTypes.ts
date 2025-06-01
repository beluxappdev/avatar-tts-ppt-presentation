export type UploadPowerPointRequest = {
  file: File;
  userId: string;
}

export type UploadPowerPointResponse = {
  id: string;
  filename: string;
  message?: string;
}