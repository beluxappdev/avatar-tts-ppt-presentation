import React, { useState } from 'react';
import { CssBaseline, Container, ThemeProvider, createTheme, AppBar, Toolbar, Typography, Box, Button } from '@mui/material';
import FileUpload from './components/FileUpload';
import SlideEditor from './components/SlideEditor';

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
  const [showSlideEditor, setShowSlideEditor] = useState(false);
  const [fileId, setFileId] = useState<string | null>(null); // will pass to slide editor

  // called after succ file upload
  const handleFileUploaded = (uploadedFileId: string) => {
    setFileId(uploadedFileId);
    setShowSlideEditor(true);
  };

  const handleBackToUpload = () => {
    setShowSlideEditor(false);
  };

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
            paddingBottom: '0px',
            display: 'flex',
            justifyContent: 'space-between'
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
          
          {showSlideEditor && (
            <Button 
              color="inherit" 
              size="small" 
              onClick={handleBackToUpload}
            >
              Back to Upload
            </Button>
          )}
        </Toolbar>
      </AppBar>
      <Container>
        <Box sx={{ my: 4 }}>
          {!showSlideEditor ? (
            <FileUpload onFileUploaded={handleFileUploaded} />
          ) : (
            <SlideEditor />
          )}
        </Box>
      </Container>
    </ThemeProvider>
  );
};

export default App;