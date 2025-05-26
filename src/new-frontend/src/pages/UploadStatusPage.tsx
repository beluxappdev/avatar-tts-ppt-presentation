import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface StatusStep {
  id: string;
  label: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
}

export const UploadStatusPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { logout } = useAuth();

  // Mock status data - will be replaced with real data from websocket
  const statusSteps: StatusStep[] = [
    { id: 'saving', label: 'Saving PowerPoint', status: 'completed' },
    { id: 'extracting_scripts', label: 'Extracting Scripts', status: 'processing' },
    { id: 'extracting_images', label: 'Extracting Images', status: 'pending' },
  ];

  const getStepIcon = (status: StatusStep['status']) => {
    switch (status) {
      case 'completed':
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
      case 'processing':
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
      case 'error':
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
      default: // pending
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

  const getStepTextColor = (status: StatusStep['status']) => {
    switch (status) {
      case 'completed':
        return '#10b981';
      case 'processing':
        return '#3b82f6';
      case 'error':
        return '#ef4444';
      default:
        return '#9ca3af';
    }
  };

  const handleBackToHome = () => {
    navigate('/');
  };

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
          <button 
            onClick={logout}
            style={{
              backgroundColor: 'transparent',
              color: '#64748b',
              border: '1px solid #e2e8f0',
              padding: '8px 16px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Sign Out
          </button>
        </div>

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
              <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
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
                  {step.status === 'processing' && (
                    <p style={{ 
                      margin: '0.25rem 0 0 0', 
                      color: '#64748b',
                      fontSize: '14px'
                    }}>
                      In progress...
                    </p>
                  )}
                  {step.status === 'completed' && (
                    <p style={{ 
                      margin: '0.25rem 0 0 0', 
                      color: '#10b981',
                      fontSize: '14px'
                    }}>
                      Completed successfully
                    </p>
                  )}
                </div>

                {/* Connection Line to Next Step */}
                {index < statusSteps.length - 1 && (
                  <div style={{
                    position: 'absolute',
                    left: '12px',
                    top: '100%',
                    width: '2px',
                    height: '1.5rem',
                    backgroundColor: step.status === 'completed' ? '#10b981' : '#e5e7eb',
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
            backgroundColor: '#f8fafc',
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <p style={{ 
              margin: 0, 
              color: '#64748b',
              fontSize: '14px'
            }}>
              Step 2 of 3 completed • Estimated time remaining: ~2 minutes
            </p>
          </div>

          {/* Back Button */}
          <div style={{ marginTop: '2rem', textAlign: 'center' }}>
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
