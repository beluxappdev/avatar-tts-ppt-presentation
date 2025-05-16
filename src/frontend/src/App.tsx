import React from 'react';
import { CssBaseline, Container, ThemeProvider, createTheme, AppBar, Toolbar, Typography, Box } from '@mui/material';
import FileUpload from './components/FileUpload';
import PowerPointViewer from './components/PowerPointViewer';

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
          {/* <PowerPointViewer pptId='b9105836-dee3-4ce3-8400-b2cf094baff8' onBack={console.log}/> */}
        </Box>
      </Container>
    </ThemeProvider>
  );
};

export default App;