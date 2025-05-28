import React, { useState } from 'react';
import { Box, Button, Typography, Divider, Alert, Dialog, DialogTitle, DialogContent, DialogActions, FormControl, InputLabel, Select, MenuItem, SelectChangeEvent } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import SettingsIcon from '@mui/icons-material/Settings';
import { VOICE_OPTIONS, AVATAR_SIZES, AVATAR_POSITIONS } from './SlideEditor';

interface SlideEditorHeaderProps {
  pptId: string | null;
  slideCount: number;
  excludedCount?: number;
  allExpanded: boolean;
  isProcessing: boolean;
  submitSuccess: boolean;
  submitError: string | null;
  onToggleAllExpansion: () => void;
  onGenerateVideo: () => void;
  onBulkConfigure?: (voice: string, size: string, position: string) => void;
}

const SlideEditorHeader: React.FC<SlideEditorHeaderProps> = ({
  pptId,
  slideCount,
  excludedCount = 0,
  allExpanded,
  isProcessing,
  submitSuccess,
  submitError,
  onToggleAllExpansion,
  onGenerateVideo,
  onBulkConfigure
}) => {
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [bulkVoice, setBulkVoice] = useState<string>(VOICE_OPTIONS[1]);
  const [bulkSize, setBulkSize] = useState<typeof AVATAR_SIZES[number]>(AVATAR_SIZES[1]);
  const [bulkPosition, setBulkPosition] = useState<typeof AVATAR_POSITIONS[number]>(AVATAR_POSITIONS[1]);

  const handleOpenConfigDialog = () => {
    setConfigDialogOpen(true);
  };

  const handleCloseConfigDialog = () => {
    setConfigDialogOpen(false);
  };

  const handleApplyBulkConfig = () => {
    if (onBulkConfigure) {
      onBulkConfigure(bulkVoice, bulkSize, bulkPosition);
    }
    handleCloseConfigDialog();
  };

  return (
    <>
      <Typography variant="h6" sx={{ mb: 1 }}>
        Presentation Editor - {slideCount} slide{slideCount !== 1 ? 's' : ''}
        {excludedCount > 0 && ` (${excludedCount} excluded)`}
      </Typography>

      <Box sx={{ display: 'flex', gap: 2 }}>
        <Button 
          variant="outlined"
          onClick={onToggleAllExpansion}
          startIcon={allExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          sx={{ 
            fontSize: '0.8rem',
            whiteSpace: 'nowrap',
            py: 1
          }}
        >
          {allExpanded ? 'Collapse All' : 'Expand All'}
        </Button>
        <Button
          variant="outlined"
          color="secondary"
          disabled={slideCount === 0}
          onClick={handleOpenConfigDialog}
          startIcon={<SettingsIcon />}
          sx={{ 
            fontSize: '0.8rem',
            whiteSpace: 'nowrap',
            py: 1
          }}
        >
          Configure All
        </Button>
        <Button 
          variant="contained" 
          color="primary"
          disabled={slideCount === 0 || isProcessing}
          onClick={onGenerateVideo}
          sx={{ 
            fontSize: '0.8rem',
            whiteSpace: 'nowrap',
            py: 1
          }}
        >
          {isProcessing ? 'Processing...' : 'Generate Video'}
        </Button>
      </Box>
      
      <Divider sx={{ mb: 2 }} />

      {submitSuccess && (
        <Box sx={{ mb: 2 }}>
          <Alert severity="success">
            Video generation request submitted successfully!
          </Alert>
        </Box>
      )}

      {submitError && (
        <Box sx={{ mb: 2 }}>
          <Alert severity="error">
            Error: {submitError}
          </Alert>
        </Box>
      )}
      
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Drag slides to reorder them. {allExpanded ? 'Use the collapse buttons to focus on slide content.' : 'Use the expand buttons to configure avatar settings.'}
      </Typography>

      {/* Bulk Configuration Dialog */}
      <Dialog open={configDialogOpen} onClose={handleCloseConfigDialog}>
        <DialogTitle>Configure All Slides</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: '300px', mt: 1 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Voice</InputLabel>
              <Select
                value={bulkVoice}
                label="Voice"
                onChange={(e: SelectChangeEvent) => setBulkVoice(e.target.value)}
              >
                {VOICE_OPTIONS.map(voice => (
                  <MenuItem key={voice} value={voice}>{voice}</MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <FormControl fullWidth size="small" disabled={bulkVoice === 'None'}>
              <InputLabel>Avatar Size</InputLabel>
              <Select
                value={bulkVoice === 'None' ? 'Medium' : bulkSize}
                label="Avatar Size"
                onChange={(e: SelectChangeEvent) => setBulkSize(e.target.value as typeof AVATAR_SIZES[number])}
              >
                {AVATAR_SIZES.map(size => (
                  <MenuItem key={size} value={size}>{size}</MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <FormControl fullWidth size="small" disabled={bulkVoice === 'None'}>
              <InputLabel>Avatar Position</InputLabel>
              <Select
                value={bulkVoice === 'None' ? 'Center' : bulkPosition}
                label="Avatar Position"
                onChange={(e: SelectChangeEvent) => setBulkPosition(e.target.value as typeof AVATAR_POSITIONS[number])}
              >
                {AVATAR_POSITIONS.map(pos => (
                  <MenuItem key={pos} value={pos}>{pos}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseConfigDialog}>Cancel</Button>
          <Button onClick={handleApplyBulkConfig} variant="contained" color="primary">Apply to All Slides</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default SlideEditorHeader;