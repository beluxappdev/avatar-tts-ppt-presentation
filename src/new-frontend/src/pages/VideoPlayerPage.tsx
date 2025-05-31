import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useVideo } from '../hooks/useVideo';

export const VideoPlayerPage = () => {
  const { videoId, pptId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const {
    videoUrl,
    isLoading,
    error,
    refetch
  } = useVideo(videoId || '', pptId || '');

  console.log(`videoUrl: ${videoUrl}`);

  const handleBackToHome = () => {
    navigate('/');
  };

  if (!videoId) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        backgroundColor: '#f8fafc',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem'
      }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ color: '#dc2626', marginBottom: '1rem' }}>Invalid Video ID</h1>
          <button
            onClick={handleBackToHome}
            style={{
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        backgroundColor: '#f8fafc',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem'
      }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ color: '#dc2626', marginBottom: '1rem' }}>Authentication Required</h1>
          <p style={{ color: '#64748b', marginBottom: '2rem' }}>Please log in to view this video.</p>
          <button
            onClick={handleBackToHome}
            style={{
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#f8fafc',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem'
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '2rem'
        }}>
          <div>
            <h1 style={{ 
              margin: '0 0 0.5rem 0', 
              color: '#1e293b',
              fontSize: '2rem',
              fontWeight: '600'
            }}>
              Video Player
            </h1>
          </div>
          
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              onClick={handleBackToHome}
              style={{
                backgroundColor: 'transparent',
                color: '#64748b',
                border: '1px solid #d1d5db',
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

        {/* Video Player Container */}
        <div style={{ 
          backgroundColor: 'white', 
          borderRadius: '12px',
          padding: '2rem',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          {/* Loading State */}
          {isLoading && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '400px',
              gap: '1rem'
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                border: '4px solid #e5e7eb',
                borderTop: '4px solid #3b82f6',
                animation: 'spin 1s linear infinite'
              }} />
              <p style={{ 
                color: '#64748b',
                fontSize: '16px',
                margin: 0
              }}>
                Loading video...
              </p>
            </div>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '400px',
              gap: '1rem'
            }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: '#fef2f2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px'
              }}>
                ⚠️
              </div>
              <h3 style={{ 
                color: '#dc2626',
                fontSize: '18px',
                margin: 0
              }}>
                Failed to Load Video
              </h3>
              <p style={{ 
                color: '#64748b',
                fontSize: '14px',
                margin: 0,
                textAlign: 'center'
              }}>
                {error}
              </p>
              <button
                onClick={refetch}
                style={{
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Try Again
              </button>
            </div>
          )}

          {/* Video Player */}
          {videoUrl && !isLoading && !error && (
            <div style={{
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}>
              <video
                controls
                style={{
                  width: '100%',
                  maxHeight: '600px',
                  borderRadius: '8px',
                  backgroundColor: '#000'
                }}
                poster="" // Add poster image if available
              >
                <source src={videoUrl} type="video/mp4" />
                <source src={videoUrl} type="video/webm" />
                <source src={videoUrl} type="video/ogg" />
                Your browser does not support the video tag.
              </video>
            </div>
          )}
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