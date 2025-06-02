import React, { useEffect } from 'react';
import SlideViewer from './SlideViewer';
import { AvatarPosition, AvatarSize, AvatarType } from '../../types/avatar';

interface Slide {
  index: number;
  blobUrl: string;
  script: string | null;
}

interface SlideAvatarConfig {
  showAvatar: boolean;
  avatarPosition: AvatarPosition;
  avatarSize: AvatarSize;
  avatarType: AvatarType;
}

interface FullscreenViewerProps {
  slide: Slide;
  avatarConfig: SlideAvatarConfig;
  megAvatar: string;
  harryAvatar: string;
  jeffAvatar: string;
  maxAvatar: string;
  loriAvatar: string;
  currentSlide: number;
  totalSlides: number;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
}

const FullscreenViewer: React.FC<FullscreenViewerProps> = ({
  slide,
  avatarConfig,
  megAvatar,
  harryAvatar,
  jeffAvatar,
  maxAvatar,
  loriAvatar,
  currentSlide,
  totalSlides,
  onClose,
  onPrevious,
  onNext
}) => {
  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        onPrevious();
      } else if (e.key === 'ArrowRight') {
        onNext();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onPrevious, onNext, onClose]);

  const containerStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    backgroundColor: 'black',
    zIndex: 1300,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem'
  };

  const closeButtonStyle: React.CSSProperties = {
    position: 'absolute',
    top: '1rem',
    right: '1rem',
    zIndex: 1301,
    padding: '0.5rem',
    backgroundColor: 'transparent',
    color: 'white',
    border: 'none',
    cursor: 'pointer',
    fontSize: '1.5rem'
  };

  const contentContainerStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative'
  };

  const navButtonStyle: React.CSSProperties = {
    position: 'absolute',
    padding: '0.5rem',
    backgroundColor: 'transparent',
    color: 'white',
    border: 'none',
    cursor: 'pointer',
    fontSize: '2rem',
    zIndex: 1301,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  };

  const disabledNavButtonStyle: React.CSSProperties = {
    ...navButtonStyle,
    color: '#666',
    cursor: 'not-allowed'
  };

  const slideCounterStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: '1rem',
    color: 'white',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: '0.5rem 1rem',
    borderRadius: '4px'
  };

  return (
    <div style={containerStyle}>
      <button style={closeButtonStyle} onClick={onClose}>
        ⛶
      </button>
      
      <div style={contentContainerStyle}>
        <button
          style={currentSlide === 0 ? disabledNavButtonStyle : navButtonStyle}
          onClick={onPrevious}
          disabled={currentSlide === 0}
          className="nav-left"
          color="black"
        >
          ◀
        </button>
        
        <SlideViewer
          slide={slide}
          avatarConfig={avatarConfig}
          megAvatar={megAvatar}
          harryAvatar={harryAvatar}
          jeffAvatar={jeffAvatar}
          maxAvatar={maxAvatar} 
          loriAvatar={loriAvatar}
          isFullscreen={true}
        />
        
        <button
          style={currentSlide === totalSlides - 1 ? disabledNavButtonStyle : navButtonStyle}
          onClick={onNext}
          disabled={currentSlide === totalSlides - 1}
          className="nav-right"
          color="black"
        >
          ▶
        </button>
      </div>
      
      <div style={slideCounterStyle}>
        Slide {currentSlide + 1} of {totalSlides}
      </div>

      <style>{`
        .nav-left {
          left: 1rem;
        }
        .nav-right {
          right: 1rem;
        }
      `}</style>
    </div>
  );
};

export default FullscreenViewer;