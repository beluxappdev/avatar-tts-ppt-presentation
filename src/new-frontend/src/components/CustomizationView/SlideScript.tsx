import React, { useState } from 'react';

interface SlideScriptProps {
  script: string | null;
  onScriptChange: (newScript: string) => void;
}

const SlideScript: React.FC<SlideScriptProps> = ({ script, onScriptChange }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedScript, setEditedScript] = useState(script || '');

  const handleEdit = () => {
    setEditedScript(script || '');
    setIsEditing(true);
  };

  const handleSave = () => {
    onScriptChange(editedScript);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedScript(script || '');
    setIsEditing(false);
  };
  const containerStyle: React.CSSProperties = {
    padding: '1.5rem',
    backgroundColor: '#1976d2',
    color: 'white',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '1.25rem',
    fontWeight: 600,
    marginBottom: '1rem',
    margin: '0 0 1rem 0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  };

  const scriptStyle: React.CSSProperties = {
    fontSize: '1rem',
    lineHeight: '1.6',
    whiteSpace: 'pre-wrap',
    fontFamily: 'inherit',
    margin: 0
  };

  const buttonStyle: React.CSSProperties = {
    padding: '0.5rem 1rem',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    color: 'white',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontWeight: 500
  };

  const textareaStyle: React.CSSProperties = {
    width: '100%',
    minHeight: '120px',
    padding: '0.75rem',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    borderRadius: '4px',
    fontSize: '1rem',
    lineHeight: '1.6',
    fontFamily: 'inherit',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    color: 'white',
    resize: 'vertical'
  };

  const buttonGroupStyle: React.CSSProperties = {
    display: 'flex',
    gap: '0.5rem',
    marginTop: '1rem'
  };

  const saveButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: 'rgba(76, 175, 80, 0.8)',
    borderColor: 'rgba(76, 175, 80, 1)'
  };

  const cancelButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: 'rgba(244, 67, 54, 0.8)',
    borderColor: 'rgba(244, 67, 54, 1)'
  };

  const noScriptStyle: React.CSSProperties = {
    ...scriptStyle,
    fontStyle: 'italic',
    opacity: 0.8
  };

  return (
    <div style={containerStyle}>
      <div style={titleStyle}>
        <span>Slide Script</span>
        {!isEditing && (
          <button style={buttonStyle} onClick={handleEdit}>
            Edit
          </button>
        )}
      </div>
      
      {isEditing ? (
        <>
          <textarea
            style={textareaStyle}
            value={editedScript}
            onChange={(e) => setEditedScript(e.target.value)}
            placeholder="Enter slide script..."
          />
          <div style={buttonGroupStyle}>
            <button style={saveButtonStyle} onClick={handleSave}>
              Save
            </button>
            <button style={cancelButtonStyle} onClick={handleCancel}>
              Cancel
            </button>
          </div>
        </>
      ) : (
        <>
          {script ? (
            <p style={scriptStyle}>{script}</p>
          ) : (
            <p style={noScriptStyle}>No script available for this slide.</p>
          )}
        </>
      )}
    </div>
  );
};

export default SlideScript;