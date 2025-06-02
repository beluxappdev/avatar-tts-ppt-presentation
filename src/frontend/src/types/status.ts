export type ProcessingStatus = 'Pending' | 'Processing' | 'Completed' | 'Failed';

export interface StatusMessage {
  blob_storage_status?: ProcessingStatus;
  script_extraction_status?: ProcessingStatus;
  image_extraction_status?: ProcessingStatus;
}

export interface WebSocketMessage {
  type: string;
  ppt_id: string;
  timestamp: string;
  data: StatusMessage;
  changes?: StatusMessage;
}

export interface StatusStep {
  id: string;
  label: string;
  status: ProcessingStatus;
  statusKey: keyof StatusMessage;
}