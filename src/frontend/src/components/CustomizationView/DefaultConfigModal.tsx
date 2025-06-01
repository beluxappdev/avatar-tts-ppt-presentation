import React, { useState } from 'react';
import { AvatarPosition, AvatarSize, AvatarType } from '../../types/avatar';

interface SlideAvatarConfig {
  showAvatar: boolean;
  avatarPosition: AvatarPosition;
  avatarSize: AvatarSize;
  avatarType: AvatarType;
  pauseBeforeBeginning: number;
  pauseAfterEnding: number;
}

interface DefaultConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (config: Omit<SlideAvatarConfig, 'script'>) => void;
  currentDefaults: Omit<SlideAvatarConfig, 'script'>;
}

const DefaultConfigModal: React.FC<DefaultConfigModalProps> = ({
  isOpen,
  onClose,
  onApply,
  currentDefaults
}) => {
  const [config, setConfig] = useState<Omit<SlideAvatarConfig, 'script'>>(currentDefaults);

  // Update local state when modal opens with current defaults
  React.useEffect(() => {
    if (isOpen) {
      setConfig(currentDefaults);
    }
  }, [isOpen, currentDefaults]);

  const handleConfigChange = (partialConfig: Partial<Omit<SlideAvatarConfig, 'script'>>) => {
    setConfig(prevConfig => ({ ...prevConfig, ...partialConfig }));
  };

  const handleApply = () => {
    onApply(config);
    onClose();
  };

  const handleCancel = () => {
    setConfig(currentDefaults); // Reset to original values
    onClose();
  };

  if (!isOpen) return null;

  // Modal overlay styles
  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  };

  const modalStyle: React.CSSProperties = {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '2rem',
    maxWidth: '500px',
    width: '90%',
    maxHeight: '80vh',
    overflowY: 'auto',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
  };

  const headerStyle: React.CSSProperties = {
    fontSize: '1.5rem',
    fontWeight: 600,
    color: '#333',
    marginBottom: '1.5rem',
    textAlign: 'center'
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
    color: '#333'
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

  const checkboxContainerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '1.5rem'
  };

  const checkboxStyle: React.CSSProperties = {
    width: '18px',
    height: '18px',
    cursor: 'pointer'
  };

  const checkboxLabelStyle: React.CSSProperties = {
    fontWeight: 500,
    color: '#333',
    cursor: 'pointer'
  };

  const buttonContainerStyle: React.CSSProperties = {
    display: 'flex',
    gap: '1rem',
    justifyContent: 'flex-end',
    marginTop: '2rem'
  };

  const buttonBaseStyle: React.CSSProperties = {
    padding: '0.75rem 1.5rem',
    border: 'none',
    borderRadius: '6px',
    fontSize: '1rem',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  };

  const cancelButtonStyle: React.CSSProperties = {
    ...buttonBaseStyle,
    backgroundColor: '#6b7280',
    color: 'white'
  };

  const applyButtonStyle: React.CSSProperties = {
    ...buttonBaseStyle,
    backgroundColor: '#1976d2',
    color: 'white'
  };

  return (
    <div style={overlayStyle} onClick={handleCancel}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <h3 style={headerStyle}>Default Configuration for All Slides</h3>
        
        <div style={checkboxContainerStyle}>
          <input
            type="checkbox"
            id="show-avatar-default"
            style={checkboxStyle}
            checked={config.showAvatar}
            onChange={(e) => handleConfigChange({ showAvatar: e.target.checked })}
          />
          <label htmlFor="show-avatar-default" style={checkboxLabelStyle}>
            Show Avatar
          </label>
        </div>
        
        <div style={formGroupStyle}>
          <label style={labelStyle} htmlFor="avatar-type-default">
            Avatar
          </label>
          <select
            id="avatar-type-default"
            style={selectStyle}
            value={config.avatarType}
            onChange={(e) => handleConfigChange({ avatarType: e.target.value as AvatarType })}
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
          <label style={labelStyle} htmlFor="avatar-position-default">
            Position
          </label>
          <select
            id="avatar-position-default"
            style={selectStyle}
            value={config.avatarPosition}
            onChange={(e) => handleConfigChange({ avatarPosition: e.target.value as AvatarPosition })}
            disabled={!config.showAvatar}
          >
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </div>
        
        <div style={formGroupStyle}>
          <label style={labelStyle} htmlFor="avatar-size-default">
            Size
          </label>
          <select
            id="avatar-size-default"
            style={selectStyle}
            value={config.avatarSize}
            onChange={(e) => handleConfigChange({ avatarSize: e.target.value as AvatarSize })}
            disabled={!config.showAvatar}
          >
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
          </select>
        </div>

        <div style={formGroupStyle}>
          <label style={labelStyle} htmlFor="pause-before-default">
            Pause before beginning
          </label>
          <div style={inputContainerStyle}>
            <input
              id="pause-before-default"
              type="number"
              min="0"
              step="1"
              style={inputStyle}
              value={config.pauseBeforeBeginning}
              onChange={(e) => {
                const value = parseInt(e.target.value) || 0;
                handleConfigChange({ pauseBeforeBeginning: Math.max(0, value) });
              }}
            />
            <span style={unitsStyle}>seconds</span>
          </div>
        </div>

        <div style={formGroupStyle}>
          <label style={labelStyle} htmlFor="pause-after-default">
            Pause after ending
          </label>
          <div style={inputContainerStyle}>
            <input
              id="pause-after-default"
              type="number"
              min="0"
              step="1"
              style={inputStyle}
              value={config.pauseAfterEnding}
              onChange={(e) => {
                const value = parseInt(e.target.value) || 0;
                handleConfigChange({ pauseAfterEnding: Math.max(0, value) });
              }}
            />
            <span style={unitsStyle}>seconds</span>
          </div>
        </div>

        <div style={buttonContainerStyle}>
          <button
            style={cancelButtonStyle}
            onClick={handleCancel}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#4b5563';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#6b7280';
            }}
          >
            Cancel
          </button>
          <button
            style={applyButtonStyle}
            onClick={handleApply}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#1565c0';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#1976d2';
            }}
          >
            Apply to All Slides
          </button>
        </div>
      </div>
    </div>
  );
};

export default DefaultConfigModal;