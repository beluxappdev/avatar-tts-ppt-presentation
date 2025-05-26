import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { UploadService, UploadPowerPointRequest, UploadPowerPointResponse } from '../services/uploadService';

export interface UseUploadReturn {
  uploadPowerPoint: (file: File) => Promise<UploadPowerPointResponse | null>;
  isUploading: boolean;
  uploadError: string | null;
  uploadSuccess: boolean;
  clearError: () => void;
  clearSuccess: () => void;
}

export const useUpload = (): UseUploadReturn => {
  const { user, getAccessToken } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const uploadPowerPoint = async (file: File): Promise<UploadPowerPointResponse | null> => {
    if (!user) {
      setUploadError('User not authenticated');
      return null;
    }

    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(false);

    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error('Failed to get access token');
      }

      const request: UploadPowerPointRequest = {
        file,
        userId: user.id,
      };

      const result = await UploadService.uploadPowerPoint(request, token);
      setUploadSuccess(true);
      
      // Auto-clear success after 3 seconds
      setTimeout(() => setUploadSuccess(false), 3000);
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      setUploadError(errorMessage);
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const clearError = () => setUploadError(null);
  const clearSuccess = () => setUploadSuccess(false);

  return {
    uploadPowerPoint,
    isUploading,
    uploadError,
    uploadSuccess,
    clearError,
    clearSuccess,
  };
};