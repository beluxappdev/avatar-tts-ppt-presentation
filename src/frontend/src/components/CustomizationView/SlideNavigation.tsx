import React, { useState } from 'react';

interface SlideNavigationProps {
  currentSlide: number;
  totalSlides: number;
  onPrevious: () => void;
  onNext: () => void;
  onFullscreen?: () => void;
  onSlideChange?: (slideIndex: number) => void;
}

const SlideNavigation: React.FC<SlideNavigationProps> = ({
  currentSlide,
  totalSlides,
  onPrevious,
  onNext,
  onFullscreen,
  onSlideChange
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const handleSlideNumberClick = () => {
    setInputValue((currentSlide + 1).toString());
    setIsEditing(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Only allow numeric input
    if (/^\d*$/.test(value)) {
      setInputValue(value);
    }
  };

  const handleInputSubmit = () => {
    const slideNumber = parseInt(inputValue);
    if (slideNumber && onSlideChange) {
      // Clamp the value between 1 and totalSlides
      const clampedSlideNumber = Math.max(1, Math.min(slideNumber, totalSlides));
      // Convert to 0-based index
      onSlideChange(clampedSlideNumber - 1);
    }
    setIsEditing(false);
  };

  const handleInputKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleInputSubmit();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
    }
  };

  const handleInputBlur = () => {
    handleInputSubmit();
  };

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
    color: '#333'
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
    color: '#333'
  };

  const clickableSlideStyle: React.CSSProperties = {
    fontSize: '1rem',
    fontWeight: 500,
    color: '#333',
    cursor: 'pointer',
    padding: '4px 8px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    backgroundColor: '#f9f9f9',
    transition: 'all 0.2s',
    display: 'inline-block'
  };

  const slideInputStyle: React.CSSProperties = {
    width: '50px',
    padding: '2px 4px',
    fontSize: '1rem',
    fontWeight: 500,
    border: '2px solid #1976d2',
    borderRadius: '4px',
    textAlign: 'center' as const,
    outline: 'none'
  };

  const staticTextStyle: React.CSSProperties = {
    fontSize: '1rem',
    fontWeight: 500,
    color: '#333'
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
        <span style={staticTextStyle}>
          Slide{' '}
          {isEditing ? (
            <input
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleInputKeyPress}
              onBlur={handleInputBlur}
              style={slideInputStyle}
              autoFocus
              maxLength={3}
            />
          ) : (
            <span 
              style={clickableSlideStyle}
              onClick={handleSlideNumberClick}
              title="Click to jump to a specific slide"
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#e9e9e9';
                e.currentTarget.style.borderColor = '#bbb';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = '#f9f9f9';
                e.currentTarget.style.borderColor = '#ddd';
              }}
            >
              {currentSlide + 1}
            </span>
          )}
          {' '}of {totalSlides}
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