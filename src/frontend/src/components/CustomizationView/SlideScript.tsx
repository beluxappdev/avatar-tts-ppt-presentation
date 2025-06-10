import React, { useState } from 'react';

interface SlideScriptProps {
  script: string | null;
  onScriptChange: (newScript: string) => void;
}

const SlideScript: React.FC<SlideScriptProps> = ({ script, onScriptChange }) => {
  const MAX_SCRIPT_LENGTH = 500;
  
  // Truncate script if it exceeds the limit
  const truncateScript = (text: string | null): string => {
    if (!text) return '';
    return text.length > MAX_SCRIPT_LENGTH ? text.substring(0, MAX_SCRIPT_LENGTH) : text;
  };

  const [isEditing, setIsEditing] = useState(false);
  const [editedScript, setEditedScript] = useState(truncateScript(script));

  const handleEdit = () => {
    setEditedScript(truncateScript(script));
    setIsEditing(true);
  };

  const handleSave = () => {
    const finalScript = truncateScript(editedScript);
    onScriptChange(finalScript);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedScript(truncateScript(script));
    setIsEditing(false);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    // Limit input to MAX_SCRIPT_LENGTH characters
    if (newText.length <= MAX_SCRIPT_LENGTH) {
      setEditedScript(newText);
    }
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

  const characterCountStyle: React.CSSProperties = {
    fontSize: '0.875rem',
    opacity: 0.8,
    marginTop: '0.5rem',
    textAlign: 'right' as const
  };

  const truncatedScript = truncateScript(script);
  const wasOriginalTruncated = script && script.length > MAX_SCRIPT_LENGTH;

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
            onChange={handleTextChange}
            placeholder="Enter slide script..."
          />
          <div style={characterCountStyle}>
            {editedScript.length}/{MAX_SCRIPT_LENGTH} characters
          </div>
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
          {truncatedScript ? (
            <>
              <p style={scriptStyle}>{truncatedScript}</p>
              {wasOriginalTruncated && (
                <div style={{ ...characterCountStyle, opacity: 0.6, fontStyle: 'italic' }}>
                  Script was truncated to {MAX_SCRIPT_LENGTH} characters
                </div>
              )}
            </>
          ) : (
            <p style={noScriptStyle}>No script available for this slide.</p>
          )}
        </>
      )}
    </div>
  );
};

export default SlideScript;