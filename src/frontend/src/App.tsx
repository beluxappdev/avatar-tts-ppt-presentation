import React from 'react';
import { CssBaseline, Container, ThemeProvider, createTheme, AppBar, Toolbar, Typography, Box } from '@mui/material';
import FileUpload from './components/FileUpload';

// theme instance, change later
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

const App: React.FC = () => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppBar 
        position="static" 
        sx={{ 
          height: '40px'
        }}
      >
        <Toolbar 
          sx={{ 
            minHeight: '40px !important',
            paddingTop: '0px',
            paddingBottom: '0px'
          }}
        >
          <Typography 
            variant="subtitle2" 
            sx={{ 
              fontSize: '0.9rem',
              fontWeight: 500
            }}
          >
            Microsoft
          </Typography>
        </Toolbar>
      </AppBar>
      <Container>
        <Box sx={{ my: 4 }}>
          <FileUpload />
        </Box>
      </Container>
    </ThemeProvider>
  );
};

export default App;