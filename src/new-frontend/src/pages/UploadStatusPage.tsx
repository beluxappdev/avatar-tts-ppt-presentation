import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useProcessingStatus } from '../hooks/useProcessingStatus';
import { ProcessingStatus } from '../types/status';

export const UploadStatusPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const {
    statusSteps,
    isConnected,
    connectionError,
    getCompletedStepsCount,
    getTotalStepsCount,
    isProcessingComplete,
    hasFailedSteps,
    getCurrentProcessingStep
  } = useProcessingStatus({
    presentationId: id || '',
    userId: user?.id || ''
  });

  const getStepIcon = (status: ProcessingStatus) => {
    switch (status) {
      case 'Completed':
        return (
          <div style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            backgroundColor: '#10b981',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '14px',
            fontWeight: 'bold'
          }}>
            ✓
          </div>
        );
      case 'Processing':
        return (
          <div style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            border: '3px solid #e5e7eb',
            borderTop: '3px solid #3b82f6',
            animation: 'spin 1s linear infinite'
          }} />
        );
      case 'Failed':
        return (
          <div style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            backgroundColor: '#ef4444',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '14px',
            fontWeight: 'bold'
          }}>
            ✕
          </div>
        );
      default: // Pending
        return (
          <div style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            backgroundColor: '#e5e7eb',
            border: '2px solid #d1d5db'
          }} />
        );
    }
  };

  const getStepTextColor = (status: ProcessingStatus) => {
    switch (status) {
      case 'Completed':
        return '#10b981';
      case 'Processing':
        return '#3b82f6';
      case 'Failed':
        return '#ef4444';
      default:
        return '#9ca3af';
    }
  };

  const getStatusMessage = (status: ProcessingStatus) => {
    switch (status) {
      case 'Processing':
        return 'In progress...';
      case 'Completed':
        return 'Completed successfully';
      case 'Failed':
        return 'Failed - please try again';
      default:
        return 'Waiting to start...';
    }
  };

  const handleBackToHome = () => {
    navigate('/');
  };

  const handleProceedToCustomization = () => {
    navigate(`/powerpoint/${id}/customize`);
  };

  const getProgressSummary = () => {
    const completed = getCompletedStepsCount();
    const total = getTotalStepsCount();
    
    if (hasFailedSteps()) {
      return 'Processing failed - please check the errors above';
    }
    
    if (isProcessingComplete()) {
      return 'All steps completed successfully!';
    }
    
    const currentStep = getCurrentProcessingStep();
    if (currentStep) {
      return `${currentStep.label} • Step ${completed + 1} of ${total}`;
    }
    
    return `${completed} of ${total} steps completed`;
  };

  if (!id || !user) {
    return <div>Invalid presentation ID or user not authenticated</div>;
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#f8fafc',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1rem'
    }}>
      <div style={{ maxWidth: '600px', width: '100%' }}>
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '3rem'
        }}>
          <div>
            <h1 style={{ 
              margin: '0 0 0.5rem 0', 
              color: '#1e293b',
              fontSize: '2rem',
              fontWeight: '600'
            }}>
              Processing PowerPoint
            </h1>
            <p style={{ 
              margin: 0, 
              color: '#64748b',
              fontSize: '16px'
            }}>
              Presentation ID: {id}
            </p>
          </div>
        </div>

        {/* Connection Status */}
        {connectionError && (
          <div style={{
            marginBottom: '1rem',
            padding: '12px',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '6px',
            color: '#dc2626',
            fontSize: '14px'
          }}>
            ⚠️ Connection error: {connectionError}
          </div>
        )}

        {!isConnected && !connectionError && (
          <div style={{
            marginBottom: '1rem',
            padding: '12px',
            backgroundColor: '#fef3c7',
            border: '1px solid #fde68a',
            borderRadius: '6px',
            color: '#92400e',
            fontSize: '14px'
          }}>
            🔄 Connecting to status updates...
          </div>
        )}

        {/* Status Steps */}
        <div style={{ 
          backgroundColor: 'white', 
          borderRadius: '12px',
          padding: '2rem',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          <h2 style={{ 
            margin: '0 0 2rem 0', 
            color: '#1e293b',
            fontSize: '1.5rem',
            fontWeight: '600',
            textAlign: 'center'
          }}>
            Processing Status
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {statusSteps.map((step, index) => (
              <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', position: 'relative' }}>
                {/* Step Icon */}
                {getStepIcon(step.status)}
                
                {/* Step Label */}
                <div style={{ flex: 1 }}>
                  <h3 style={{ 
                    margin: 0, 
                    color: getStepTextColor(step.status),
                    fontSize: '18px',
                    fontWeight: '500'
                  }}>
                    {step.label}
                  </h3>
                  <p style={{ 
                    margin: '0.25rem 0 0 0', 
                    color: step.status === 'Failed' ? '#ef4444' : '#64748b',
                    fontSize: '14px'
                  }}>
                    {getStatusMessage(step.status)}
                  </p>
                </div>

                {/* Connection Line to Next Step */}
                {index < statusSteps.length - 1 && (
                  <div style={{
                    position: 'absolute',
                    left: '12px',
                    top: '100%',
                    width: '2px',
                    height: '1.5rem',
                    backgroundColor: step.status === 'Completed' ? '#10b981' : '#e5e7eb',
                    marginTop: '0.5rem'
                  }} />
                )}
              </div>
            ))}
          </div>

          {/* Progress Summary */}
          <div style={{ 
            marginTop: '2rem', 
            padding: '1rem',
            backgroundColor: hasFailedSteps() ? '#fef2f2' : isProcessingComplete() ? '#dcfce7' : '#f8fafc',
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <p style={{ 
              margin: 0, 
              color: hasFailedSteps() ? '#dc2626' : isProcessingComplete() ? '#166534' : '#64748b',
              fontSize: '14px'
            }}>
              {getProgressSummary()}
            </p>
          </div>

          {/* Action Buttons */}
          <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button
              onClick={handleBackToHome}
              style={{
                backgroundColor: 'transparent',
                color: '#3b82f6',
                border: '1px solid #3b82f6',
                padding: '12px 24px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: '500'
              }}
            >
              Back to Home
            </button>

            {isProcessingComplete() && (
              <button
                onClick={handleProceedToCustomization}
                style={{
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: '500'
                }}
              >
                Customize Presentation
              </button>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};