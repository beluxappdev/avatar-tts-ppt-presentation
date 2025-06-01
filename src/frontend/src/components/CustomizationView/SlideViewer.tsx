import React, { useState } from 'react';
import { AvatarPosition, AvatarSize, AvatarType } from '../../types/avatar';

interface Slide {
  index: number;
  blobUrl: string;
  script: string | null;
}

interface SlideAvatarConfig {
  showAvatar: boolean;
  avatarPosition: AvatarPosition;
  avatarSize: AvatarSize;
  avatarType: AvatarType;
}

interface SlideViewerProps {
  slide: Slide;
  avatarConfig: SlideAvatarConfig;
  megAvatar: string;
  harryAvatar: string;
  jeffAvatar: string;
  maxAvatar: string;
  loriAvatar: string;
  isFullscreen?: boolean;
}

const SlideViewer: React.FC<SlideViewerProps> = ({
  slide,
  avatarConfig,
  megAvatar,
  harryAvatar,
  jeffAvatar,
  maxAvatar,
  loriAvatar,
  isFullscreen = false
}) => {
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });

  const handleImageLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    setImageDimensions({
      width: img.offsetWidth,
      height: img.offsetHeight
    });
  };

  const getAvatarImage = (): string => {
    switch (avatarConfig.avatarType) {
      case 'meg':
        return megAvatar;
      case 'harry':
        return harryAvatar;
      case 'jeff':
        return jeffAvatar;
      case 'max':
        return maxAvatar;
      case 'lori':
        return loriAvatar;
      default:
        return megAvatar; // Default to meg if no type is set
    }
  };

  const getAvatarStyle = (): React.CSSProperties => {
    // Size configuration
    let height;
    switch(avatarConfig.avatarSize) {
      case 'small':
        height = '25%';
        break;
      case 'large':
        height = isFullscreen ? '100%' : '75%';
        break;
      case 'medium':
      default:
        height = '50%';
    }

    // Position configuration
    let positionProps: React.CSSProperties = {};
    switch(avatarConfig.avatarPosition) {
      case 'left':
        positionProps = { left: '0%', bottom: '0%' };
        break;
      case 'center':
        positionProps = { left: '50%', bottom: '0%', transform: 'translateX(-50%)' };
        break;
      case 'right':
      default:
        positionProps = { right: '0%', bottom: '0%' };
    }

    return {
      height,
      position: 'absolute',
      ...positionProps,
      objectFit: 'contain' as 'contain',
      zIndex: 10
    };
  };

  const containerStyle: React.CSSProperties = isFullscreen 
    ? { 
        maxWidth: '90%', 
        maxHeight: '90vh',
        objectFit: 'contain'
      }
    : { 
        maxWidth: '100%', 
        maxHeight: '400px',
        objectFit: 'contain'
      };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <img 
        src={slide.blobUrl} 
        alt={`Slide ${slide.index + 1}`} 
        style={containerStyle}
        onLoad={handleImageLoad}
      />
      
      {avatarConfig.showAvatar && imageDimensions.width > 0 && (
        <div 
          style={{ 
            position: 'absolute',
            width: imageDimensions.width,
            height: imageDimensions.height,
            top: 0,
            left: 0
          }}
        >
          <img 
            src={getAvatarImage()}
            alt="Virtual presenter" 
            style={getAvatarStyle()}
          />
        </div>
      )}
    </div>
  );
};

export default SlideViewer;