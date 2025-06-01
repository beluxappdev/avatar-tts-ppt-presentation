import React from 'react';

interface ButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  disabled = false,
  loading = false,
  variant = 'primary',
  size = 'md',
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'secondary':
        return {
          backgroundColor: 'transparent',
          color: '#64748b',
          border: '1px solid #e2e8f0',
        };
      case 'danger':
        return {
          backgroundColor: '#ef4444',
          color: 'white',
          border: 'none',
        };
      default: // primary
        return {
          backgroundColor: disabled || loading ? '#9ca3af' : '#3b82f6',
          color: 'white',
          border: 'none',
        };
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return { padding: '8px 16px', fontSize: '14px' };
      case 'lg':
        return { padding: '16px 32px', fontSize: '18px' };
      default: // md
        return { padding: '12px 24px', fontSize: '16px' };
    }
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        ...getVariantStyles(),
        ...getSizeStyles(),
        borderRadius: '8px',
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        fontWeight: '500',
        transition: 'all 0.2s',
        minWidth: size === 'lg' ? '180px' : size === 'sm' ? '100px' : '140px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
      }}
    >
      {loading && (
        <span style={{ 
          display: 'inline-block', 
          width: '16px', 
          height: '16px', 
          border: '2px solid transparent',
          borderTop: '2px solid currentColor',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></span>
      )}
      {children}
    </button>
  );
};