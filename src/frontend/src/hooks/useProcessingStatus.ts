// hooks/useProcessingStatus.ts
import { useState, useCallback, useEffect } from 'react';

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
    console.log('📊 Handling status update:', data);
    setOverallStatusMessage(`Overall status: ${data.status}${data.detail ? ` - ${data.detail}` : ''}`);
    
    // Check if overall status indicates completion
    if (data.status === 'Completed') {
      console.log('📊 All processing completed');
      setAllProcessingComplete(true);
      setProcessingSteps(prev => ({
        blobStorage: { ...prev.blobStorage, status: 'completed' },
        scriptProcessing: { ...prev.scriptProcessing, status: 'completed' },
        imageProcessing: { ...prev.imageProcessing, status: 'completed' },
      }));
    } else if (data.status === 'Processing') {
      console.log('📊 Processing in progress');
      setProcessingSteps(prev => {
        if (prev.blobStorage.status === 'pending') {
          return { ...prev, blobStorage: { ...prev.blobStorage, status: 'processing' } };
        }
        return prev;
      });
    } else if (data.status === 'Failed') {
      console.log('📊 Processing failed');
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
    console.log('📊 Handling processing update:', data);
    
    // Map processing types to step keys
    const stepKeyMap: Record<string, string> = {
      'blobStorage': 'blobStorage',
      'imageProcessing': 'imageProcessing',
      'scriptProcessing': 'scriptProcessing'
    };
    
    const stepKey = stepKeyMap[data.processingType] || data.processingType;
    
    setProcessingSteps(prev => {
      const currentStep = prev[stepKey];
      if (!currentStep) {
        console.warn(`📊 Received processing update for unknown stepKey: ${stepKey} (from ${data.processingType})`);
        return prev;
      }
      
      const newSteps = {
        ...prev, 
        [stepKey]: {
          ...currentStep,
          status: data.status.toLowerCase() as ProcessingStep['status'],
        }
      };
      
      console.log(`📊 Updated ${stepKey} status to ${data.status}`);
      return newSteps;
    });
  }, []);

  // Effect to check if all processing is complete whenever steps change
  useEffect(() => {
    const steps = Object.values(processingSteps);
    const allCompleted = steps.every(step => step.status === 'completed');
    const anyFailed = steps.some(step => step.status === 'failed');
    
    if (allCompleted && !allProcessingComplete) {
      console.log('📊 All individual steps completed, setting allProcessingComplete to true');
      setAllProcessingComplete(true);
      setOverallStatusMessage('All processing completed successfully!');
    } else if (anyFailed && !allProcessingComplete) {
      console.log('📊 Some steps failed, setting allProcessingComplete to true');
      setAllProcessingComplete(true);
      setOverallStatusMessage('Processing failed');
    } else if (!allCompleted && !anyFailed && allProcessingComplete) {
      console.log('📊 Processing restarted, setting allProcessingComplete to false');
      setAllProcessingComplete(false);
    }
  }, [processingSteps, allProcessingComplete]);

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