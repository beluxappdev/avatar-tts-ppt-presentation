import React from 'react';
import {
  Box,
  CardMedia,
  Typography,
  IconButton,
  TextField,
  Collapse,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent
} from '@mui/material';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { EditorSlide } from './SlideEditor';
import { getAvatarImageUrl, getAvatarStyle } from '../utils/avatarUtils';
import { VOICE_OPTIONS, AVATAR_SIZES, AVATAR_POSITIONS } from './SlideEditor';

interface SlideItemProps {
  slide: EditorSlide;
  index: number;
  isExpanded: boolean;
  draggedItemIndex: number | null;
  onDragStart: (e: React.DragEvent<HTMLDivElement>, index: number) => void;
  onDragOver: (e: React.DragEvent<HTMLDivElement>, index: number) => void;
  onDragLeave: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>, index: number) => void;
  onDragEnd: (e: React.DragEvent<HTMLDivElement>) => void;
  onSlideChange: (id: string, field: keyof EditorSlide, value: string) => void;
  onToggleExpand: (id: string) => void;
  onDelete: (id: string) => void;
}

const SlideItem: React.FC<SlideItemProps> = ({
  slide,
  index,
  isExpanded,
  draggedItemIndex,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  onSlideChange,
  onToggleExpand,
  onDelete
}) => {
  return (
    <Box
      sx={{
        p: 2, 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'flex-start', 
        gap: 1,
        opacity: draggedItemIndex === index ? 0.5 : 1,
        transition: 'all 0.2s ease',
        backgroundColor: 'background.paper',
        borderRadius: 1,
        boxShadow: 3,
        '&:hover': {
          backgroundColor: 'rgba(0, 0, 0, 0.02)'
        }
      }}
      onDragOver={(e) => onDragOver(e, index)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, index)}
      onDragEnd={onDragEnd}
    >
      {/* Top row with drag handle, thumbnail, title and control buttons */}
      <Box sx={{ 
        display: 'flex', 
        width: '100%',
        alignItems: 'center', 
        gap: 2 
      }}>
        {/* Drag handle */}
        <Box
          draggable
          onDragStart={(e) => onDragStart(e, index)}
          sx={{
            cursor: 'grab',
            display: 'flex',
            alignItems: 'center',
            padding: '4px',
            borderRadius: '4px',
            '&:hover': {
              backgroundColor: 'rgba(0, 0, 0, 0.05)'
            }
          }}
        >
          <DragIndicatorIcon sx={{ color: 'action.active' }} />
        </Box>
        
        {/* Slide thumbnail with avatar */}
        <Box sx={{ 
          position: 'relative', 
          width: isExpanded ? 200 : 480,
          height: isExpanded ? 112 : 270,
          flexShrink: 0, 
          borderRadius: 1, 
          overflow: 'hidden',
          transition: 'all 0.3s ease',
          boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
          '&:hover': {
            boxShadow: '0 3px 10px rgba(0,0,0,0.2)',
            transform: 'translateY(-2px)',
            filter: 'brightness(1.05)',
          }
        }}>
          <CardMedia
            component="img"
            sx={{ width: '100%', height: '100%'}}
            image={slide.thumbnailUrl}
            alt={slide.title}
          />
          {getAvatarImageUrl(slide.voice) && (
            <img
              src={getAvatarImageUrl(slide.voice)}
              alt={`${slide.voice} avatar`}
              style={getAvatarStyle(slide.avatarSize, slide.avatarPosition, isExpanded)}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          )}
        </Box>
        
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="subtitle1">
            {slide.title} (Index: {slide.index})
          </Typography>
        </Box>
        
        {/* Control buttons */}
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <IconButton 
            size="small" 
            onClick={() => onToggleExpand(slide.id)}
            aria-label={isExpanded ? "Collapse" : "Expand"}
          >
            {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
          <IconButton
            aria-label="delete slide"
            onClick={() => onDelete(slide.id)}
            color="error"
          >
            <DeleteIcon />
          </IconButton>
        </Box>
      </Box>

      {/* Collapsible configuration section */}
      <Collapse in={isExpanded} sx={{ width: '100%' }}>
        <TextField
          className="slide-script-field"
          label="Script"
          multiline
          fullWidth
          variant="outlined"
          size="small"
          value={slide.script || ''}
          onChange={(e) => onSlideChange(slide.id, 'script', e.target.value)}
          onMouseDown={(e) => e.stopPropagation()}
          minRows={3}
          maxRows={5}
          sx={{ mt: 2, mb: 2, userSelect: 'text!important' }}
        />
        
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1, width: '100%' }}>
          {/* Voice selector */}
          <Box sx={{ width: { xs: '100%', sm: 'calc(33.33% - 8px)' } }}>
            <FormControl fullWidth size="small">
              <InputLabel>Voice</InputLabel>
              <Select
                value={slide.voice}
                label="Voice"
                onChange={(e: SelectChangeEvent<string>) =>
                  onSlideChange(slide.id, 'voice', e.target.value)
                }
              >
                {VOICE_OPTIONS.map(voice => (
                  <MenuItem key={voice} value={voice}>{voice}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
          
          {/* Avatar size config */}
          <Box sx={{ width: { xs: '100%', sm: 'calc(33.33% - 8px)' } }}>
            <FormControl fullWidth size="small">
              <InputLabel>Avatar Size</InputLabel>
              <Select
                value={slide.avatarSize}
                label="Avatar Size"
                onChange={(e: SelectChangeEvent<string>) =>
                  onSlideChange(slide.id, 'avatarSize', e.target.value as EditorSlide['avatarSize'])
                }
              >
                {AVATAR_SIZES.map(size => (
                  <MenuItem key={size} value={size}>{size}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
          
          {/* Avatar position config */}
          <Box sx={{ width: { xs: '100%', sm: 'calc(33.33% - 8px)' } }}>
            <FormControl fullWidth size="small">
              <InputLabel>Avatar Position</InputLabel>
              <Select
                value={slide.avatarPosition}
                label="Avatar Position"
                onChange={(e: SelectChangeEvent<string>) =>
                  onSlideChange(slide.id, 'avatarPosition', e.target.value as EditorSlide['avatarPosition'])
                }
              >
                {AVATAR_POSITIONS.map(pos => (
                  <MenuItem key={pos} value={pos}>{pos}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </Box>
      </Collapse>
    </Box>
  );
};

export default SlideItem;