import React from 'react';
import { AppBar, Toolbar, Typography, Button } from '@mui/material';

interface AppHeaderProps {
  showBackButton: boolean;
  onBackClick: () => void;
}

const AppHeader: React.FC<AppHeaderProps> = ({ showBackButton, onBackClick }) => {
  return (
    <AppBar position="static" sx={{ height: '40px' }}>
      <Toolbar sx={{
        minHeight: '40px !important',
        py: 0,
        display: 'flex',
        justifyContent: 'space-between'
      }}>
        <Typography variant="subtitle2" sx={{ fontSize: '0.9rem', fontWeight: 500 }}>
          Microsoft
        </Typography>
        
        {showBackButton && (
          <Button color="inherit" size="small" onClick={onBackClick}>
            Back to Upload
          </Button>
        )}
      </Toolbar>
    </AppBar>
  );
};

export default AppHeader;