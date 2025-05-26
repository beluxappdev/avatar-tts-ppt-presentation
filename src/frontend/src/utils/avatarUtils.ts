import HarryAvatar from '../assets/avatars/harry.png';
import JeffAvatar from '../assets/avatars/jeff.png';
import LisaAvatar from '../assets/avatars/lisa.png';
import LoriAvatar from '../assets/avatars/lori.png';
import MaxAvatar from '../assets/avatars/max.png';
import { EditorSlide } from '../components/SlideList';

export const AVATAR_IMAGE_MAP = {
  Harry: HarryAvatar,
  Jeff: JeffAvatar,
  Lisa: LisaAvatar,
  Lori: LoriAvatar,
  Max: MaxAvatar,
};

export const getAvatarImageUrl = (voice: string): string => {
  if (voice === 'None') return '';
  return AVATAR_IMAGE_MAP[voice as keyof typeof AVATAR_IMAGE_MAP] || '';
};

export const getAvatarStyle = (
  voice: string,
  size: EditorSlide['avatarSize'],
  position: EditorSlide['avatarPosition'],
  isExpanded: boolean
): React.CSSProperties => {
  // If voice is "None", return style with display: none
  if (voice === 'None') {
    return { display: 'none' };
  }

  const style: React.CSSProperties = {
    position: 'absolute',
    objectFit: 'contain',
    transition: 'all 0.3s ease',
    pointerEvents: 'none',
  };

  let baseAvatarWidth: number;
  let baseAvatarHeight: number;
  const baseOffset = 5;

  switch (size) {
    case 'Small':
      baseAvatarWidth = 30;
      baseAvatarHeight = 30;
      break;
    case 'Medium':
      baseAvatarWidth = 50;
      baseAvatarHeight = 50;
      break;
    case 'Large':
      baseAvatarWidth = 70;
      baseAvatarHeight = 70;
      break;
    default:
      baseAvatarWidth = 50; 
      baseAvatarHeight = 50;
  }

  const scaleFactor = isExpanded ? 1 : 1.5; 

  style.width = `${baseAvatarWidth * scaleFactor}px`;
  style.height = `${baseAvatarHeight * scaleFactor}px`;
  const currentOffset = `${baseOffset * scaleFactor}px`;

  switch (position) {
    case 'Left':
      style.left = currentOffset;
      style.bottom = currentOffset;
      break;
    case 'Center':
      style.left = '50%';
      style.bottom = currentOffset;
      style.transform = `translateX(-50%) scale(${scaleFactor})`;
      style.transformOrigin = 'bottom center';
      break;
    case 'Right':
      style.right = currentOffset;
      style.bottom = currentOffset;
      break;
    case 'UpperLeft':
      style.left = currentOffset;
      style.top = currentOffset;
      break;
    case 'UpperCenter':
      style.left = '50%';
      style.top = currentOffset;
      style.transform = `translateX(-50%) scale(${scaleFactor})`;
      style.transformOrigin = 'top center';
      break;
    case 'UpperRight':
      style.right = currentOffset;
      style.top = currentOffset;
      break;
  }
  return style;
};