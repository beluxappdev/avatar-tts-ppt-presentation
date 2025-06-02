import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface SidebarProps {
  isExpanded: boolean;
  onToggle: () => void;
}

interface SidebarSection {
  id: string;
  label: string;
  icon: string;
  path?: string;
  isActive?: boolean;
  isSpecial?: boolean; // For sections that don't navigate
}

export const Sidebar: React.FC<SidebarProps> = ({ isExpanded, onToggle }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [showUserPopup, setShowUserPopup] = useState(false);
  const userPopupRef = useRef<HTMLDivElement>(null);

  const sections: SidebarSection[] = [
    {
      id: 'upload',
      label: 'New PowerPoint',
      icon: '/icons/upload-icon.svg',
      path: '/',
      isActive: location.pathname === '/'
    },
    {
      id: 'powerpoints',
      label: 'PowerPoints',
      icon: '/icons/powerpoint-icon.svg',
      path: '/powerpoints',
      isActive: location.pathname === '/powerpoints'
    },
    {
      id: 'user',
      label: 'User',
      icon: '/icons/user-icon.svg',
      isSpecial: true,
      isActive: showUserPopup
    }
  ];

  const handleNavigation = (section: SidebarSection) => {
    if (section.id === 'user') {
      setShowUserPopup(!showUserPopup);
    } else if (section.path) {
      navigate(section.path);
      setShowUserPopup(false); // Close popup if open
    }
  };

  // Close popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userPopupRef.current && !userPopupRef.current.contains(event.target as Node)) {
        setShowUserPopup(false);
      }
    };

    if (showUserPopup) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showUserPopup]);

  return (
    <div style={{
      width: isExpanded ? '280px' : '80px',
      height: '100vh',
      backgroundColor: '#1e293b',
      color: 'white',
      transition: 'width 0.3s ease-in-out',
      display: 'flex',
      flexDirection: 'column',
      position: 'fixed',
      left: 0,
      top: 0,
      zIndex: 1000,
      boxShadow: '2px 0 10px rgba(0, 0, 0, 0.1)'
    }}>
      {/* Header with toggle button */}
      <div style={{
        padding: '1rem',
        borderBottom: '1px solid #334155',
        display: 'flex',
        alignItems: 'center',
        justifyContent: isExpanded ? 'space-between' : 'center'
      }}>
        {isExpanded && (
          <h2 style={{
            margin: 0,
            fontSize: '1.25rem',
            fontWeight: '600',
            color: '#f1f5f9'
          }}>
            PowerPoint AI
          </h2>
        )}
        <button
          onClick={onToggle}
          style={{
            background: 'none',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            padding: '8px',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background-color 0.2s'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = '#334155';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <span style={{ fontSize: '20px' }}>
            {isExpanded ? '←' : '→'}
          </span>
        </button>
      </div>

      {/* Navigation sections */}
      <nav style={{
        flex: 1,
        padding: '1rem 0',
        position: 'relative'
      }}>
        {sections.map((section) => (
          <div
            key={section.id}
            onClick={() => handleNavigation(section)}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: isExpanded ? '12px 1rem' : '12px',
              margin: '4px 0.5rem',
              borderRadius: '8px',
              cursor: 'pointer',
              backgroundColor: section.isActive ? '#3b82f6' : 'transparent',
              transition: 'all 0.2s ease-in-out',
              justifyContent: isExpanded ? 'flex-start' : 'center',
              position: 'relative'
            }}
            onMouseOver={(e) => {
              if (!section.isActive) {
                e.currentTarget.style.backgroundColor = '#334155';
              }
            }}
            onMouseOut={(e) => {
              if (!section.isActive) {
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
          >
            {/* Icon placeholder - replace with actual image */}
            <div style={{
              width: '24px',
              height: '24px',
              backgroundColor: '#64748b',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              color: 'white',
              flexShrink: 0
            }}>
              {/* Placeholder - replace with: <img src={section.icon} alt={section.label} style={{width: '24px', height: '24px'}} /> */}
              {section.id === 'upload' && '⬆'}
              {section.id === 'powerpoints' && '📊'}
              {section.id === 'videos' && '🎥'}
              {section.id === 'user' && '👤'}
            </div>
            
            {isExpanded && (
              <span style={{
                marginLeft: '12px',
                fontSize: '14px',
                fontWeight: '500',
                whiteSpace: 'nowrap',
                overflow: 'hidden'
              }}>
                {section.label}
              </span>
            )}

            {/* User Popup */}
            {section.id === 'user' && showUserPopup && (
              <div
                ref={userPopupRef}
                style={{
                  position: 'absolute',
                  left: isExpanded ? '100%' : '100%',
                  top: '0',
                  marginLeft: '8px',
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
                  padding: '1rem',
                  minWidth: '250px',
                  zIndex: 2000,
                  color: '#1e293b'
                }}
              >
                {/* Arrow pointing to sidebar */}
                <div style={{
                  position: 'absolute',
                  left: '-6px',
                  top: '20px',
                  width: '12px',
                  height: '12px',
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  borderRight: 'none',
                  borderBottom: 'none',
                  transform: 'rotate(-45deg)'
                }}></div>

                {/* User Info */}
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    marginBottom: '0.75rem'
                  }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      backgroundColor: '#3b82f6',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontWeight: '600',
                      marginRight: '0.75rem'
                    }}>
                      {user?.name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <h4 style={{ 
                        margin: 0, 
                        fontSize: '16px', 
                        fontWeight: '600',
                        color: '#1e293b'
                      }}>
                        {user?.name || 'Unknown User'}
                      </h4>
                      <p style={{ 
                        margin: 0, 
                        fontSize: '14px', 
                        color: '#64748b'
                      }}>
                        {user?.email || 'No email'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Divider */}
                <div style={{
                  height: '1px',
                  backgroundColor: '#e2e8f0',
                  margin: '0.75rem 0'
                }}></div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowUserPopup(false);
                      logout();
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: '8px 12px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      color: '#ef4444',
                      textAlign: 'left',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.backgroundColor = '#fef2f2';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    🚪 Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* Footer - could show user info when expanded */}
      {isExpanded && (
        <div style={{
          padding: '1rem',
          borderTop: '1px solid #334155',
          fontSize: '12px',
          color: '#94a3b8'
        }}>
          © 2025 PowerPoint AI
        </div>
      )}
    </div>
  );
};