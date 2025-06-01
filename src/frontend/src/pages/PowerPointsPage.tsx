// pages/PowerPointsPage.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, RefreshCw } from 'lucide-react';
import { usePowerPoints } from '../hooks/usePowerPoints';
import { PowerPointCard } from '../components/PowerPoint/PowerPointCard';
import { PowerPointsService } from '../services/powerpointsService';
import { useAuth } from '../context/AuthContext';

export const PowerPointsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, getAccessToken } = useAuth();
  const [expandedPpts, setExpandedPpts] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const { powerpoints, loading, error, refetch } = usePowerPoints();

  const toggleExpanded = (pptId: string) => {
    const newExpanded = new Set(expandedPpts);
    if (newExpanded.has(pptId)) {
      newExpanded.delete(pptId);
    } else {
      newExpanded.add(pptId);
    }
    setExpandedPpts(newExpanded);
  };

  const handlePowerPointClick = (pptId: string, status: string) => {
    if (status === 'Processing') {
        navigate(`/status/${pptId}`);
        return
    }
    navigate(`/powerpoint/${pptId}`);
  };

  const handleVideoClick = (videoId: string, pptId: string, status: string) => {
    if (status === 'Processing') {
        navigate(`/status/powerpoint/${pptId}/video/${videoId}`);
        return
    }
    navigate(`/powerpoint/${pptId}/video/${videoId}`);
  };

  const handleDeletePowerPoint = async (pptId: string) => {
    if (!user) return;
    
    try {
      setIsDeleting(pptId);
      
      const token = await getAccessToken();
      if (!token) {
        throw new Error('Failed to get access token');
      }

      await PowerPointsService.deletePowerPoint(pptId, user.id, token);
      
      // Refetch data after successful deletion
      refetch();
      
      // Close the expanded section if it was the deleted PowerPoint
      if (expandedPpts.has(pptId)) {
        const newExpanded = new Set(expandedPpts);
        newExpanded.delete(pptId);
        setExpandedPpts(newExpanded);
      }
    } catch (error) {
      console.error('Error deleting PowerPoint:', error);
      // You might want to show an error toast/notification here
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete PowerPoint';
      alert(`Error: ${errorMessage}`); // Simple error display - replace with your preferred notification system
    } finally {
      setIsDeleting(null);
    }
  };

  const handleDeleteVideo = async (videoId: string) => {
    if (!user) return;
    
    // Find which PowerPoint contains this video
    const parentPowerPoint = powerpoints.find(ppt => 
      ppt.videos.some(video => video.videoId === videoId)
    );
    
    if (!parentPowerPoint) {
      console.error('Could not find parent PowerPoint for video');
      return;
    }
    
    try {
      setIsDeleting(videoId);
      
      const token = await getAccessToken();
      if (!token) {
        throw new Error('Failed to get access token');
      }

      await PowerPointsService.deleteVideo(parentPowerPoint.pptId, videoId, user.id, token);
      
      // Refetch data after successful deletion
      refetch();
    } catch (error) {
      console.error('Error deleting video:', error);
      // You might want to show an error toast/notification here
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete video';
      alert(`Error: ${errorMessage}`); // Simple error display - replace with your preferred notification system
    } finally {
      setIsDeleting(null);
    }
  };

  const handleRefresh = () => {
    refetch();
  };

  if (loading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        backgroundColor: '#f8fafc',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid #e2e8f0',
            borderTop: '4px solid #3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1rem auto'
          }}></div>
          <p style={{ color: '#64748b', margin: 0 }}>Loading PowerPoints...</p>
        </div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        backgroundColor: '#f8fafc',
        padding: '2rem 1rem'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{
            textAlign: 'center',
            padding: '3rem',
            backgroundColor: 'white',
            borderRadius: '12px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            border: '1px solid #fecaca'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              backgroundColor: '#fef2f2',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem auto'
            }}>
              <span style={{ fontSize: '24px' }}>⚠️</span>
            </div>
            <h3 style={{
              margin: '0 0 0.5rem 0',
              fontSize: '1.25rem',
              fontWeight: '600',
              color: '#dc2626'
            }}>
              Error Loading PowerPoints
            </h3>
            <p style={{
              margin: '0 0 1.5rem 0',
              color: '#64748b'
            }}>
              {error}
            </p>
            <button
              onClick={handleRefresh}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1.5rem',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#2563eb';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#3b82f6';
              }}
            >
              <RefreshCw size={16} />
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#f8fafc',
      padding: '2rem 1rem'
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
              margin: 0, 
              color: '#1e293b',
              fontSize: '2rem',
              fontWeight: '600',
              marginBottom: '0.5rem'
            }}>
              My PowerPoints
            </h1>
          </div>
          
          <button
            onClick={handleRefresh}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              backgroundColor: 'white',
              color: '#374151',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '500',
              transition: 'all 0.2s',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f9fafb';
              e.currentTarget.style.borderColor = '#9ca3af';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'white';
              e.currentTarget.style.borderColor = '#d1d5db';
            }}
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>

        {/* PowerPoints List */}
        {powerpoints.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '3rem',
            backgroundColor: 'white',
            borderRadius: '12px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
          }}>
            <FileText size={48} color="#9ca3af" style={{ marginBottom: '1rem' }} />
            <h3 style={{
              margin: '0 0 0.5rem 0',
              fontSize: '1.25rem',
              fontWeight: '600',
              color: '#374151'
            }}>
              No PowerPoints Found
            </h3>
            <p style={{
              margin: 0,
              color: '#64748b'
            }}>
              Upload your first PowerPoint to get started.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {powerpoints.map((ppt) => (
              <PowerPointCard
                key={ppt.pptId}
                powerPoint={ppt}
                isExpanded={expandedPpts.has(ppt.pptId)}
                onToggleExpanded={() => toggleExpanded(ppt.pptId)}
                onPowerPointClick={handlePowerPointClick}
                onVideoClick={handleVideoClick}
                onDeletePowerPoint={handleDeletePowerPoint}
                onDeleteVideo={handleDeleteVideo}
                isDeleting={isDeleting}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};