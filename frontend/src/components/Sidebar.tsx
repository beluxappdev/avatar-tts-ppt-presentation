import React, { useState, useEffect } from 'react';
import { Box, Typography, List, ListItemButton, ListItemText, Divider, IconButton } from '@mui/material';
import KeyboardArrowLeftIcon from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import AddIcon from '@mui/icons-material/Add';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';

interface SidebarProps {
  username?: string;
  recentPresentations?: Array<{ id: string; name: string }>;
  onNewPresentation: () => void;
  onSelectPresentation?: (id: string) => void;
  onSidebarToggle?: (isOpen: boolean) => void;
  initialOpen?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  username = 'Andras', 
  recentPresentations = [],
  onNewPresentation,
  onSelectPresentation,
  onSidebarToggle,
  initialOpen = true
}) => {
  const [isOpen, setIsOpen] = useState(initialOpen);
  const [isHovering, setIsHovering] = useState(false);

  const toggleSidebar = () => {
    const newState = !isOpen;
    setIsOpen(newState);
    if (onSidebarToggle) {
      onSidebarToggle(newState);
    }
  };

  useEffect(() => {
    if (onSidebarToggle) {
      onSidebarToggle(isOpen);
    }
  }, []);

  const SidebarIcon = () => (
    <Box sx={{ 
      width: 24, 
      height: 24, 
      border: '2px solid #aaa', 
      borderRadius: '2px',
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <Box sx={{ 
        height: '100%', 
        width: '40%', 
        borderRight: '2px solid #aaa',
      }} />
    </Box>
  );

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        height: '100vh',
        width: isOpen ? '280px' : '60px',
        backgroundColor: '#1e1e1e',
        color: 'white',
        transition: 'width 0.15s ease',
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid #333',
        zIndex: 1200,
        overflow: 'hidden',
      }}
    >
      {/* Top section - Toggle button */}
      <Box sx={{ 
        p: 2, 
        display: 'flex',
        justifyContent: isOpen ? 'flex-start' : 'center',
      }}>
        <IconButton 
          onClick={toggleSidebar}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
          sx={{ 
            color: 'white',
            padding: '8px',
            borderRadius: '6px',
            position: 'relative',
            width: 40,
            height: 40,
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
            },
            transition: 'background-color 0.2s ease',
          }}
        >
          {/* Left arrow when sidebar is open */}
          <Box sx={{ 
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            opacity: isOpen ? 1 : 0,
            transition: 'opacity 0.2s ease',
            display: 'flex',
          }}>
            <KeyboardArrowLeftIcon />
          </Box>
          
          {/* Right arrow when hovering over closed sidebar */}
          <Box sx={{ 
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            opacity: !isOpen && isHovering ? 1 : 0,
            transition: 'opacity 0.2s ease',
            display: 'flex',
          }}>
            <KeyboardArrowRightIcon />
          </Box>
          
          {/* Icon when sidebar is closed and not hovering */}
          <Box sx={{ 
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            opacity: !isOpen && !isHovering ? 1 : 0,
            transition: 'opacity 0.2s ease',
            display: 'flex',
          }}>
            <SidebarIcon />
          </Box>
        </IconButton>
        {isOpen && (
          <Typography 
            sx={{ 
              ml: 1, 
              alignSelf: 'center', 
              fontFamily: '"Fira Mono", monospace',
              fontWeight: 'bold'
            }}
          >
            Microsoft
          </Typography>
        )}
      </Box>
      
      {/* New Presentation */}
      <Box 
        sx={{ 
          px: isOpen ? 2 : 1, 
          py: 1,
          display: 'flex',
          justifyContent: isOpen ? 'flex-start' : 'center',
          alignItems: 'center',
          cursor: 'pointer',
          borderRadius: '20px',
          mx: isOpen ? 1 : 'auto',
          transition: 'background-color 0.2s ease-in-out',
          '&:hover': {
            backgroundColor: 'rgba(66, 133, 244, 0.15)',
          }
        }}
        onClick={onNewPresentation}
      >
        <IconButton
          sx={{
            backgroundColor: '#643dff',
            '&:hover': {
              backgroundColor: '#5235cc',
            },
            boxShadow: '0px 2px 4px rgba(0,0,0,0.2)'
          }}
        >
          <AddIcon sx={{ color: 'white' }} />
        </IconButton>
        {isOpen && 
          <Typography sx={{ 
            ml: 2, 
            alignSelf: 'center', 
            fontFamily: '"Fira Mono", monospace',
            whiteSpace: 'nowrap'
          }}>
            New Presentation
          </Typography>
        }
      </Box>
      
      {/* User Profile */}
      <Box sx={{ marginTop: 'auto' }}>
        <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
        <Box 
          sx={{ 
            p: 2, 
            display: 'flex', 
            alignItems: 'center',
          }}
        >
          <AccountCircleIcon sx={{ mr: isOpen ? 1 : 0 }} />
          {isOpen && (
            <Box sx={{ ml: 1 }}>
              <Typography variant="body2" sx={{ 
                fontFamily: '"Fira Mono", monospace',
                whiteSpace: 'nowrap'
              }}>
                {username}
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default Sidebar;