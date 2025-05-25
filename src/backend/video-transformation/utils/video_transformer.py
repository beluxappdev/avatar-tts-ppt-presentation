from moviepy import VideoFileClip, ImageClip, CompositeVideoClip, vfx # type: ignore
from typing import Tuple, Union
import os
import logging


class VideoTransformer:
    """
    A class to transform avatar videos by compositing them with backgrounds
    and applying position and size transformations.
    """
    
    # Size multipliers for different sizes
    SIZE_MULTIPLIERS = {
        "small": 0.25,
        "medium": 0.5,
        "large": 0.75,
        "full": 1.0
    }
    
    def __init__(self, logger: logging.Logger = None):
        """
        Initialize the VideoTransformer.
        
        Args:
            logger: Optional logger instance. If None, creates a default logger.
        """
        self.logger = logger or self._create_default_logger()
        self.avatar_video = None
        self.background = None
        self.final_video = None
    
    def _create_default_logger(self) -> logging.Logger:
        """Create a default logger for the class."""
        logger = logging.getLogger(self.__class__.__name__)
        if not logger.handlers:
            handler = logging.StreamHandler()
            formatter = logging.Formatter(
                '[%(asctime)s] %(name)s - %(levelname)s - %(message)s'
            )
            handler.setFormatter(formatter)
            logger.addHandler(handler)
            logger.setLevel(logging.INFO)
        return logger
    
    def load_avatar_video(self, video_path: str) -> None:
        """
        Load the avatar video file.
        
        Args:
            video_path: Path to the avatar video file
            
        Raises:
            FileNotFoundError: If the video file doesn't exist
        """
        if not os.path.exists(video_path):
            raise FileNotFoundError(f"Avatar video file not found: {video_path}")
        
        self.avatar_video = VideoFileClip(video_path, has_mask=True)
        self.logger.info(f"Loaded avatar video: {video_path}")
        self.logger.info(f"Original avatar size: {self.avatar_video.size}")
    
    def load_background(self, background_path: str) -> None:
        """
        Load the background image file.
        
        Args:
            background_path: Path to the background image file
            
        Raises:
            FileNotFoundError: If the background file doesn't exist
        """
        if not os.path.exists(background_path):
            raise FileNotFoundError(f"Background file not found: {background_path}")
        
        if self.avatar_video is None:
            raise ValueError("Load avatar video first before loading background")
        
        self.background = ImageClip(background_path, duration=self.avatar_video.duration)
        self.background = self.background.resized(self.avatar_video.size)
        self.logger.info(f"Loaded background: {background_path}")
        self.logger.info(f"Background size: {self.background.size}")
    
    def crop_to_aspect_ratio(self, aspect_ratio: float = 9/16) -> None:
        """
        Crop the avatar video to a specific aspect ratio.
        
        Args:
            aspect_ratio: Target aspect ratio (width/height). Default is 9/16 for vertical videos.
        """
        if self.avatar_video is None:
            raise ValueError("No avatar video loaded")
        
        w, h = self.avatar_video.size
        
        # Calculate crop dimensions based on aspect ratio
        if aspect_ratio < w/h:  # Need to crop width
            crop_width = h * aspect_ratio
            x1 = (w - crop_width) // 2
            x2 = x1 + crop_width
            y1, y2 = 0, h
        else:  # Need to crop height
            crop_height = w / aspect_ratio
            y1 = (h - crop_height) // 2
            y2 = y1 + crop_height
            x1, x2 = 0, w
        
        self.avatar_video = self.avatar_video.with_effects([
            vfx.Crop(x1=int(x1), y1=int(y1), x2=int(x2), y2=int(y2))
        ])
        
        self.logger.info(f"Cropped avatar to aspect ratio {aspect_ratio}. New size: {self.avatar_video.size}")
    
    def resize_avatar(self, size: Union[str, float]) -> None:
        """
        Resize the avatar video.
        
        Args:
            size: Either a string ("small", "medium", "large", "full") or a float multiplier
        """
        if self.avatar_video is None:
            raise ValueError("No avatar video loaded")
        
        if isinstance(size, str):
            if size not in self.SIZE_MULTIPLIERS:
                raise ValueError(f"Invalid size '{size}'. Must be one of: {list(self.SIZE_MULTIPLIERS.keys())}")
            multiplier = self.SIZE_MULTIPLIERS[size]
        else:
            multiplier = float(size)
        
        self.avatar_video = self.avatar_video.resized(multiplier)
        self.logger.info(f"Resized avatar to {size} (multiplier: {multiplier}). New size: {self.avatar_video.size}")
    
    def position_avatar(self, position: Union[Tuple[str, str], Tuple[int, int], str]) -> None:
        """
        Position the avatar video on the background.
        
        Args:
            position: Can be:
                - Tuple of strings: ("left"|"center"|"right", "top"|"center"|"bottom")
                - Tuple of integers: (x_pixels, y_pixels)
                - Single string: "left", "center", "right" (assumes bottom alignment)
        """
        if self.avatar_video is None:
            raise ValueError("No avatar video loaded")
        
        # Handle single string input (assume bottom alignment)
        if isinstance(position, str):
            position = (position, "bottom")
        
        self.avatar_video = self.avatar_video.with_position(position)
        self.logger.info(f"Positioned avatar at: {position}")
    
    def compose_video(self) -> None:
        """
        Compose the final video by combining background and avatar.
        """
        if self.avatar_video is None:
            raise ValueError("No avatar video loaded")
        if self.background is None:
            raise ValueError("No background loaded")
        
        self.final_video = CompositeVideoClip([self.background, self.avatar_video])
        self.logger.info("Composed final video")
    
    def save_video(self, output_path: str, **kwargs) -> None:
        """
        Save the final composed video to file.
        
        Args:
            output_path: Path where the output video will be saved
            **kwargs: Additional arguments passed to write_videofile()
        """
        if self.final_video is None:
            raise ValueError("No final video to save. Call compose_video() first.")
        
        # Set default codec and other parameters if not provided
        default_kwargs = {
            'codec': 'libx264',
            'audio_codec': 'aac',
            'fps': 24
        }
        default_kwargs.update(kwargs)
        
        self.final_video.write_videofile(output_path, **default_kwargs)
        self.logger.info(f"Saved final video to: {output_path}")
    
    def transform_video(self,
                       avatar_path: str,
                       background_path: str,
                       output_path: str,
                       position: Union[Tuple[str, str], Tuple[int, int], str] = ("right", "bottom"),
                       size: Union[str, float] = "medium",
                       crop_aspect_ratio: float = None,
                       **save_kwargs) -> None:
        """
        Complete video transformation pipeline in one method.
        
        Args:
            avatar_path: Path to the avatar video file
            background_path: Path to the background image file
            output_path: Path where the output video will be saved
            position: Position of the avatar on the background
            size: Size of the avatar ("small", "medium", "large", "full" or float multiplier)
            crop_aspect_ratio: Optional aspect ratio to crop to (e.g., 9/16 for vertical)
            **save_kwargs: Additional arguments passed to write_videofile()
        """
        try:
            # Load files
            self.load_avatar_video(avatar_path)
            self.load_background(background_path)
            
            # Apply transformations
            if crop_aspect_ratio:
                self.crop_to_aspect_ratio(crop_aspect_ratio)
            
            self.resize_avatar(size)
            self.position_avatar(position)
            
            # Compose and save
            self.compose_video()
            self.save_video(output_path, **save_kwargs)
            
            self.logger.info("Video transformation completed successfully")
            
        except Exception as e:
            self.logger.error(f"Error during video transformation: {str(e)}")
            raise
        finally:
            # Clean up resources
            self.cleanup()
    
    def cleanup(self) -> None:
        """
        Clean up loaded video clips to free memory.
        """
        if self.avatar_video:
            self.avatar_video.close()
            self.avatar_video = None
        if self.background:
            self.background.close()
            self.background = None
        if self.final_video:
            self.final_video.close()
            self.final_video = None
        self.logger.info("Cleaned up video resources")
    
    def __enter__(self):
        """Context manager entry."""
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit with automatic cleanup."""
        self.cleanup()


# Example usage
if __name__ == "__main__":
    # Example 1: Using the complete pipeline method
    transformer = VideoTransformer()
    transformer.transform_video(
        avatar_path="meg.webm",
        background_path="background.png",
        output_path="output.mp4",
        position=("left", "bottom"),
        size="medium",
        crop_aspect_ratio=9/16
    )