import React, { useState, useEffect, useRef } from 'react';
import { HubConnectionBuilder } from '@microsoft/signalr';

const PowerPointUploader = () => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [uploadedPptId, setUploadedPptId] = useState(null);
  
  // Processing status states
  const [savingPpt, setSavingPpt] = useState({ status: 'pending', completed: false });
  const [extractingScripts, setExtractingScripts] = useState({ status: 'pending', completed: false });
  const [extractingImages, setExtractingImages] = useState({ status: 'pending', completed: false });
  const [processingComplete, setProcessingComplete] = useState(false);
  
  // Slides viewer states
  const [showViewer, setShowViewer] = useState(false);
  const [slides, setSlides] = useState([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slidesLoading, setSlidesLoading] = useState(false);
  const [slidesError, setSlidesError] = useState(null);
  
  // SignalR connection
  const connection = useRef(null);
  
  // Get base API URL based on environment
  const getBaseApiUrl = () => {
    return 'http://localhost:8080';
    console.log("process.env:", process.env);
    console.log('REACT_APP_API_BASE_URL:', process.env.REACT_APP_API_BASE_URL);
  
    // Check for environment variable first
    if (process.env.REACT_APP_API_BASE_URL) {
      console.log('Using API URL from environment variable:', process.env.REACT_APP_API_BASE_URL);
      return process.env.REACT_APP_API_BASE_URL;
    }
  
    // Fallback based on hostname
    if (window.location.hostname === 'localhost') {
      console.log('Using localhost development API URL');
      return 'http://localhost:8080';
    } 
  
    // For production, construct HTTPS URL based on hostname pattern
    const hostnameParts = window.location.hostname.split('.');
    const domain = hostnameParts.slice(1).join('.');
    const httpsApiUrl = `https://api.${domain}`;
  
    console.log('Constructed API URL:', httpsApiUrl);
    return httpsApiUrl;  // Production environment with HTTPS
  };

  // Get specific endpoint URLs based on the base URL
  const getApiUrl = () => {
    return `${getBaseApiUrl()}/api/save_ppt`;
  };

  const getSignalRUrl = () => {
    return `${getBaseApiUrl()}/processingStatusHub`;
  };

  const getSlidesApiUrl = (id) => {
    return `${getBaseApiUrl()}/api/ppt/${id}/slides`;
  };
  
  // Connect to SignalR hub when a PowerPoint is uploaded
  useEffect(() => {
    if (!uploadedPptId) return;
    
    // Start with a clean slate
    setSavingPpt({ status: 'pending', completed: false });
    setExtractingScripts({ status: 'pending', completed: false });
    setExtractingImages({ status: 'pending', completed: false });
    setProcessingComplete(false);
    setShowViewer(false);
    
    // Create SignalR connection
    const newConnection = new HubConnectionBuilder()
      .withUrl(getSignalRUrl())
      .withAutomaticReconnect()
      .build();
    
    connection.current = newConnection;
    
    // Set up event handlers for different message types
    newConnection.on('ReceiveStatusUpdate', (data) => {
      console.log('Status update:', data);
      
      // Handle overall status updates
      if (data.status === 'Completed') {
        setProcessingComplete(true);
        
        // Ensure all checkboxes are marked as completed
        setSavingPpt({ status: 'completed', completed: true });
        setExtractingScripts({ status: 'completed', completed: true });
        setExtractingImages({ status: 'completed', completed: true });
        
        setMessage('PowerPoint processing completed successfully!');
        
        // Fetch slides when processing is complete
        fetchSlides(uploadedPptId);
      } else if (data.status === 'Processing') {
        setSavingPpt({ status: 'completed', completed: true });
      } else if (data.status === 'Failed') {
        setError(`Processing failed: ${data.detail || 'Unknown error'}`);
      }
    });
    
    newConnection.on('ReceiveProcessingUpdate', (data) => {
      console.log('Processing update:', data);
      
      // Handle specific processing updates
      if (data.processingType === 'BlobStorage' && data.status === 'Completed') {
        setSavingPpt({ status: 'completed', completed: true });
      } else if (data.processingType === 'ScriptProcessing') {
        if (data.status === 'Processing') {
          setExtractingScripts({ status: 'processing', completed: false });
        } else if (data.status === 'Completed') {
          setExtractingScripts({ status: 'completed', completed: true });
        }
      } else if (data.processingType === 'ImageProcessing') {
        if (data.status === 'Processing') {
          setExtractingImages({ status: 'processing', completed: false });
        } else if (data.status === 'Completed') {
          setExtractingImages({ status: 'completed', completed: true });
        }
      }
    });
    
    // Start the connection and subscribe to updates for this PowerPoint
    const startConnection = async () => {
      try {
        await newConnection.start();
        console.log('SignalR connected');
        
        // Subscribe to updates for this PowerPoint
        await newConnection.invoke('SubscribeToPptUpdates', uploadedPptId);
        console.log('Subscribed to updates for:', uploadedPptId);
      } catch (err) {
        console.error('Error connecting to SignalR:', err);
      }
    };
    
    startConnection();
    
    // Clean up when component unmounts or pptId changes
    return () => {
      if (connection.current) {
        connection.current.stop();
      }
    };
  }, [uploadedPptId]);
  
  // Function to fetch slides when processing is complete
  const fetchSlides = async (pptId) => {
    try {
      setSlidesLoading(true);
      setSlidesError(null);
      
      const response = await fetch(getSlidesApiUrl(pptId));
      
      if (!response.ok) {
        throw new Error(`Failed to fetch slides: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Slides data:', data);
      
      if (data.slides && data.slides.length > 0) {
        setSlides(data.slides);
        setCurrentSlide(0); // Start with the first slide
        setShowViewer(true); // Show the viewer
      } else {
        setSlidesError('No slides found for this presentation');
      }
    } catch (err) {
      console.error('Error fetching slides:', err);
      setSlidesError(`Error fetching slides: ${err.message}`);
    } finally {
      setSlidesLoading(false);
    }
  };
  
  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile && selectedFile.name.match(/\.(ppt|pptx)$/i)) {
      setFile(selectedFile);
      setError(null);
    } else if (selectedFile) {
      setFile(null);
      setError("Please select a valid PowerPoint file (.ppt or .pptx)");
    }
  };
  
  const handleDragOver = (event) => {
    event.preventDefault();
  };
  
  const handleDrop = (event) => {
    event.preventDefault();
    
    const droppedFile = event.dataTransfer.files[0];
    if (droppedFile && droppedFile.name.match(/\.(ppt|pptx)$/i)) {
      setFile(droppedFile);
      setError(null);
    } else if (droppedFile) {
      setFile(null);
      setError("Please drop a valid PowerPoint file (.ppt or .pptx)");
    }
  };
  
  const handleUpload = async () => {
    if (!file) {
      setError("Please select a file first");
      return;
    }
    
    try {
      setLoading(true);
      setMessage(null);
      setError(null);
      setShowViewer(false);
      
      // Reset previous processing state
      setUploadedPptId(null);
      setSavingPpt({ status: 'pending', completed: false });
      setExtractingScripts({ status: 'pending', completed: false });
      setExtractingImages({ status: 'pending', completed: false });
      setProcessingComplete(false);
      
      const formData = new FormData();
      formData.append('file', file);
      
      const apiUrl = getApiUrl();
      console.log('Uploading to:', apiUrl);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        body: formData
      });
      
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        let errorMessage;
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || `Upload failed with status ${response.status}`;
        } catch (e) {
          errorMessage = `Upload failed with status ${response.status}`;
        }
        throw new Error(errorMessage);
      }
      
      const result = await response.json();
      console.log('Upload result:', result);
      
      setMessage(`File uploaded! ID: ${result.pptId}`);
      
      // Set the uploaded PowerPoint ID to trigger the SignalR connection
      setUploadedPptId(result.pptId);
      
      // Start with saving PPT in progress
      setSavingPpt({ status: 'processing', completed: false });
      
      // Reset file input
      const fileInput = document.querySelector('input[type="file"]');
      if (fileInput) {
        fileInput.value = '';
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError(`Upload error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };
  
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
  
  // Status indicator component
  const StatusIndicator = ({ status, label }) => {
    const getStatusColor = () => {
      switch (status.status) {
        case 'completed':
          return '#4ade80'; // Green
        case 'processing':
          return '#3b82f6'; // Blue
        case 'pending':
        default:
          return '#d1d5db'; // Gray
      }
    };
    
    return (
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ 
          width: '20px', 
          height: '20px', 
          border: '2px solid ' + getStatusColor(),
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: '12px',
          backgroundColor: status.completed ? getStatusColor() : 'transparent'
        }}>
          {status.completed && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M5 12L10 17L19 8" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </div>
        <div>{label}</div>
        {status.status === 'processing' && (
          <div style={{ marginLeft: '8px', display: 'flex', alignItems: 'center' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#3b82f6', marginRight: '4px', animation: 'pulse 1.5s infinite' }}></div>
            Processing...
            <style>{`
              @keyframes pulse {
                0% { opacity: 0.4; }
                50% { opacity: 1; }
                100% { opacity: 0.4; }
              }
            `}</style>
          </div>
        )}
      </div>
    );
  };
  
  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '20px' }}>
      <div style={{ 
        background: 'white', 
        borderRadius: '8px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        padding: '20px',
        marginBottom: showViewer ? '30px' : '0'
      }}>
        <h2 style={{ marginTop: 0 }}>PowerPoint Uploader</h2>
        
        <div 
          style={{
            border: '2px dashed #ccc',
            borderRadius: '4px',
            padding: '20px',
            textAlign: 'center',
            marginBottom: '20px',
            cursor: 'pointer'
          }}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <div style={{ marginBottom: '15px' }}>
            <svg width="50" height="50" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 16V4M12 4L8 8M12 4L16 8" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 17L2.621 19.485C2.72915 19.9177 2.97882 20.3018 3.33033 20.5763C3.68184 20.8508 4.11501 21.0001 4.561 21H19.439C19.885 21.0001 20.3182 20.8508 20.6697 20.5763C21.0212 20.3018 21.2708 19.9177 21.379 19.485L22 17" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <p>Drag and drop your PowerPoint file here<br />or click to browse</p>
          <input
            type="file"
            accept=".ppt,.pptx"
            onChange={handleFileChange}
            style={{ display: 'block', width: '100%', marginTop: '10px' }}
          />
        </div>
        
        {file && (
          <div style={{ 
            background: '#f0f9ff', 
            border: '1px solid #bae6fd',
            borderRadius: '4px',
            padding: '10px',
            marginBottom: '20px'
          }}>
            <p style={{ margin: 0 }}><strong>Selected file:</strong> {file.name}</p>
          </div>
        )}
        
        <button 
          onClick={handleUpload}
          disabled={!file || loading}
          style={{
            width: '100%',
            padding: '10px',
            background: !file || loading ? '#ccc' : '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: !file || loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Uploading...' : 'Upload PowerPoint'}
        </button>
        
        {/* Processing Status Section */}
        {uploadedPptId && (
          <div style={{ 
            marginTop: '20px',
            background: '#f9fafb',
            border: '1px solid #e5e7eb',
            borderRadius: '4px',
            padding: '15px'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '15px' }}>Processing Status</h3>
            
            <StatusIndicator status={savingPpt} label="Saving PowerPoint" />
            <StatusIndicator status={extractingScripts} label="Extracting Scripts" />
            <StatusIndicator status={extractingImages} label="Extracting Images" />
            
            {processingComplete && (
              <div style={{ 
                marginTop: '15px',
                padding: '10px',
                background: '#dcfce7',
                borderRadius: '4px',
                color: '#166534'
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ verticalAlign: 'middle', marginRight: '8px' }}>
                  <path d="M22 11.08V12C21.9988 14.1564 21.3005 16.2547 20.0093 17.9818C18.7182 19.709 16.9033 20.9725 14.8354 21.5839C12.7674 22.1953 10.5573 22.1219 8.53447 21.3746C6.51168 20.6273 4.78465 19.2461 3.61096 17.4371C2.43727 15.628 1.87979 13.4881 2.02168 11.3363C2.16356 9.18455 2.99721 7.13631 4.39828 5.49706C5.79935 3.85781 7.69279 2.71537 9.79619 2.24013C11.8996 1.7649 14.1003 1.98232 16.07 2.85999" stroke="#166534" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M22 4L12 14.01L9 11.01" stroke="#166534" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Processing completed successfully!
              </div>
            )}
          </div>
        )}
        
        {message && !uploadedPptId && (
          <div style={{ 
            background: '#dcfce7', 
            border: '1px solid #86efac',
            borderRadius: '4px',
            padding: '10px',
            marginTop: '20px',
            color: '#166534'
          }}>
            {message}
          </div>
        )}
        
        {error && (
          <div style={{ 
            background: '#fee2e2', 
            border: '1px solid #fecaca',
            borderRadius: '4px',
            padding: '10px',
            marginTop: '20px',
            color: '#b91c1c'
          }}>
            {error}
          </div>
        )}
      </div>
      
      {/* PowerPoint Viewer Section */}
      {showViewer && slides.length > 0 && (
        <div className="ppt-viewer" style={{ 
          background: 'white',
          borderRadius: '8px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          padding: '20px'
        }}>
          <h2 style={{ marginTop: 0 }}>PowerPoint Viewer</h2>
          
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
      )}
      
      {/* Slides Loading Indicator */}
      {slidesLoading && (
        <div style={{ 
          background: 'white',
          borderRadius: '8px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          padding: '20px',
          textAlign: 'center'
        }}>
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
      )}
      
      {/* Slides Error Message */}
      {slidesError && (
        <div style={{ 
          background: 'white',
          borderRadius: '8px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          padding: '20px'
        }}>
          <div style={{ 
            background: '#fee2e2', 
            border: '1px solid #fecaca',
            borderRadius: '4px',
            padding: '15px',
            color: '#b91c1c'
          }}>
            {slidesError}
          </div>
        </div>
      )}
    </div>
  );
};

export default PowerPointUploader;