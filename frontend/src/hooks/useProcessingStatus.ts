import { useState, useCallback } from 'react';

export interface ProcessingStep {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  label: string;
  error?: string;
}

export const useProcessingStatus = () => {
  const [processingSteps, setProcessingSteps] = useState<Record<string, ProcessingStep>>({
    blobStorage: { status: 'pending', label: 'Saving PowerPoint' },
    scriptProcessing: { status: 'pending', label: 'Extracting Scripts' },
    imageProcessing: { status: 'pending', label: 'Extracting Images' },
  });
  const [allProcessingComplete, setAllProcessingComplete] = useState(false);
  const [overallStatusMessage, setOverallStatusMessage] = useState<string | null>(null);

  const resetStatus = useCallback(() => {
    setProcessingSteps({
      blobStorage: { status: 'pending', label: 'Saving PowerPoint' },
      scriptProcessing: { status: 'pending', label: 'Extracting Scripts' },
      imageProcessing: { status: 'pending', label: 'Extracting Images' },
    });
    setAllProcessingComplete(false);
    setOverallStatusMessage(null);
  }, []);

  const updateStepStatus = useCallback((step: string, status: ProcessingStep['status'], error?: string) => {
    setProcessingSteps(prev => {
      const currentStep = prev[step];
      if (!currentStep) return prev;
      
      return {
        ...prev,
        [step]: {
          ...currentStep,
          status,
          ...(error && { error })
        }
      };
    });
  }, []);

  const handleStatusUpdate = useCallback((data: { pptId: string; status: string; detail?: string }) => {
    setOverallStatusMessage(`Overall status: ${data.status}${data.detail ? ` - ${data.detail}` : ''}`);
    
    if (data.status === 'Completed') {
      setAllProcessingComplete(true);
      setProcessingSteps(prev => ({
        blobStorage: { ...prev.blobStorage, status: 'completed' },
        scriptProcessing: { ...prev.scriptProcessing, status: 'completed' },
        imageProcessing: { ...prev.imageProcessing, status: 'completed' },
      }));
    } else if (data.status === 'Processing') {
      setProcessingSteps(prev => {
        if (prev.blobStorage.status === 'pending') {
          return { ...prev, blobStorage: { ...prev.blobStorage, status: 'processing' } };
        }
        return prev;
      });
    } else if (data.status === 'Failed') {
      setOverallStatusMessage(`Processing failed: ${data.detail || 'Unknown error'}`);
      setAllProcessingComplete(true);
      setProcessingSteps(prev => ({
        blobStorage: { ...prev.blobStorage, status: prev.blobStorage.status === 'completed' ? 'completed' : 'failed', error: data.detail },
        scriptProcessing: { ...prev.scriptProcessing, status: 'failed', error: data.detail },
        imageProcessing: { ...prev.imageProcessing, status: 'failed', error: data.detail },
      }));
    }
  }, []);

  const handleProcessingUpdate = useCallback((data: { processingType: string; status: string; }) => {
    const stepKey = data.processingType.charAt(0).toLowerCase() + data.processingType.slice(1);
    setProcessingSteps(prev => {
      const currentStep = prev[stepKey];
      if (!currentStep) {
        console.warn(`Received processing update for unknown stepKey: ${stepKey}`);
        return prev;
      }
      
      return {
        ...prev, 
        [stepKey]: {
          ...currentStep,
          status: data.status.toLowerCase() as ProcessingStep['status'],
        }
      };
    });
  }, []);

  return {
    processingSteps,
    allProcessingComplete,
    overallStatusMessage,
    resetStatus,
    updateStepStatus,
    handleStatusUpdate,
    handleProcessingUpdate,
    setOverallStatusMessage
  };
};