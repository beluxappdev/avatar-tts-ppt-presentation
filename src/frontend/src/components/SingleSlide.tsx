import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  CardMedia,
  Typography,
  IconButton,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
  Card,
  CardContent,
  Divider,
  Collapse
} from '@mui/material';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { EditorSlide } from './SlideEditor';
import { getAvatarImageUrl } from '../utils/avatarUtils';
import { VOICE_OPTIONS, AVATAR_SIZES, AVATAR_POSITIONS } from './SlideEditor';

interface SingleSlideProps {
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
  onDelete: (id: string) => void;
  onToggleExpand: (id: string) => void;
}

const SingleSlide: React.FC<SingleSlideProps> = ({
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
  onDelete,
  onToggleExpand
}) => {
  const [isEditingScript, setIsEditingScript] = useState(false);
  const [scriptDraft, setScriptDraft] = useState(slide.script || '');
  const [slideImageDimensions, setSlideImageDimensions] = useState({ width: 0, height: 0 });
  const imageRef = useRef<HTMLImageElement>(null);

  const handleEditScript = () => {
    setScriptDraft(slide.script || '');
    setIsEditingScript(true);
  };

  const handleSaveScript = () => {
    onSlideChange(slide.id, 'script', scriptDraft);
    setIsEditingScript(false);
  };

  const handleCancelScript = () => {
    setScriptDraft(slide.script || '');
    setIsEditingScript(false);
  };

  // Update dimensions when image loads or when expansion state changes
  const updateImageDimensions = () => {
    if (imageRef.current) {
      setSlideImageDimensions({
        width: imageRef.current.offsetWidth,
        height: imageRef.current.offsetHeight
      });
    }
  };

  // Handle image load
  const handleImageLoad = () => {
    updateImageDimensions();
  };

  // Update dimensions when expanded state changes
  useEffect(() => {
    // Small delay to ensure CSS transitions have completed
    const timer = setTimeout(() => {
      updateImageDimensions();
    }, 300);
    
    return () => clearTimeout(timer);
  }, [isExpanded]);

  // Use ResizeObserver to track dimension changes
  useEffect(() => {
    if (!imageRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      updateImageDimensions();
    });

    resizeObserver.observe(imageRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Get avatar style based on position and size
  const getAvatarStyle = (): React.CSSProperties => {
    let height;
    
    switch(slide.avatarSize) {
      case 'Small':
        height = '25%';
        break;
      case 'Large':
        height = '75%';
        break;
      case 'Medium':
      default:
        height = '50%';
    }

    // Position configuration
    let positionProps: React.CSSProperties = {};
    switch(slide.avatarPosition) {
      case 'Left':
        positionProps = { left: '0%', bottom: '0%' };
        break;
      case 'Center':
        positionProps = { left: '50%', bottom: '0%', transform: 'translateX(-50%)' };
        break;
      case 'Right':
        positionProps = { right: '0%', bottom: '0%' };
        break;
      case 'UpperLeft':
        positionProps = { left: '0%', top: '0%' };
        break;
      case 'UpperCenter':
        positionProps = { left: '50%', top: '0%', transform: 'translateX(-50%)' };
        break;
      case 'UpperRight':
        positionProps = { right: '0%', top: '0%' };
        break;
      default:
        positionProps = { left: '0%', bottom: '0%' };
    }

    return {
      height,
      position: 'absolute',
      ...positionProps,
      objectFit: 'contain' as 'contain',
      zIndex: 10
    };
  };

  return (
    <Card
      sx={{
        opacity: draggedItemIndex === index ? 0.5 : 1,
        transition: 'all 0.3s ease',
        '&:hover': {
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
        },
        borderRadius: 2,
        mb: 2
      }}
      onDragOver={(e) => onDragOver(e, index)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, index)}
      onDragEnd={onDragEnd}
    >
      <CardContent sx={{ p: 3 }}>
        {/* Main row layout */}
        <Box sx={{ 
          display: 'flex', 
          flexDirection: isExpanded ? 'column' : 'row',
          alignItems: isExpanded ? 'stretch' : 'center',
          gap: 3
        }}>
          {/* Top row when expanded, or single row when collapsed */}
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            width: '100%'
          }}>
            {/* Drag handle */}
            <Box
              draggable
              onDragStart={(e) => onDragStart(e, index)}
              sx={{
                cursor: 'grab',
                display: 'flex',
                alignItems: 'center',
                padding: '8px',
                borderRadius: '8px',
                backgroundColor: 'rgba(0, 0, 0, 0.04)',
                '&:hover': {
                  backgroundColor: 'rgba(0, 0, 0, 0.08)'
                },
                '&:active': {
                  cursor: 'grabbing'
                },
                flexShrink: 0
              }}
            >
              <DragIndicatorIcon sx={{ color: 'text.secondary' }} />
            </Box>
            
            {/* Slide preview with avatar overlay */}
            <Box sx={{ 
              position: 'relative', 
              width: isExpanded ? '100%' : 200,
              height: isExpanded ? 'auto' : 112.5,
              maxWidth: isExpanded ? 800 : 200,
              flexShrink: 0,
              borderRadius: 2, 
              overflow: 'hidden',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              transition: 'all 0.3s ease',
              '&:hover': {
                transform: 'translateY(-1px)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
              }
            }}>
              <Box sx={{ position: 'relative', display: 'inline-block' }}>
                <CardMedia
                  component="img"
                  ref={imageRef}
                  sx={{ 
                    width: '100%', 
                    height: isExpanded ? 'auto' : '100%',
                    aspectRatio: isExpanded ? '16/9' : 'unset',
                    objectFit: 'cover'
                  }}
                  image={slide.thumbnailUrl}
                  alt="Slide preview"
                  onLoad={handleImageLoad}
                />
                
                {slide.voice !== 'None' && slideImageDimensions.width > 0 && (
                  <Box 
                    sx={{ 
                      position: 'absolute',
                      width: slideImageDimensions.width,
                      height: slideImageDimensions.height,
                      top: 0,
                      left: 0,
                      pointerEvents: 'none'
                    }}
                  >
                    <img
                      src={getAvatarImageUrl(slide.voice)}
                      alt={`${slide.voice} avatar`}
                      style={getAvatarStyle()}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  </Box>
                )}
              </Box>
            </Box>

            {/* Script preview/edit section - only show in collapsed mode */}
            {!isExpanded && (
              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                {!isEditingScript ? (
                  <Box sx={{
                    p: 2,
                    backgroundColor: 'rgba(0, 0, 0, 0.02)',
                    borderRadius: 2,
                    border: '1px solid rgba(0, 0, 0, 0.08)',
                    minHeight: 80,
                    maxHeight: 80,
                    overflow: 'hidden'
                  }}>
                    {slide.script ? (
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          whiteSpace: 'pre-wrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical'
                        }}
                      >
                        {slide.script}
                      </Typography>
                    ) : (
                      <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                        No script added yet
                      </Typography>
                    )}
                  </Box>
                ) : (
                  <TextField
                    multiline
                    fullWidth
                    variant="outlined"
                    value={scriptDraft}
                    onChange={(e) => setScriptDraft(e.target.value)}
                    minRows={3}
                    maxRows={3}
                    sx={{ 
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2
                      }
                    }}
                    placeholder="Enter your script here..."
                  />
                )}
              </Box>
            )}

            {/* Control buttons */}
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column',
              alignItems: 'center',
              gap: 1,
              flexShrink: 0
            }}>
              <IconButton 
                onClick={() => onToggleExpand(slide.id)}
                sx={{
                  backgroundColor: 'rgba(25, 118, 210, 0.1)',
                  '&:hover': {
                    backgroundColor: 'rgba(25, 118, 210, 0.2)'
                  }
                }}
              >
                {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
              
              {/* Only show edit and delete buttons when collapsed */}
              {!isExpanded && (
                <>
                  <IconButton
                    onClick={() => onDelete(slide.id)}
                    color="error"
                    sx={{
                      backgroundColor: 'rgba(244, 67, 54, 0.1)',
                      '&:hover': {
                        backgroundColor: 'rgba(244, 67, 54, 0.2)'
                      }
                    }}
                  >
                    <DeleteIcon />
                  </IconButton>
                </>
              )}
            </Box>
          </Box>

          {/* Script section - only show in expanded mode */}
          {isExpanded && (
            <Box sx={{ width: '100%' }}>
              <Box sx={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                mb: 2
              }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Script
                </Typography>
                
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  {!isEditingScript ? (
                    <Button
                      startIcon={<EditIcon />}
                      onClick={handleEditScript}
                      variant="outlined"
                      size="small"
                      sx={{ borderRadius: 2 }}
                    >
                      Edit
                    </Button>
                  ) : (
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        startIcon={<CancelIcon />}
                        onClick={handleCancelScript}
                        variant="outlined"
                        size="small"
                        sx={{ borderRadius: 2 }}
                      >
                        Cancel
                      </Button>
                      <Button
                        startIcon={<SaveIcon />}
                        onClick={handleSaveScript}
                        variant="contained"
                        size="small"
                        sx={{ borderRadius: 2 }}
                      >
                        Save
                      </Button>
                    </Box>
                  )}
                  
                  <IconButton
                    onClick={() => onDelete(slide.id)}
                    color="error"
                    sx={{
                      backgroundColor: 'rgba(244, 67, 54, 0.1)',
                      '&:hover': {
                        backgroundColor: 'rgba(244, 67, 54, 0.2)'
                      }
                    }}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Box>
              </Box>
              
              {!isEditingScript ? (
                <Box sx={{
                  p: 3,
                  backgroundColor: 'rgba(0, 0, 0, 0.02)',
                  borderRadius: 2,
                  border: '1px solid rgba(0, 0, 0, 0.08)',
                  minHeight: 120
                }}>
                  {slide.script ? (
                    <Typography 
                      variant="body1" 
                      sx={{ 
                        whiteSpace: 'pre-wrap',
                        lineHeight: 1.6
                      }}
                    >
                      {slide.script}
                    </Typography>
                  ) : (
                    <Typography variant="body1" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                      No script added yet. Click Edit Script to add one.
                    </Typography>
                  )}
                </Box>
              ) : (
                <TextField
                  multiline
                  fullWidth
                  variant="outlined"
                  value={scriptDraft}
                  onChange={(e) => setScriptDraft(e.target.value)}
                  minRows={6}
                  maxRows={12}
                  sx={{ 
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2
                    }
                  }}
                  placeholder="Enter your script here..."
                />
              )}
            </Box>
          )}
        </Box>

        {/* Collapsible configuration section */}
        <Collapse in={isExpanded}>
          <Divider sx={{ my: 3 }} />
          
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
            Avatar Configuration
          </Typography>
          
          <Box sx={{ 
            display: 'grid', 
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
            gap: 2
          }}>
            {/* Voice selector */}
            <FormControl size="small">
              <InputLabel>Voice</InputLabel>
              <Select
                value={slide.voice}
                label="Voice"
                onChange={(e: SelectChangeEvent<string>) =>
                  onSlideChange(slide.id, 'voice', e.target.value)
                }
                sx={{ borderRadius: 2 }}
              >
                {VOICE_OPTIONS.map(voice => (
                  <MenuItem key={voice} value={voice}>{voice}</MenuItem>
                ))}
              </Select>
            </FormControl>
            
            {/* Avatar size */}
            <FormControl size="small" disabled={slide.voice === 'None'}>
              <InputLabel>Size</InputLabel>
              <Select
                value={slide.voice === 'None' ? 'Medium' : slide.avatarSize}
                label="Size"
                onChange={(e: SelectChangeEvent<string>) =>
                  onSlideChange(slide.id, 'avatarSize', e.target.value as EditorSlide['avatarSize'])
                }
                sx={{ borderRadius: 2 }}
              >
                {AVATAR_SIZES.map(size => (
                  <MenuItem key={size} value={size}>{size}</MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Avatar position */}
            <FormControl size="small" disabled={slide.voice === 'None'}>
              <InputLabel>Position</InputLabel>
              <Select
                value={slide.voice === 'None' ? 'Center' : slide.avatarPosition}
                label="Position"
                onChange={(e: SelectChangeEvent<string>) =>
                  onSlideChange(slide.id, 'avatarPosition', e.target.value as EditorSlide['avatarPosition'])
                }
                sx={{ borderRadius: 2 }}
              >
                {AVATAR_POSITIONS.map(pos => (
                  <MenuItem key={pos} value={pos}>{pos}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </Collapse>
      </CardContent>
    </Card>
  );
};

export default SingleSlide;