from moviepy import VideoFileClip, ImageClip, CompositeVideoClip, vfx 


# Load the transparent video (avatar talking)
avatar_video = VideoFileClip("meg.webm", has_mask=True)
# Load the background image and set its duration to match the video
background = ImageClip("background.png", duration=avatar_video.duration)

# Resize the background to match the video dimensions (if needed)
background = background.resized(avatar_video.size)

(w, h) = avatar_video.size

crop_width = h * 9/16
# x1,y1 is the top left corner, and x2, y2 is the lower right corner of the cropped area.

x1, x2 = (w - crop_width)//2, (w+crop_width)//2
y1, y2 = 0, h
avatar_video = avatar_video.with_effects([vfx.Crop(x1=x1, y1=y1, x2=x2, y2=y2)])
# or you can specify center point and cropped width/height
# cropped_clip = crop(clip, width=crop_width, height=h, x_center=w/2, y_center=h/2)
# cropped_clip.write_videofile('temp.webm')


print(f"Background size: {background.size}")

avatar_video = avatar_video.resized(1)  # Sizes are 0.25, 0.5, 0.75 which will be passed as small, medium, large

print(f"Avatar video size: {avatar_video.size}")
# x, y = avatar_video.size
# x+= OFFSET_MEDIUM_SIZE
avatar_video = avatar_video.with_position(("right", "bottom"))  # Position the avatar video on the right side of the screen
# print(f"x: {x}, y: {y}")


# Composite the avatar video on top of the background
final_video = CompositeVideoClip([background, avatar_video])

# Write the final video to file
final_video.write_videofile("output.mp4")

# Close the clips to free up memory
avatar_video.close()
background.close()
final_video.close()