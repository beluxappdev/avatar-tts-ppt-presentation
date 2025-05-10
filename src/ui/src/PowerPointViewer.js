import React, { useState, useEffect } from 'react';

const PowerPointViewer = ({ pptId }) => {
  const [slides, setSlides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentSlide, setCurrentSlide] = useState(0);

  // Function to get the appropriate API URL based on environment
  const getApiUrl = () => {
    return window.location.hostname === 'localhost' 
      ? `http://localhost:8080/api/ppt/${pptId}/slides` // Local development
      : `http://api/api/ppt/${pptId}/slides`;           // Docker environment
  };

  // Fetch slides when pptId is available
  useEffect(() => {
    if (!pptId) return;

    const fetchSlides = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(getApiUrl());

        if (!response.ok) {
          throw new Error(`Failed to fetch slides: ${response.status}`);
        }

        const data = await response.json();
        console.log('Slides data:', data);
        
        if (data.slides && data.slides.length > 0) {
          setSlides(data.slides);
          setCurrentSlide(0); // Reset to first slide
        } else {
          setError('No slides found for this presentation');
        }
      } catch (err) {
        console.error('Error fetching slides:', err);
        setError(`Error fetching slides: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchSlides();
  }, [pptId]);

  // Navigate to previous slide
  const prevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  // Navigate to next slide
  const nextSlide = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    }
  };

  if (loading) {
    return (
      <div className="ppt-viewer-loading">
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{ 
            display: 'inline-block',
            width: '40px',
            height: '40px',
            border: '4px solid #f3f3f3',
            borderTop: '4px solid #3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
          <p>Loading slides...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        background: '#fee2e2', 
        border: '1px solid #fecaca',
        borderRadius: '4px',
        padding: '20px',
        margin: '20px 0',
        color: '#b91c1c'
      }}>
        {error}
      </div>
    );
  }

  return (
    <div className="ppt-viewer" style={{ 
      maxWidth: '900px', 
      margin: '0 auto', 
      padding: '20px',
      background: 'white',
      borderRadius: '8px',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
    }}>
      <h2 style={{ marginTop: 0 }}>PowerPoint Viewer</h2>
      
      {slides.length > 0 ? (
        <div>
          {/* Slide Navigation */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '15px'
          }}>
            <button 
              onClick={prevSlide} 
              disabled={currentSlide === 0}
              style={{
                padding: '8px 16px',
                background: currentSlide === 0 ? '#ccc' : '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: currentSlide === 0 ? 'not-allowed' : 'pointer'
              }}
            >
              Previous
            </button>
            
            <div>
              Slide {currentSlide + 1} of {slides.length}
            </div>
            
            <button 
              onClick={nextSlide} 
              disabled={currentSlide === slides.length - 1}
              style={{
                padding: '8px 16px',
                background: currentSlide === slides.length - 1 ? '#ccc' : '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: currentSlide === slides.length - 1 ? 'not-allowed' : 'pointer'
              }}
            >
              Next
            </button>
          </div>
          
          {/* Slide Content */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Slide Image */}
            <div style={{ 
              textAlign: 'center',
              background: '#f9fafb',
              border: '1px solid #e5e7eb',
              borderRadius: '4px',
              padding: '20px'
            }}>
              <img 
                src={slides[currentSlide].blobUrl} 
                alt={`Slide ${currentSlide + 1}`} 
                style={{ 
                  maxWidth: '100%', 
                  maxHeight: '400px',
                  objectFit: 'contain'
                }}
              />
            </div>
            
            {/* Slide Script */}
            <div style={{ 
              background: '#f0f9ff',
              border: '1px solid #bae6fd',
              borderRadius: '4px',
              padding: '16px'
            }}>
              <h3 style={{ marginTop: 0 }}>Slide Script</h3>
              {slides[currentSlide].script ? (
                <div style={{ whiteSpace: 'pre-wrap' }}>
                  {slides[currentSlide].script}
                </div>
              ) : (
                <div style={{ fontStyle: 'italic', color: '#6b7280' }}>
                  No script available for this slide.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
          No slides available.
        </div>
      )}
    </div>
  );
};

export default PowerPointViewer;