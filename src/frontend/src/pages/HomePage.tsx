import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useUpload } from '../hooks/useUpload';
import { FileUpload } from '../components/FileUpload/FileUpload';
import { Button } from '../components/common/Button';
import { StatusMessage } from '../components/common/StatusMessage';
import AIAvatar from '../assets/ai-avatar.png';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { uploadPowerPoint, isUploading, uploadError, uploadSuccess, clearError, clearSuccess } = useUpload();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    clearError();
    clearSuccess();
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    clearError();
    clearSuccess();
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    
    const result = await uploadPowerPoint(selectedFile);
    if (result) {
      setSelectedFile(null);
      console.log('Upload successful:', result);
      navigate(`/status/${result.id}`);
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#f8fafc',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1rem',
    }}>
      <div style={{ maxWidth: '800px', width: '100%' }}>
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '3rem'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem'
          }}>
            <img 
              src={AIAvatar} 
              alt="AI Avatar" 
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                objectFit: 'cover'
              }}
            />
            <h1 style={{ 
              margin: 0, 
              color: '#1e293b',
              fontSize: '2rem',
              fontWeight: '600'
            }}>
              Welcome, {user?.name?.split(' ')[0]}
            </h1>
          </div>
        </div>

        {/* Upload Section */}
        <div style={{ 
          backgroundColor: 'white', 
          borderRadius: '12px',
          padding: '2rem',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          {/* File Requirements Notice */}
          <div style={{
            backgroundColor: '#f1f5f9',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1.5rem'
          }}>
            <h3 style={{
              margin: '0 0 0.5rem 0',
              color: '#475569',
              fontSize: '0.875rem',
              fontWeight: '600',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              File Requirements
            </h3>
            <ul style={{
              margin: 0,
              paddingLeft: '1.25rem',
              color: '#64748b',
              fontSize: '0.875rem',
              lineHeight: '1.5'
            }}>
              <li>Maximum file size: <strong>100 MB</strong></li>
              <li>Maximum slides: <strong>15 slides</strong></li>
              <li>Supported format: PowerPoint (.pptx)</li>
            </ul>
          </div>

          <FileUpload
            onFileSelect={handleFileSelect}
            selectedFile={selectedFile}
            onRemoveFile={handleRemoveFile}
            isUploading={isUploading}
          />

          <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
            <Button
              onClick={handleUpload}
              disabled={!selectedFile}
              loading={isUploading}
              size="lg"
            >
              {isUploading ? 'Uploading...' : 'Upload Presentation'}
            </Button>
          </div>

          {/* Status Messages */}
          {uploadSuccess && (
            <div style={{ marginTop: '1rem' }}>
              <StatusMessage
                type="success"
                message="PowerPoint uploaded successfully!"
                onDismiss={clearSuccess}
              />
            </div>
          )}

          {uploadError && (
            <div style={{ marginTop: '1rem' }}>
              <StatusMessage
                type="error"
                message={uploadError}
                onDismiss={clearError}
              />
            </div>
          )}
        </div>
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