import React from 'react';
import { AvatarPosition, AvatarSize, AvatarType } from '../../types/avatar'


interface SlideAvatarConfig {
  showAvatar: boolean;
  avatarPosition: AvatarPosition;
  avatarSize: AvatarSize;
  avatarType: AvatarType;
  pauseBeforeBeginning: number;
  pauseAfterEnding: number;
}

interface AvatarConfigurationProps {
  config: SlideAvatarConfig;
  onConfigChange: (partialConfig: Partial<SlideAvatarConfig>) => void;
  onGenerateVideo?: () => void;
  onOpenDefaultConfig?: () => void;
  isGenerating?: boolean;
  generationError?: string | null;
  generationSuccess?: boolean;
  language?: 'english' | 'french';
  onLanguageChange?: (language: 'english' | 'french') => void;
}

const AvatarConfiguration: React.FC<AvatarConfigurationProps> = ({
  config,
  onConfigChange,
  onGenerateVideo,
  onOpenDefaultConfig,
  isGenerating = false,
  generationError = null,
  generationSuccess = false,
  language = 'english',
  onLanguageChange
}) => {
  const handleToggleAvatar = () => {
    onConfigChange({ showAvatar: !config.showAvatar });
  };

  const handlePositionChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    onConfigChange({ avatarPosition: event.target.value as AvatarPosition });
  };

  const handleSizeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    onConfigChange({ avatarSize: event.target.value as AvatarSize });
  };

  const handleAvatarTypeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    onConfigChange({ avatarType: event.target.value as AvatarType });
  };

  const handleLanguageChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    if (onLanguageChange) {
      onLanguageChange(event.target.value as 'english' | 'french');
    }
  };

  const handlePauseBeforeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(event.target.value) || 0;
    onConfigChange({ pauseBeforeBeginning: Math.max(0, value) });
  };

  const handlePauseAfterChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(event.target.value) || 0;
    onConfigChange({ pauseAfterEnding: Math.max(0, value) });
  };

  const containerStyle: React.CSSProperties = {
    padding: '1.5rem',
    backgroundColor: '#f5f5f5',
    borderRadius: '8px',
    height: '100%',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '1.5rem',
    fontSize: '1.25rem',
    fontWeight: 600,
    color: '#333' // Dark text for white background
  };

  const buttonStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.75rem',
    marginBottom: '1.5rem',
    backgroundColor: config.showAvatar ? '#1976d2' : '#666',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: 500
  };

  const formGroupStyle: React.CSSProperties = {
    marginBottom: '1.5rem'
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: '0.5rem',
    fontWeight: 500,
    color: '#333'
  };

  const selectStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.5rem',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '1rem',
    backgroundColor: config.showAvatar ? 'white' : '#f5f5f5',
    cursor: config.showAvatar ? 'pointer' : 'not-allowed',
    color: '#333' // Dark text for readability
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.5rem',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '1rem',
    backgroundColor: 'white',
    color: '#333',
    textAlign: 'center'
  };

  const inputContainerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem'
  };

  const unitsStyle: React.CSSProperties = {
    fontSize: '0.9rem',
    color: '#666',
    fontWeight: 400,
    minWidth: '60px'
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <span style={{ marginRight: '0.5rem' }}>⚙️</span>
        Avatar Configuration
      </div>
      
      {/* Language Selection - Global Setting */}
      <div style={formGroupStyle}>
        <label style={labelStyle} htmlFor="language-select">
          🌐 Language
        </label>
        <select
          id="language-select"
          style={{
            ...selectStyle,
            backgroundColor: 'white',
            cursor: 'pointer',
            fontWeight: 500
          }}
          value={language}
          onChange={handleLanguageChange}
        >
          <option value="english">English</option>
          <option value="french">Français</option>
        </select>
      </div>
      
      <div style={formGroupStyle}>
        <button 
          style={buttonStyle}
          onClick={handleToggleAvatar}
        >
          {config.showAvatar ? "Hide Avatar" : "Show Avatar"}
        </button>
      </div>
      
      <div style={formGroupStyle}>
        <label style={labelStyle} htmlFor="avatar-type">
          Avatar
        </label>
        <select
          id="avatar-type"
          style={selectStyle}
          value={config.avatarType}
          onChange={handleAvatarTypeChange}
          disabled={!config.showAvatar}
        >
          <option value="meg">Meg</option>
          <option value="harry">Harry</option>
          <option value="jeff">Jeff</option>
          <option value="max">Max</option>
          <option value="lori">Lori</option>
        </select>
      </div>
      
      <div style={formGroupStyle}>
        <label style={labelStyle} htmlFor="avatar-position">
          Position
        </label>
        <select
          id="avatar-position"
          style={selectStyle}
          value={config.avatarPosition}
          onChange={handlePositionChange}
          disabled={!config.showAvatar}
        >
          <option value="left">Left</option>
          <option value="center">Center</option>
          <option value="right">Right</option>
        </select>
      </div>
      
      <div style={formGroupStyle}>
        <label style={labelStyle} htmlFor="avatar-size">
          Size
        </label>
        <select
          id="avatar-size"
          style={selectStyle}
          value={config.avatarSize}
          onChange={handleSizeChange}
          disabled={!config.showAvatar}
        >
          <option value="small">Small</option>
          <option value="medium">Medium</option>
          <option value="large">Large</option>
        </select>
      </div>

      <div style={formGroupStyle}>
        <label style={labelStyle} htmlFor="pause-before">
          Pause before beginning
        </label>
        <div style={inputContainerStyle}>
          <input
            id="pause-before"
            type="number"
            min="0"
            step="1"
            style={inputStyle}
            value={config.pauseBeforeBeginning}
            onChange={handlePauseBeforeChange}
          />
          <span style={unitsStyle}>seconds</span>
        </div>
      </div>

      <div style={formGroupStyle}>
        <label style={labelStyle} htmlFor="pause-after">
          Pause after ending
        </label>
        <div style={inputContainerStyle}>
          <input
            id="pause-after"
            type="number"
            min="0"
            step="1"
            style={inputStyle}
            value={config.pauseAfterEnding}
            onChange={handlePauseAfterChange}
          />
          <span style={unitsStyle}>seconds</span>
        </div>
      </div>
      
      {/* Error/Success Messages */}
      {generationError && (
        <div style={{
          padding: '0.75rem',
          backgroundColor: '#fee2e2',
          color: '#dc2626',
          borderRadius: '4px',
          marginBottom: '1rem',
          fontSize: '0.9rem',
          border: '1px solid #fecaca'
        }}>
          <strong>Error:</strong> {generationError}
        </div>
      )}
      
      {generationSuccess && (
        <div style={{
          padding: '0.75rem',
          backgroundColor: '#dcfce7',
          color: '#16a34a',
          borderRadius: '4px',
          marginBottom: '1rem',
          fontSize: '0.9rem',
          border: '1px solid #bbf7d0'
        }}>
          <strong>Success:</strong> Video generation started successfully!
        </div>
      )}

      {/* Default Config Section */}
      <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
        <button
          onClick={onOpenDefaultConfig}
          disabled={isGenerating}
          style={{
            width: '100%',
            padding: '0.75rem 1rem',
            backgroundColor: isGenerating ? '#9ca3af' : '#f59e0b',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '1rem',
            fontWeight: 500,
            cursor: isGenerating ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
            opacity: isGenerating ? 0.6 : 1
          }}
          onMouseOver={(e) => {
            if (!isGenerating) {
              e.currentTarget.style.backgroundColor = '#d97706';
            }
          }}
          onMouseOut={(e) => {
            if (!isGenerating) {
              e.currentTarget.style.backgroundColor = '#f59e0b';
            }
          }}
        >
          ⚙️ Change Default Configuration
        </button>
      </div>

      {/* Generate Video Section */}
      <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
        <button
          onClick={onGenerateVideo}
          disabled={isGenerating}
          style={{
            padding: '1rem 2rem',
            backgroundColor: isGenerating ? '#9ca3af' : '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '1.1rem',
            fontWeight: 600,
            cursor: isGenerating ? 'not-allowed' : 'pointer',
            boxShadow: isGenerating ? 'none' : '0 4px 8px rgba(76, 175, 80, 0.3)',
            transition: 'all 0.2s ease',
            opacity: isGenerating ? 0.6 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            margin: '0 auto'
          }}
          onMouseOver={(e) => {
            if (!isGenerating) {
              e.currentTarget.style.backgroundColor = '#45a049';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }
          }}
          onMouseOut={(e) => {
            if (!isGenerating) {
              e.currentTarget.style.backgroundColor = '#4CAF50';
              e.currentTarget.style.transform = 'translateY(0)';
            }
          }}
        >
          {isGenerating ? (
            <>
              <div style={{
                width: '20px',
                height: '20px',
                border: '2px solid #ffffff',
                borderTop: '2px solid transparent',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
              Generating Video...
            </>
          ) : (
            <>
              🎬 Generate Video
            </>
          )}
        </button>
        
        {isGenerating && (
          <div style={{
            marginTop: '0.5rem',
            fontSize: '0.9rem',
            color: '#666',
            fontStyle: 'italic'
          }}>
            This may take a few minutes...
          </div>
        )}
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

export default AvatarConfiguration;