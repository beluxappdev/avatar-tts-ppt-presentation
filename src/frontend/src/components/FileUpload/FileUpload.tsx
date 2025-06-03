import React, { useState, useCallback } from 'react';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  selectedFile: File | null;
  onRemoveFile: () => void;
  accept?: string;
  maxSizeMB?: number;
  isUploading?: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onFileSelect,
  selectedFile,
  onRemoveFile,
  accept = '.pptx,.ppt',
  maxSizeMB = 100,
  isUploading = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const validateFile = (file: File): boolean => {
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-powerpoint'
    ];
    
    if (!validTypes.includes(file.type) && !file.name.match(/\.(pptx|ppt)$/i)) {
      setValidationError('Please select a valid PowerPoint file (.ppt or .pptx)');
      return false;
    }
    
    if (file.size > maxSizeMB * 1024 * 1024) {
      setValidationError(`File size must be less than ${maxSizeMB}MB`);
      return false;
    }
    
    setValidationError(null);
    return true;
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (isUploading) return;
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (validateFile(file)) {
        onFileSelect(file);
      }
    }
  }, [onFileSelect, isUploading, maxSizeMB]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!isUploading) {
      setIsDragging(true);
    }
  }, [isUploading]);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (isUploading) return;
    
    const file = event.target.files?.[0];
    if (file && validateFile(file)) {
      onFileSelect(file);
    }
  };

  const handleRemoveFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemoveFile();
    setValidationError(null);
  };

  return (
    <div>
      <div 
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        style={{
          border: `2px dashed ${isDragging ? '#3b82f6' : selectedFile ? '#10b981' : '#d1d5db'}`,
          borderRadius: '8px',
          padding: '3rem 2rem',
          textAlign: 'center',
          backgroundColor: isDragging ? '#eff6ff' : selectedFile ? '#f0f9ff' : '#fafafa',
          transition: 'all 0.2s ease-in-out',
          cursor: isUploading ? 'not-allowed' : 'pointer',
          opacity: isUploading ? 0.6 : 1,
        }}
        onClick={() => !isUploading && document.getElementById('fileInput')?.click()}
      >
        <input
          id="fileInput"
          type="file"
          accept={accept}
          onChange={handleFileSelect}
          disabled={isUploading}
          style={{ display: 'none' }}
        />
        
        {selectedFile ? (
          <div>
            <div style={{ fontSize: '48px', marginBottom: '1rem' }}>📊</div>
            <h3 style={{ 
              margin: '0 0 0.5rem 0', 
              color: '#1e293b',
              fontSize: '1.25rem'
            }}>
              {selectedFile.name}
            </h3>
            <p style={{ 
              margin: '0 0 1rem 0', 
              color: '#64748b',
              fontSize: '14px'
            }}>
              {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
            </p>
            {!isUploading && (
              <button
                onClick={handleRemoveFile}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#ef4444',
                  cursor: 'pointer',
                  fontSize: '14px',
                  textDecoration: 'underline'
                }}
              >
                Remove file
              </button>
            )}
          </div>
        ) : (
          <div>
            <div style={{ fontSize: '48px', marginBottom: '1rem' }}>
              {isDragging ? '📁' : '☁️'}
            </div>
            <h3 style={{ 
              margin: '0 0 0.5rem 0', 
              color: '#1e293b',
              fontSize: '1.25rem'
            }}>
              {isDragging ? 'Drop your PowerPoint here' : 'Upload PowerPoint'}
            </h3>
            <p style={{ 
              margin: 0, 
              color: '#64748b',
              fontSize: '14px'
            }}>
              {isUploading 
                ? 'Uploading...' 
                : 'Drag and drop your .ppt or .pptx file, or click to browse'
              }
            </p>
          </div>
        )}
      </div>
      
      {validationError && (
        <div style={{
          marginTop: '1rem',
          padding: '12px',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '6px',
          color: '#dc2626',
          fontSize: '14px'
        }}>
          ❌ {validationError}
        </div>
      )}
    </div>
  );
};