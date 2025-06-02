import React from 'react';

interface StatusBadgeProps {
  status: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const getStatusBadgeStyle = (status: string) => {
    const baseStyle = {
      padding: '4px 8px',
      borderRadius: '12px',
      fontSize: '12px',
      fontWeight: '500',
      textTransform: 'uppercase' as const,
      letterSpacing: '0.5px'
    };

    if (status === 'Completed') {
      return {
        ...baseStyle,
        backgroundColor: '#dcfce7',
        color: '#166534'
      };
    } else if (status === 'Processing') {
      return {
        ...baseStyle,
        backgroundColor: '#fef3c7',
        color: '#92400e'
      };
    } else {
      return {
        ...baseStyle,
        backgroundColor: '#f3f4f6',
        color: '#374151'
      };
    }
  };

  return (
    <span style={getStatusBadgeStyle(status)}>
      {status}
    </span>
  );
};