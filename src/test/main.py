from moviepy import VideoFileClip, ImageClip, CompositeVideoClip

# Load the transparent video (avatar talking)
avatar_video = VideoFileClip("meg.webm")

# Load the background image and set its duration to match the video
background = ImageClip("background.png", duration=avatar_video.duration)

# Resize the background to match the video dimensions (if needed)
#background = background.resize(avatar_video.size)

# Composite the avatar video on top of the background
final_video = CompositeVideoClip([background, avatar_video])

# Write the final video to file
final_video.write_videofile("output.mp4", codec='vp9')

# Close the clips to free up memory
avatar_video.close()
background.close()
final_video.close()