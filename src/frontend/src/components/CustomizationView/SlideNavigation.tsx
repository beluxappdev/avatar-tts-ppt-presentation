import React from 'react';

interface SlideNavigationProps {
  currentSlide: number;
  totalSlides: number;
  onPrevious: () => void;
  onNext: () => void;
  onFullscreen?: () => void;
}

const SlideNavigation: React.FC<SlideNavigationProps> = ({
  currentSlide,
  totalSlides,
  onPrevious,
  onNext,
  onFullscreen
}) => {
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem'
  };

  const buttonStyle: React.CSSProperties = {
    padding: '0.75rem 1.5rem',
    backgroundColor: '#1976d2',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem'
  };

  const disabledButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: '#ccc',
    cursor: 'not-allowed'
  };

  const centerContentStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    color: '#333' // Dark text for white background
  };

  const fullscreenButtonStyle: React.CSSProperties = {
    padding: '0.5rem',
    backgroundColor: 'transparent',
    border: '1px solid #ddd',
    borderRadius: '4px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#333' // Dark text for visibility
  };

  return (
    <div style={containerStyle}>
      <button 
        style={currentSlide === 0 ? disabledButtonStyle : buttonStyle}
        onClick={onPrevious} 
        disabled={currentSlide === 0}
      >
        <span>◀</span>
        Previous
      </button>
      
      <div style={centerContentStyle}>
        <span style={{ fontSize: '1rem', fontWeight: 500, color: '#333' }}>
          Slide {currentSlide + 1} of {totalSlides}
        </span>
        {onFullscreen && (
          <button style={fullscreenButtonStyle} onClick={onFullscreen}>
            ⛶
          </button>
        )}
      </div>
      
      <button 
        style={currentSlide === totalSlides - 1 ? disabledButtonStyle : buttonStyle}
        onClick={onNext} 
        disabled={currentSlide === totalSlides - 1}
      >
        Next
        <span>▶</span>
      </button>
    </div>
  );
};

export default SlideNavigation;