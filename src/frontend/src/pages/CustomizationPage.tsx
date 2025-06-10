import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSlides } from '../hooks/useSlides';
import { useVideoGeneration } from '../hooks/useVideoGeneration';
import { useAuth } from '../context/AuthContext';
import SlideViewer from '../components/CustomizationView/SlideViewer';
import AvatarConfiguration from '../components/CustomizationView/AvatarConfiguration';
import SlideNavigation from '../components/CustomizationView/SlideNavigation';
import SlideScript from '../components/CustomizationView/SlideScript';
import FullscreenViewer from '../components/CustomizationView/FullscreenViewer';
import DefaultConfigModal from '../components/CustomizationView/DefaultConfigModal';
import { AvatarPosition, AvatarSize, AvatarType } from '../types/avatar';
import { GenerateVideoRequest, SlideConfig } from '../types/videoGenerationTypes';

// Import your avatar images
import MegBusinessAvatar from '../assets/meg-business-transparent.png';
import HarryBusinessAvatar from '../assets/harry-business-transparent.png';
import JeffBusinessAvatar from '../assets/jeff-business-transparent.png';
import MaxBusinessAvatar from '../assets/max-business-transparent.png';
import LoriCasualAvatar from '../assets/lori-casual-transparent.png';


interface SlideAvatarConfig {
  showAvatar: boolean;
  avatarPosition: AvatarPosition;
  avatarSize: AvatarSize;
  avatarType: AvatarType;
  script: string | null;
  pauseBeforeBeginning: number;
  pauseAfterEnding: number;
}

export const CustomizationPage: React.FC = () => {
  const { pptId } = useParams<{ pptId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { slides, loading, error } = useSlides({ pptId: pptId || '' });
  const { generateVideo: generateVideoRequest, isGenerating, generationError, generationSuccess } = useVideoGeneration();
  
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [showDefaultConfigModal, setShowDefaultConfigModal] = useState(false);
  const [language, setLanguage] = useState<'english' | 'french'>('english');
  
  // Default avatar configuration
  const defaultAvatarConfig: SlideAvatarConfig = {
    showAvatar: true,
    avatarPosition: 'right',
    avatarSize: 'medium',
    avatarType: 'meg',
    script: null,
    pauseBeforeBeginning: 0,
    pauseAfterEnding: 0
  };

  const MAX_SCRIPT_LENGTH = 500;

  const truncateScript = (script: string | null): string | null => {
    if (!script) return null;
    return script.length > MAX_SCRIPT_LENGTH ? script.substring(0, MAX_SCRIPT_LENGTH) : script;
  };
  
  // Store configurations for each slide
  const [slideConfigs, setSlideConfigs] = useState<{[key: number]: SlideAvatarConfig}>({});
  
  // Get current slide configuration (derived from slideConfigs, original slide data, or default)
  const getCurrentConfig = (): SlideAvatarConfig => {
    const storedConfig = slideConfigs[currentSlideIndex];
    const originalSlide = slides[currentSlideIndex];
    
    if (storedConfig) {
      return storedConfig;
    }
    
    // If no stored config, create one from original slide data + defaults
    return {
      ...defaultAvatarConfig,
      script: truncateScript(originalSlide?.script || null)
    };
  };

  const handleBackToHome = () => {
    navigate('/');
  };

  const handlePreviousSlide = () => {
    if (currentSlideIndex > 0) {
      setCurrentSlideIndex(currentSlideIndex - 1);
    }
  };

  const handleNextSlide = () => {
    if (currentSlideIndex < slides.length - 1) {
      setCurrentSlideIndex(currentSlideIndex + 1);
    }
  };

  const handleSlideChange = (slideIndex: number) => {
    setCurrentSlideIndex(slideIndex);
  };

  const handleToggleFullscreen = () => {
    setFullscreen(!fullscreen);
  };

  // Update slide configuration
  const updateSlideConfig = (partialConfig: Partial<SlideAvatarConfig>) => {
    const currentConfig = getCurrentConfig();
    const newConfig = { ...currentConfig, ...partialConfig };
    
    setSlideConfigs(prevConfigs => ({
      ...prevConfigs,
      [currentSlideIndex]: newConfig
    }));
  };

  const updateAvatarConfig = (partialConfig: Partial<SlideAvatarConfig>) => {
    updateSlideConfig(partialConfig);
  };

  // Update script
  const updateScript = (newScript: string) => {
    updateSlideConfig({ script: newScript });
  };

  // Handle default configuration modal
  const handleOpenDefaultConfig = () => {
    setShowDefaultConfigModal(true);
  };

  const handleCloseDefaultConfig = () => {
    setShowDefaultConfigModal(false);
  };

  const handleApplyDefaultConfig = (newDefaults: Omit<SlideAvatarConfig, 'script'>) => {
    // Apply the new defaults to all slides
    const updatedConfigs: {[key: number]: SlideAvatarConfig} = {};
    
    slides.forEach((slide, index) => {
      updatedConfigs[index] = {
        ...newDefaults,
        script: truncateScript(slideConfigs[index]?.script || slide.script)
      };
    });
    
    setSlideConfigs(updatedConfigs);
  };

  // Handle language change
  const handleLanguageChange = (newLanguage: 'english' | 'french') => {
    setLanguage(newLanguage);
  };

  const generateVideo = async () => {
    if (!pptId || !user) {
      console.error('Missing pptId or user information');
      return;
    }

    // Transform slide configurations to match API format
    const slidesConfig: SlideConfig[] = slides.map((slide, index) => {
      const config = slideConfigs[index] || {
        ...defaultAvatarConfig,
        script: truncateScript(slide.script) ?? ''
      };
      
      return {
        index: (index).toString(), // API expects 1-based index as string
        script: truncateScript(config.script || slide.script || ''),
        avatar_config: {
          show_avatar: config.showAvatar,
          avatar_persona: config.avatarType, // Map avatarType to avatar_persona
          avatar_position: config.avatarPosition,
          avatar_size: config.avatarSize,
          pause_before: config.pauseBeforeBeginning,
          pause_after: config.pauseAfterEnding
        }
      };
    });

    const request: GenerateVideoRequest = {
      ppt_id: pptId,
      user_id: user.id,
      language: language,
      slides_config: slidesConfig
    };

    console.log('=== GENERATE VIDEO REQUEST ===');
    console.log('Request payload:', JSON.stringify(request, null, 2));
    console.log('===============================');

    try {
      const result = await generateVideoRequest(request);
      if (result) {
        console.log('=== VIDEO GENERATION SUCCESS ===');
        console.log('Response:', result);
        console.log('Video ID:', result.video_id);
        console.log('================================');
        console.log(`Navigating to /status/powerpoint/${pptId}/video/${result.video_id}`);
        navigate(`/status/powerpoint/${pptId}/video/${result.video_id}`)
        
        // You can add navigation or success handling here
        // For example: navigate to a status page or show a success message
      }
    } catch (error) {
      console.error('Video generation failed:', error);
    }
  };

  if (!pptId) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>Invalid Presentation ID</h2>
        <button onClick={handleBackToHome}>Back to Home</button>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '400px',
        gap: '1rem'
      }}>
        <div style={{ 
          width: '60px', 
          height: '60px', 
          border: '4px solid #f3f3f3',
          borderTop: '4px solid #1976d2',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <h3>Loading slides...</h3>
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
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1rem',
    }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
          <button 
            onClick={handleBackToHome} 
            style={{ 
              marginRight: '1rem',
              padding: '0.5rem',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '1.5rem'
            }}
          >
            ←
          </button>
          <h2>PowerPoint Viewer</h2>
        </div>
        <div style={{ 
          padding: '1rem',
          backgroundColor: '#f8d7da',
          color: '#721c24',
          borderRadius: '4px',
          marginBottom: '1rem'
        }}>
          <strong>Error:</strong> {error}
        </div>
        <div style={{ textAlign: 'center' }}>
          <button 
            onClick={handleBackToHome}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#1976d2',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Back to Upload
          </button>
        </div>
      </div>
    );
  }

  if (!slides || slides.length === 0) {
    return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#f8fafc',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1rem',
    }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
          <button 
            onClick={handleBackToHome} 
            style={{ 
              marginRight: '1rem',
              padding: '0.5rem',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '1.5rem'
            }}
          >
            ←
          </button>
          <h2>PowerPoint Viewer</h2>
        </div>
        <div style={{ 
          padding: '1rem',
          backgroundColor: '#fff3cd',
          color: '#856404',
          borderRadius: '4px',
          marginBottom: '1rem'
        }}>
          <strong>Warning:</strong> No slides were found in this presentation.
        </div>
        <div style={{ textAlign: 'center' }}>
          <button 
            onClick={handleBackToHome}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#1976d2',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Back to Upload
          </button>
        </div>
      </div>
    );
  }

  const currentSlide = slides[currentSlideIndex];
  const currentConfig = getCurrentConfig();

  // Create a slide object with the current script (either modified or original)
  const currentSlideWithScript = {
    ...currentSlide,
    script: truncateScript(currentConfig.script)
  };

  // Fullscreen view
  if (fullscreen) {
    return (
      <FullscreenViewer
        slide={currentSlide}
        avatarConfig={currentConfig}
        megAvatar={MegBusinessAvatar}
        harryAvatar={HarryBusinessAvatar}
        jeffAvatar={JeffBusinessAvatar}
        maxAvatar={MaxBusinessAvatar}
        loriAvatar={LoriCasualAvatar}
        currentSlide={currentSlideIndex}
        totalSlides={slides.length}
        onClose={handleToggleFullscreen}
        onPrevious={handlePreviousSlide}
        onNext={handleNextSlide}
      />
    );
  }

  // Main view styles
  const containerStyle: React.CSSProperties = {
    maxWidth: '1200px',
    margin: '2rem auto',
    padding: '2rem',
    backgroundColor: 'white',
    borderRadius: '8px',
    minHeight: '100vh',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '2rem'
  };

  const backButtonStyle: React.CSSProperties = {
    marginRight: '1rem',
    padding: '0.5rem',
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: '1.5rem'
  };

  const contentStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    gap: '2rem',
    height: '100%', // Take full height of container
    alignItems: 'stretch' // Make columns stretch to full height
  };

  const leftColumnStyle: React.CSSProperties = {
    flex: '1 1 66.66%'
  };

  const rightColumnStyle: React.CSSProperties = {
    flex: '1 1 33.33%'
  };

  const slideContainerStyle: React.CSSProperties = {
    padding: '1.5rem',
    textAlign: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: '8px',
    marginBottom: '1.5rem',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  };

  // Main view render
  return (
    <div style={{ 
      minHeight: '100vh', 
      alignItems: 'center',
      padding: '2rem 1rem',
    }}>
        <div style={containerStyle}>
        <div style={headerStyle}>
            <button onClick={handleBackToHome} style={backButtonStyle}>
            ←
            </button>
            <h2 style={{ color: '#333'}}>PowerPoint Viewer</h2>
        </div>
        <SlideNavigation
            currentSlide={currentSlideIndex}
            totalSlides={slides.length}
            onPrevious={handlePreviousSlide}
            onNext={handleNextSlide}
            onFullscreen={handleToggleFullscreen}
            onSlideChange={handleSlideChange}
        />
      
        <div style={contentStyle}>
            {/* Left Column - Slide Content */}
            <div style={leftColumnStyle}>
            {/* Slide Image */}
            <div style={slideContainerStyle}>
                <SlideViewer
                slide={currentSlideWithScript}
                avatarConfig={currentConfig}
                megAvatar={MegBusinessAvatar}
                jeffAvatar={JeffBusinessAvatar}
                maxAvatar={MaxBusinessAvatar}
                loriAvatar={LoriCasualAvatar}
                harryAvatar={HarryBusinessAvatar}
                />
            </div>
          
            {/* Slide Script */}
            <SlideScript 
              script={currentConfig.script} 
              onScriptChange={updateScript}
            />
            </div>
        
            {/* Right Column - Avatar Configuration */}
            <div style={rightColumnStyle}>
            <AvatarConfiguration
                config={currentConfig}
                onConfigChange={updateAvatarConfig}
                onGenerateVideo={generateVideo}
                onOpenDefaultConfig={handleOpenDefaultConfig}
                isGenerating={isGenerating}
                generationError={generationError}
                generationSuccess={generationSuccess}
                language={language}
                onLanguageChange={handleLanguageChange}
            />
            </div>
        </div>
        
        {/* Default Configuration Modal */}
        <DefaultConfigModal
          isOpen={showDefaultConfigModal}
          onClose={handleCloseDefaultConfig}
          onApply={handleApplyDefaultConfig}
          currentDefaults={{
            showAvatar: defaultAvatarConfig.showAvatar,
            avatarPosition: defaultAvatarConfig.avatarPosition,
            avatarSize: defaultAvatarConfig.avatarSize,
            avatarType: defaultAvatarConfig.avatarType,
            pauseBeforeBeginning: defaultAvatarConfig.pauseBeforeBeginning,
            pauseAfterEnding: defaultAvatarConfig.pauseAfterEnding
          }}
        />
        </div>
    </div>
  );
};