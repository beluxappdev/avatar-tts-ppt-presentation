import React, { useState } from 'react';
import { ChevronDown, ChevronRight, FileText, Play, Clock, Trash2, MoreVertical } from 'lucide-react';
import { PowerPoint } from '../../types/powerPoint';
import { StatusBadge } from './StatusBadge';
import { ConfirmationModal } from './ConfirmationModal';

interface PowerPointCardProps {
  powerPoint: PowerPoint;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  onPowerPointClick: (pptId: string, status: string) => void;
  onVideoClick: (videoId: string, pptId: string, status: string) => void;
  onDeletePowerPoint: (pptId: string) => void;
  onDeleteVideo: (videoId: string) => void;
  isDeleting: string | null;
}

export const PowerPointCard: React.FC<PowerPointCardProps> = ({
  powerPoint,
  isExpanded,
  onToggleExpanded,
  onPowerPointClick,
  onVideoClick,
  onDeletePowerPoint,
  onDeleteVideo,
  isDeleting
}) => {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showPptOptions, setShowPptOptions] = useState(false);
  const [videoToDelete, setVideoToDelete] = useState<string | null>(null);

  const getPlaceholderImage = () => {
    return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjE1MCIgdmlld0JveD0iMCAwIDIwMCAxNTAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMTUwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik03MCA2MEg5MFY4MEg3MFY2MFoiIGZpbGw9IiM5Q0EzQUYiLz4KPHA+PC9wPgo8cGF0aCBkPSJNNzAgOTBIMTMwVjEwMEg3MFY5MFoiIGZpbGw9IiM5Q0EzQUYiLz4KPHA+PC9wPgo8cGF0aCBkPSJNNzAgMTEwSDExMFYxMjBINzBWMTEwWiIgZmlsbD0iIzlDQTNBRiIvPgo8L3N2Zz4K';
  };

  const handleDeletePowerPoint = () => {
    if (powerPoint.videos.length > 0) {
      setShowDeleteModal(true);
    } else {
      onDeletePowerPoint(powerPoint.pptId);
    }
  };

  const handleConfirmDeletePowerPoint = () => {
    onDeletePowerPoint(powerPoint.pptId);
    setShowDeleteModal(false);
  };

  const handleDeleteVideo = (videoId: string) => {
    setVideoToDelete(videoId);
  };

  const handleConfirmDeleteVideo = () => {
    if (videoToDelete) {
      onDeleteVideo(videoToDelete);
      setVideoToDelete(null);
    }
  };

  return (
    <>
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          overflow: 'hidden'
        }}
      >
        {/* PowerPoint Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '1.5rem',
            gap: '1rem',
            cursor: 'pointer',
            transition: 'background-color 0.2s'
          }}
          onClick={() => onPowerPointClick(powerPoint.pptId, powerPoint.status)}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#f8fafc';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'white';
          }}
        >
          {/* Thumbnail */}
          <div style={{
            width: '120px',
            height: '90px',
            borderRadius: '8px',
            overflow: 'hidden',
            flexShrink: 0,
            border: '2px solid #e2e8f0'
          }}>
            <img
              src={powerPoint.status === 'Completed' && powerPoint.blobUrl ? powerPoint.blobUrl : getPlaceholderImage()}
              alt={powerPoint.filename}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover'
              }}
            />
          </div>

          {/* PowerPoint Info */}
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <FileText size={20} color="#64748b" />
              <h3 style={{
                margin: 0,
                fontSize: '1.125rem',
                fontWeight: '600',
                color: '#1e293b'
              }}>
                {powerPoint.filename}
              </h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <StatusBadge status={powerPoint.status} />
              <span style={{ color: '#64748b', fontSize: '0.875rem' }}>
                {powerPoint.videos.length} video{powerPoint.videos.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {/* Options Menu */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowPptOptions(!showPptOptions);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0.5rem',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#e2e8f0';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <MoreVertical size={16} color="#64748b" />
              </button>
              
              {showPptOptions && (
                <>
                  <div
                    style={{
                      position: 'fixed',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      zIndex: 1000,
                      backgroundColor: 'transparent'
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowPptOptions(false);
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      right: 0,
                      backgroundColor: 'white',
                      borderRadius: '8px',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                      border: '1px solid #e5e7eb',
                      overflow: 'hidden',
                      zIndex: 1001,
                      minWidth: '150px'
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowPptOptions(false);
                        handleDeletePowerPoint();
                      }}
                      disabled={isDeleting === powerPoint.pptId}
                      style={{
                        width: '100%',
                        padding: '0.75rem 1rem',
                        border: 'none',
                        background: 'none',
                        color: isDeleting === powerPoint.pptId ? '#9ca3af' : '#dc2626',
                        fontSize: '0.875rem',
                        cursor: isDeleting === powerPoint.pptId ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        if (isDeleting !== powerPoint.pptId) {
                          e.currentTarget.style.backgroundColor = '#fef2f2';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (isDeleting !== powerPoint.pptId) {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }
                      }}
                    >
                      {isDeleting === powerPoint.pptId ? (
                        <>
                          <div style={{
                            width: '16px',
                            height: '16px',
                            border: '2px solid #e5e7eb',
                            borderTop: '2px solid #9ca3af',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite'
                          }}></div>
                          Deleting...
                        </>
                      ) : (
                        <>
                          <Trash2 size={16} />
                          Delete PowerPoint
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Expand/Collapse Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpanded();
              }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '0.5rem',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#e2e8f0';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              {isExpanded ? 
                <ChevronDown size={20} color="#64748b" /> : 
                <ChevronRight size={20} color="#64748b" />
              }
            </button>
          </div>
        </div>

        {/* Videos Section */}
        {isExpanded && (
          <div style={{
            borderTop: '1px solid #e2e8f0',
            padding: '1rem 1.5rem'
          }}>
            <h4 style={{
              margin: '0 0 1rem 0',
              fontSize: '1rem',
              fontWeight: '600',
              color: '#374151'
            }}>
              Videos ({powerPoint.videos.length})
            </h4>
            
            {powerPoint.videos.length === 0 ? (
              <p style={{
                margin: 0,
                color: '#64748b',
                fontStyle: 'italic'
              }}>
                No videos available
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {powerPoint.videos.map((video) => (
                  <div
                    key={video.videoId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.75rem',
                      backgroundColor: '#f8fafc',
                      borderRadius: '8px',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f1f5f9';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#f8fafc';
                    }}
                  >
                    <div
                      onClick={() => onVideoClick(video.videoId, powerPoint.pptId, video.status)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        flex: 1,
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{
                        width: '40px',
                        height: '40px',
                        backgroundColor: video.status === 'Processing' ? '#fbbf24' : '#3b82f6',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        {video.status === 'Processing' ? 
                          <Clock size={20} color="white" /> : 
                          <Play size={16} color="white" />
                        }
                      </div>
                      
                      <div style={{ flex: 1 }}>
                        <div style={{
                          fontSize: '0.875rem',
                          fontWeight: '500',
                          color: '#1e293b',
                          marginBottom: '0.25rem'
                        }}>
                          {video.videoName}
                        </div>
                        <StatusBadge status={video.status} />
                      </div>
                    </div>

                    {/* Video Delete Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteVideo(video.videoId);
                      }}
                      disabled={isDeleting === video.videoId}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: isDeleting === video.videoId ? 'not-allowed' : 'pointer',
                        padding: '0.5rem',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'background-color 0.2s',
                        color: isDeleting === video.videoId ? '#9ca3af' : '#64748b'
                      }}
                      onMouseEnter={(e) => {
                        if (isDeleting !== video.videoId) {
                          e.currentTarget.style.backgroundColor = '#fee2e2';
                          e.currentTarget.style.color = '#dc2626';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (isDeleting !== video.videoId) {
                          e.currentTarget.style.backgroundColor = 'transparent';
                          e.currentTarget.style.color = '#64748b';
                        }
                      }}
                    >
                      {isDeleting === video.videoId ? (
                        <div style={{
                          width: '16px',
                          height: '16px',
                          border: '2px solid #e5e7eb',
                          borderTop: '2px solid #9ca3af',
                          borderRadius: '50%',
                          animation: 'spin 1s linear infinite'
                        }}></div>
                      ) : (
                        <Trash2 size={16} />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* PowerPoint Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleConfirmDeletePowerPoint}
        title="Delete PowerPoint"
        message="Are you sure you want to delete this PowerPoint? This will also delete all associated videos. This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />

      {/* Video Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!videoToDelete}
        onClose={() => setVideoToDelete(null)}
        onConfirm={handleConfirmDeleteVideo}
        title="Delete Video"
        message="Are you sure you want to delete this video? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />
    </>
  );
};