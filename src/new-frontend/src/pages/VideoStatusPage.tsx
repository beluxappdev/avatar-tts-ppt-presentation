import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useVideoProcessingStatus } from '../hooks/useVideoProcessingStatus';

export const VideoStatusPage = () => {
  const { videoId, pptId: presentationId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const {
    completedVideos,
    totalVideos,
    isConnected,
    connectionError,
    getVideoProgress,
    isProcessingComplete
  } = useVideoProcessingStatus({
    presentationId: presentationId || '',
    videoId: videoId || '',
    userId: user?.id || ''
  });

  const handleBackToHome = () => {
    navigate('/');
  };

  const handleViewPresentation = () => {
    navigate(`/powerpoint/${presentationId}/video/${videoId}`);
  };

  if (!videoId || !presentationId || !user) {
    return <div>Invalid video ID, presentation ID, or user not authenticated</div>;
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
              Generating Video
            </h1>
            <div style={{ 
              margin: 0, 
              color: '#64748b',
              fontSize: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.25rem'
            }}>
              <p style={{ margin: 0 }}>Video ID: {videoId}</p>
              <p style={{ margin: 0 }}>Presentation ID: {presentationId}</p>
            </div>
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

        {/* Video Progress Card */}
        <div style={{ 
          backgroundColor: 'white', 
          borderRadius: '12px',
          padding: '2rem',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          <h2 style={{ 
            margin: '0 0 1rem 0', 
            color: '#1e293b',
            fontSize: '1.5rem',
            fontWeight: '600',
            textAlign: 'center'
          }}>
            Video Generation Progress
          </h2>
          
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '1rem'
          }}>
            <span style={{ color: '#64748b', fontSize: '16px' }}>
              Videos completed: {completedVideos} of {totalVideos}
            </span>
            <span style={{ 
              color: '#3b82f6', 
              fontSize: '18px', 
              fontWeight: '600' 
            }}>
              {getVideoProgress()}%
            </span>
          </div>
          
          {/* Progress Bar */}
          <div style={{
            width: '100%',
            height: '8px',
            backgroundColor: '#e5e7eb',
            borderRadius: '4px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${getVideoProgress()}%`,
              height: '100%',
              backgroundColor: '#3b82f6',
              borderRadius: '4px',
              transition: 'width 0.3s ease'
            }} />
          </div>

          {/* Status Message with Loading Spinner */}
          <div style={{ 
            marginTop: '2rem', 
            padding: '1rem',
            backgroundColor: isProcessingComplete() ? '#dcfce7' : '#f8fafc',
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}>
              {!isProcessingComplete() && (
                <div style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  border: '2px solid #e5e7eb',
                  borderTop: '2px solid #3b82f6',
                  animation: 'spin 1s linear infinite'
                }} />
              )}
              <p style={{ 
                margin: 0, 
                color: isProcessingComplete() ? '#166534' : '#64748b',
                fontSize: '14px'
              }}>
                {isProcessingComplete() ? 'All videos completed successfully!' : 'Processing...'}
              </p>
            </div>
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
                onClick={handleViewPresentation}
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
                View Presentation
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