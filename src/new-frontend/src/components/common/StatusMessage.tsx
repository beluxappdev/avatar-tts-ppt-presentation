import React from 'react';

interface StatusMessageProps {
  type: 'success' | 'error';
  message: string;
  onDismiss?: () => void;
}

export const StatusMessage: React.FC<StatusMessageProps> = ({
  type,
  message,
  onDismiss,
}) => {
  const isSuccess = type === 'success';
  
  return (
    <div style={{
      padding: '12px',
      backgroundColor: isSuccess ? '#dcfce7' : '#fef2f2',
      border: `1px solid ${isSuccess ? '#bbf7d0' : '#fecaca'}`,
      borderRadius: '6px',
      color: isSuccess ? '#166534' : '#dc2626',
      fontSize: '14px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    }}>
      <span>
        {isSuccess ? '✅' : '❌'} {message}
      </span>
      {onDismiss && (
        <button
          onClick={onDismiss}
          style={{
            background: 'none',
            border: 'none',
            color: 'inherit',
            cursor: 'pointer',
            fontSize: '16px',
            padding: '0 0 0 8px',
          }}
        >
          ×
        </button>
      )}
    </div>
  );
};
