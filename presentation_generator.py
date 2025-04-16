import os
import json
import time
import logging
import threading
import queue
import requests
import uuid
import subprocess
import tempfile
import shutil
from io import BytesIO
from concurrent.futures import ThreadPoolExecutor
from azure.storage.blob import BlobServiceClient, ContentSettings
from pptx import Presentation
from PIL import Image, ImageDraw, ImageFont

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] [%(levelname)s] [%(name)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger("presentation_generator")

# Azure Configuration
SPEECH_ENDPOINT = os.environ.get('SPEECH_ENDPOINT')
SPEECH_KEY = os.environ.get('SPEECH_KEY')
API_VERSION = "2024-08-01"
STORAGE_CONNECTION_STRING = os.environ.get('AZURE_STORAGE_CONNECTION_STRING')
STORAGE_CONTAINER_NAME = os.environ.get('AZURE_STORAGE_CONTAINER', 'slides')

class PresentationGenerator:
    """
    Manages the generation of a complete presentation video by:
    1. Extracting slides as images
    2. Creating avatar videos for each slide with speech from notes
    3. Concatenating all videos into a single presentation
    """
    
    def __init__(self, process_id, pptx_file_path, output_dir, max_concurrency=1):
        """
        Initialize the presentation generator
        
        Args:
            process_id: Unique ID for this process
            pptx_file_path: Path to the PowerPoint file
            output_dir: Directory to store output files
            max_concurrency: Maximum number of concurrent video generations
        """
        self.process_id = process_id
        self.pptx_file_path = pptx_file_path
        self.output_dir = output_dir
        self.max_concurrency = 1
        
        # Create output directory if it doesn't exist
        os.makedirs(self.output_dir, exist_ok=True)
        
        # Process state tracking
        self.jobs = {}  # {slide_index: job_info}
        self.status_file = os.path.join(self.output_dir, 'status.json')
        self.active_jobs = 0
        self.all_completed = False
        
        # Concurrency control
        self.job_queue = queue.Queue()
        self.job_lock = threading.Lock()
        self.semaphore = threading.Semaphore(self.max_concurrency)
        
        # Final presentation video path
        self.output_video = os.path.join(self.output_dir, f"{self.process_id}_presentation.mp4")
        
        # Load existing status if available
        self._load_status()
        
    def _load_status(self):
        """Load existing status if this is a resuming operation"""
        if os.path.exists(self.status_file):
            try:
                with open(self.status_file, 'r') as f:
                    data = json.load(f)
                    if isinstance(data, dict) and 'jobs' in data:
                        self.jobs = data['jobs']
                        logger.info(f"Loaded {len(self.jobs)} existing jobs from status file")
                        
                        # Count active jobs
                        active_count = sum(1 for job in self.jobs.values() 
                                          if job.get('status') in ['pending', 'processing', 'submitted'])
                        self.active_jobs = active_count
            except Exception as e:
                logger.warning(f"Could not load existing status: {e}")
    
    def generate_presentation(self, slide_notes, avatar_settings):
        """
        Start the presentation generation process
        
        Args:
            slide_notes: List of slide notes information
            avatar_settings: Dictionary with avatar settings
            
        Returns:
            Dictionary with process information
        """
        logger.info(f"Starting presentation generation for {len(slide_notes)} slides")
        
        # Filter slides with notes
        slides_with_notes = [slide for slide in slide_notes if slide.get('notes', '').strip()]
        
        if not slides_with_notes:
            logger.warning("No slides with notes found")
            return {
                "status": "error",
                "message": "No slides with notes found in the presentation"
            }
        
        logger.info(f"Found {len(slides_with_notes)} slides with notes")
        
        # Initialize jobs
        for slide in slides_with_notes:
            slide_index = slide['slide_index']
            
            # Skip if already being processed
            if str(slide_index) in self.jobs and self.jobs[str(slide_index)].get('status') not in ['error', 'pending']:
                logger.info(f"Slide {slide_index} is already being processed, skipping")
                continue
            
            # Add to jobs
            self.jobs[str(slide_index)] = {
                'slide_index': slide_index,
                'notes': slide['notes'],
                'status': 'pending',
                'created_at': time.time()
            }
            
            # Add to processing queue
            self.job_queue.put(slide_index)
        
        # Save initial status
        self._save_status()
        
        # Start processing thread
        processing_thread = threading.Thread(target=self._process_queue, args=(avatar_settings,))
        processing_thread.daemon = True
        processing_thread.start()
        
        # Start monitoring thread
        monitoring_thread = threading.Thread(target=self._monitor_completion)
        monitoring_thread.daemon = True
        monitoring_thread.start()
        
        return {
            "status": "processing",
            "process_id": self.process_id,
            "total_slides": len(slides_with_notes),
            "max_concurrency": self.max_concurrency
        }
    
    def _process_queue(self, avatar_settings):
        """Process slides from the queue with limited concurrency"""
        logger.info(f"Starting queue processing with concurrency {self.max_concurrency}")
        
        while not self.job_queue.empty():
            try:
                # Get next slide index
                slide_index = self.job_queue.get(block=False)
                
                # Wait for a semaphore slot
                self.semaphore.acquire()
                
                # Start processing in a new thread
                with self.job_lock:
                    self.active_jobs += 1
                
                process_thread = threading.Thread(
                    target=self._process_slide,
                    args=(slide_index, avatar_settings)
                )
                process_thread.daemon = True
                process_thread.start()
                
            except queue.Empty:
                break
            
            # Brief pause to avoid high CPU usage
            time.sleep(0.1)
        
        logger.info("Queue processing completed")
    
    def _process_slide(self, slide_index, avatar_settings):
        """Process a single slide to generate its video"""
        try:
            logger.info(f"Processing slide {slide_index}")
            
            # Update status
            with self.job_lock:
                self.jobs[str(slide_index)]["status"] = "processing"
            self._save_status()
            
            # 1. Extract slide as image
            slide_image_path = self._extract_slide_image(slide_index)
            
            # 2. Upload image to blob storage
            image_url = self._upload_image(slide_image_path)
            
            # 3. Get slide notes
            notes = self.jobs[str(slide_index)]["notes"]
            
            # 4. Create and submit avatar synthesis job
            job_id = str(uuid.uuid4())
            synthesis_job_id = self._submit_avatar_job(job_id, notes, image_url, avatar_settings)
            
            if not synthesis_job_id:
                raise Exception("Failed to submit avatar synthesis job")
            
            # 5. Update job status
            with self.job_lock:
                self.jobs[str(slide_index)]["status"] = "submitted"
                self.jobs[str(slide_index)]["job_id"] = synthesis_job_id
                self.jobs[str(slide_index)]["image_url"] = image_url
                self.jobs[str(slide_index)]["submitted_at"] = time.time()
            self._save_status()
            
            # 6. Monitor job until completion
            self._monitor_job(slide_index, synthesis_job_id)
            
        except Exception as e:
            logger.error(f"Error processing slide {slide_index}: {str(e)}")
            
            with self.job_lock:
                self.jobs[str(slide_index)]["status"] = "error"
                self.jobs[str(slide_index)]["error"] = str(e)
                self.active_jobs -= 1
            
            self._save_status()
            
        finally:
            # Always release the semaphore
            self.semaphore.release()
    
    def _extract_slide_image(self, slide_index):
        """Extract a slide as an image using PDF conversion"""
        logger.info(f"Extracting image for slide {slide_index}")
        
        temp_dir = tempfile.mkdtemp()
        try:
            # Get the base name of the PowerPoint file
            input_filename = os.path.basename(self.pptx_file_path)
            base_name = os.path.splitext(input_filename)[0]
            
            # 1. Convert PPTX to PDF using LibreOffice
            pdf_path = os.path.join(temp_dir, f"{base_name}.pdf")
            
            convert_cmd = [
                "libreoffice",
                "--headless",
                "--convert-to", "pdf",
                "--outdir", temp_dir,
                self.pptx_file_path
            ]
            
            logger.info(f"Converting PPTX to PDF: {' '.join(convert_cmd)}")
            subprocess.run(convert_cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            
            if not os.path.exists(pdf_path):
                logger.error(f"PDF conversion failed, file not found: {pdf_path}")
                return self._create_placeholder_image(slide_index)
            
            # 2. Extract specific page from PDF
            output_image_path = os.path.join(self.output_dir, f"slide_{slide_index}.png")
            
            extract_cmd = [
                "pdftoppm",
                "-png",
                "-f", str(slide_index),  # First page (1-based)
                "-l", str(slide_index),  # Last page
                "-scale-to", "1920",     # Scale width to 1920 pixels
                pdf_path,
                os.path.join(temp_dir, "slide")
            ]
            
            logger.info(f"Extracting page from PDF: {' '.join(extract_cmd)}")
            subprocess.run(extract_cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            
            # Find the output file
            output_pattern = os.path.join(temp_dir, "slide-*.png")
            import glob
            output_files = glob.glob(output_pattern)
            
            if output_files:
                # Copy the file to output directory
                shutil.copy(output_files[0], output_image_path)
                logger.info(f"Successfully extracted slide to: {output_image_path}")
                return output_image_path
            else:
                logger.error(f"No output files found matching pattern: {output_pattern}")
                return self._create_placeholder_image(slide_index)
                
        except Exception as e:
            logger.error(f"Error extracting slide image: {str(e)}")
            return self._create_placeholder_image(slide_index)
            
        finally:
            # Clean up
            shutil.rmtree(temp_dir, ignore_errors=True)
    
    def _create_placeholder_image(self, slide_index):
        """Create a placeholder image for a slide"""
        logger.info(f"Creating placeholder image for slide {slide_index}")
        
        # Create a blank image
        width, height = 1920, 1080
        img = Image.new('RGB', (width, height), color=(255, 255, 255))
        draw = ImageDraw.Draw(img)
        
        # Try to use a standard font or fall back to default
        try:
            font = ImageFont.truetype("arial.ttf", 60)
        except IOError:
            font = ImageFont.load_default()
        
        # Add slide number text
        slide_text = f"Slide {slide_index}"
        
        # Get text size and calculate position
        try:
            # For newer PIL versions
            text_width, text_height = draw.textbbox((0, 0), slide_text, font=font)[2:4]
        except AttributeError:
            # For older PIL versions
            text_width, text_height = draw.textsize(slide_text, font=font)
            
        position = ((width - text_width) // 2, (height - text_height) // 2)
        draw.text(position, slide_text, fill=(0, 0, 0), font=font)
        
        # Save to a file
        output_path = os.path.join(self.output_dir, f"slide_{slide_index}_placeholder.png")
        img.save(output_path)
        
        return output_path
    
    def _upload_image(self, image_path):
        """Upload an image to Azure Blob Storage and return a URL"""
        logger.info(f"Uploading image to Azure Blob Storage: {image_path}")
        
        if not STORAGE_CONNECTION_STRING:
            logger.error("AZURE_STORAGE_CONNECTION_STRING environment variable is not set")
            raise ValueError("Azure Storage connection string not configured")
        
        try:
            # Create blob service client
            blob_service_client = BlobServiceClient.from_connection_string(STORAGE_CONNECTION_STRING)
            
            # Create/get container
            container_client = blob_service_client.get_container_client(STORAGE_CONTAINER_NAME)
            if not container_client.exists():
                container_client = blob_service_client.create_container(
                    STORAGE_CONTAINER_NAME,
                    public_access='blob'  # Makes blobs publicly accessible
                )
            
            # Generate blob name
            blob_name = f"{self.process_id}/{os.path.basename(image_path)}"
            
            # Upload the image
            blob_client = blob_service_client.get_blob_client(
                container=STORAGE_CONTAINER_NAME,
                blob=blob_name
            )
            
            with open(image_path, "rb") as data:
                blob_client.upload_blob(
                    data,
                    overwrite=True,
                    content_settings=ContentSettings(content_type='image/png')
                )
            
            # Get the URL
            blob_url = blob_client.url
            logger.info(f"Image uploaded successfully. URL: {blob_url}")
            
            return blob_url
            
        except Exception as e:
            logger.error(f"Error uploading image: {str(e)}")
            # Fallback to a placeholder URL
            return "https://samples-files.com/samples/Images/jpg/1920-1080-sample.jpg"
    
    def _authenticate(self):
        """Authenticate with Azure Speech Service"""
        if not SPEECH_KEY:
            raise ValueError("SPEECH_KEY environment variable is not set")
            
        return {'Ocp-Apim-Subscription-Key': SPEECH_KEY}
    
    def _submit_avatar_job(self, job_id, notes_content, background_image_url, avatar_settings):
        """Submit a job to Azure Avatar API to generate a video"""
        logger.info(f"Submitting avatar synthesis job: {job_id}")
        
        if not SPEECH_ENDPOINT:
            raise ValueError("SPEECH_ENDPOINT environment variable is not set")
            
        url = f'{SPEECH_ENDPOINT}/avatar/batchsyntheses/{job_id}?api-version={API_VERSION}'
        
        headers = {
            'Content-Type': 'application/json'
        }
        headers.update(self._authenticate())
        
        # Create payload
        payload = {
            'synthesisConfig': {
                "voice": "en-US-AvaMultilingualNeural",
            },
            'customVoices': {},
            "inputKind": "PlainText",  # PlainText or SSML
            "inputs": [
                {
                    "content": notes_content,
                },
            ],
            "avatarConfig": {
                "customized": False,
                "talkingAvatarCharacter": "Lisa",
                "talkingAvatarStyle": "casual-sitting",
                "videoFormat": "mp4",
                "videoCodec": "h264",
                "subtitleType": "soft_embedded",
                "backgroundImage": background_image_url,  # Use the slide as the background
                #"backgroundColor": "#00000000", # background color in RGBA format, default is white; can be set to 'transparent' for transparent background
            }
        }
        
        # Send request
        response = requests.put(url, json.dumps(payload), headers=headers)
        
        if response.status_code < 400:
            response_data = response.json()
            logger.info(f'Avatar synthesis job submitted successfully! Job ID: {response_data["id"]}')
            return response_data["id"]
        else:
            logger.error(f'Failed to submit avatar job. Status: {response.status_code}, Response: {response.text}')
            return None
    
    def _check_job_status(self, job_id):
        """Check the status of an avatar synthesis job"""
        if not SPEECH_ENDPOINT:
            raise ValueError("SPEECH_ENDPOINT environment variable is not set")
            
        url = f'{SPEECH_ENDPOINT}/avatar/batchsyntheses/{job_id}?api-version={API_VERSION}'
        
        try:
            response = requests.get(url, headers=self._authenticate())
            
            if response.status_code < 400:
                response_data = response.json()
                status = response_data['status']
                
                if status == 'Succeeded':
                    download_url = response_data["outputs"]["result"]
                    return {"status": status, "download_url": download_url}
                elif status == 'Failed':
                    return {"status": status, "error": response_data.get("error")}
                else:
                    return {"status": status}
            else:
                return {"status": "Error", "message": f"HTTP error {response.status_code}: {response.text}"}
                
        except Exception as e:
            logger.error(f"Error checking job status: {str(e)}")
            return {"status": "Error", "message": str(e)}
    
    def _monitor_job(self, slide_index, job_id):
        """Monitor a job until it completes or fails"""
        logger.info(f"Monitoring job for slide {slide_index}, job ID: {job_id}")
        
        retry_count = 0
        max_retries = 3
        poll_interval = 15  # seconds
        
        while True:
            try:
                # Check status
                status_result = self._check_job_status(job_id)
                
                if not status_result:
                    retry_count += 1
                    if retry_count >= max_retries:
                        raise Exception("Invalid status response after multiple retries")
                    time.sleep(poll_interval)
                    continue
                
                # Reset retry counter on successful API call
                retry_count = 0
                
                # Update job status
                job_status = status_result.get("status")
                
                with self.job_lock:
                    self.jobs[str(slide_index)]["status"] = job_status
                    self.jobs[str(slide_index)]["last_checked"] = time.time()
                    
                    if "download_url" in status_result:
                        self.jobs[str(slide_index)]["download_url"] = status_result["download_url"]
                        
                    if "error" in status_result:
                        self.jobs[str(slide_index)]["error"] = status_result["error"]
                
                self._save_status()
                
                # Check for completion
                if job_status in ["Succeeded", "Failed", "Error"]:
                    if job_status == "Succeeded":
                        logger.info(f"Job for slide {slide_index} completed successfully")
                        
                        # Download the video file
                        if "download_url" in status_result:
                            video_path = os.path.join(self.output_dir, f"slide_{slide_index}.mp4")
                            self._download_video(status_result["download_url"], video_path)
                            
                            with self.job_lock:
                                self.jobs[str(slide_index)]["video_path"] = video_path
                    else:
                        logger.error(f"Job for slide {slide_index} failed: {status_result.get('error')}")
                    
                    break
                
                # Wait before polling again
                time.sleep(poll_interval)
                
            except Exception as e:
                logger.error(f"Error monitoring job for slide {slide_index}: {str(e)}")
                
                with self.job_lock:
                    self.jobs[str(slide_index)]["status"] = "error"
                    self.jobs[str(slide_index)]["error"] = str(e)
                    
                self._save_status()
                break
                
        # Decrement active jobs counter
        with self.job_lock:
            self.active_jobs -= 1
            
        self._save_status()
    
    def _download_video(self, url, output_path):
        """Download a video file from a URL"""
        logger.info(f"Downloading video from {url} to {output_path}")
        
        try:
            response = requests.get(url, stream=True, timeout=60)
            response.raise_for_status()
            
            with open(output_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
                        
            logger.info(f"Video downloaded successfully: {output_path}")
            return True
            
        except Exception as e:
            logger.error(f"Error downloading video: {str(e)}")
            return False
    
    def _monitor_completion(self):
        """Monitor for completion of all jobs and concatenate videos when done"""
        logger.info("Started monitoring for completion")
        
        check_interval = 10  # seconds
        
        while True:
            time.sleep(check_interval)
            
            with self.job_lock:
                # Skip if we know all jobs are completed
                if self.all_completed:
                    continue
                
                # Get counts
                total_jobs = len(self.jobs)
                
                if total_jobs == 0:
                    continue
                
                # Count completed and failed jobs
                completed_jobs = sum(1 for job in self.jobs.values() 
                                   if job.get("status") == "Succeeded")
                failed_jobs = sum(1 for job in self.jobs.values() 
                                if job.get("status") in ["Failed", "Error", "error"])
                
                # Check if all jobs are complete
                all_done = (completed_jobs + failed_jobs) == total_jobs and self.active_jobs == 0
                
                if all_done:
                    logger.info(f"All jobs completed: {completed_jobs} succeeded, {failed_jobs} failed")
                    
                    self.all_completed = True
                    self.jobs['generation_status'] = {
                        "status": "completed",
                        "completed_at": time.time(),
                        "total": total_jobs,
                        "succeeded": completed_jobs,
                        "failed": failed_jobs
                    }
                    
                    # Only concatenate if at least one job succeeded
                    if completed_jobs > 0:
                        self.jobs['concatenation_status'] = {
                            "status": "in_progress",
                            "started_at": time.time()
                        }
                        
            # If all jobs are done, concatenate videos
            if self.all_completed and completed_jobs > 0:
                self._concatenate_videos()
                break

    def _upload_video_to_blob(self, video_path):
        """Upload the final video to Azure Blob Storage and return URL"""
        logger.info(f"Uploading final video to Azure Blob Storage: {video_path}")
    
        if not STORAGE_CONNECTION_STRING:
            logger.error("AZURE_STORAGE_CONNECTION_STRING environment variable is not set")
            raise ValueError("Azure Storage connection string not configured")
    
        try:
            # Create blob service client
            blob_service_client = BlobServiceClient.from_connection_string(STORAGE_CONNECTION_STRING)
        
            # Create/get container
            container_client = blob_service_client.get_container_client(STORAGE_CONTAINER_NAME)
            if not container_client.exists():
                container_client = blob_service_client.create_container(
                    STORAGE_CONTAINER_NAME,
                    public_access='blob'  # Makes blobs publicly accessible
                )
        
            # Generate blob name
            blob_name = f"{self.process_id}/{os.path.basename(video_path)}"
        
            # Upload the video
            blob_client = blob_service_client.get_blob_client(
                container=STORAGE_CONTAINER_NAME,
                blob=blob_name
            )
        
            # Generate a SAS token that expires in 24 hours
            from datetime import datetime, timedelta
            from azure.storage.blob import generate_blob_sas, BlobSasPermissions
        
            sas_token = generate_blob_sas(
                account_name=blob_service_client.account_name,
                container_name=STORAGE_CONTAINER_NAME,
                blob_name=blob_name,
                account_key=blob_service_client.credential.account_key,
                permission=BlobSasPermissions(read=True),
                expiry=datetime.utcnow() + timedelta(hours=24)
            )
        
            with open(video_path, "rb") as data:
                blob_client.upload_blob(
                    data,
                    overwrite=True,
                    content_settings=ContentSettings(content_type='video/mp4')
                )
        
            # Get the URL with SAS token
            blob_url = f"{blob_client.url}?{sas_token}"
            logger.info(f"Video uploaded successfully. URL with SAS token: {blob_url}")
        
            return blob_url
        
        except Exception as e:
            logger.error(f"Error uploading video: {str(e)}")
            return None
    
    def _concatenate_videos(self):
        """Concatenate all slide videos into a final presentation video"""
        logger.info("Concatenating videos into final presentation")
    
        try:
            # Get all successful jobs
            successful_jobs = {}
        
            with self.job_lock:
                for slide_index, job in self.jobs.items():
                    if not slide_index.isdigit():
                        continue  # Skip status entries
                    
                    if job.get("status") == "Succeeded" and "video_path" in job:
                        successful_jobs[int(slide_index)] = job
        
            if not successful_jobs:
                logger.warning("No successful jobs found for concatenation")
            
                with self.job_lock:
                    self.jobs['concatenation_status'] = {
                        "status": "error",
                        "error": "No successful videos found",
                        "completed_at": time.time()
                    }
                self._save_status()
                return
        
            # Sort jobs by slide index
            sorted_jobs = [successful_jobs[idx] for idx in sorted(successful_jobs.keys())]
        
            # Create a file listing videos to concatenate
            temp_dir = tempfile.mkdtemp()
            concat_file = os.path.join(temp_dir, "concat_list.txt")
        
            with open(concat_file, 'w') as f:
                for job in sorted_jobs:
                    # Use absolute paths with proper escaping
                    absolute_path = os.path.abspath(job['video_path'])
                    # Escape single quotes in the path by doubling them
                    escaped_path = absolute_path.replace("'", "''")
                    f.write(f"file '{escaped_path}'\n")
        
            # Make sure output directory exists
            output_dir = os.path.dirname(self.output_video)
            os.makedirs(output_dir, exist_ok=True)
        
            try:
                # First try with copy, which is faster but might fail if videos have different formats
                command = [
                    'ffmpeg',
                    '-f', 'concat',
                    '-safe', '0',
                    '-i', concat_file,
                    '-c', 'copy',
                    self.output_video
                ]
            
                logger.info(f"Running FFmpeg command: {' '.join(command)}")

                result = subprocess.run(
                    command,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    check=False
                )
        
                # Check if the command was successful and output file exists
                if (result.returncode == 0 and 
                    os.path.exists(self.output_video) and 
                    os.path.getsize(self.output_video) > 0):
                    logger.info(f"Successfully created presentation video: {self.output_video}")
                elif result.returncode != 0:
                    # Log the actual FFmpeg error for debugging
                    logger.error(f"FFmpeg error: {result.stderr}")
                    raise Exception(f"FFmpeg error: {result.stderr}")
        
                # Verify the output file exists after all attempts
                if os.path.exists(self.output_video) and os.path.getsize(self.output_video) > 0:
                    logger.info(f"Successfully created presentation video: {self.output_video}")

                    blob_url = self._upload_video_to_blob(self.output_video)
            
                    with self.job_lock:
                        self.jobs['concatenation_status'] = {
                            "status": "completed",
                            "output_file": self.output_video,
                            "completed_at": time.time(),
                            "video_count": len(sorted_jobs),
                            "blob_url": blob_url
                        }
                else:
                    raise Exception("Output video file is missing or empty after all attempts")
            
            except Exception as e:
                logger.error(f"FFmpeg error: {str(e)}")
        
                with self.job_lock:
                    self.jobs['concatenation_status'] = {
                        "status": "error",
                        "error": f"Error concatenating videos: {str(e)}",
                        "completed_at": time.time()
                    }
    
            # Clean up
            shutil.rmtree(temp_dir, ignore_errors=True)
    
        except Exception as e:
            logger.error(f"Error in video concatenation: {str(e)}")
    
            with self.job_lock:
                self.jobs['concatenation_status'] = {
                    "status": "error",
                    "error": f"Error in concatenation process: {str(e)}",
                    "completed_at": time.time()
                }
        
        finally:
            self._save_status()
    
    def _save_status(self):
        """Save current status to a file"""
        try:
            # First write to a temporary file
            with tempfile.NamedTemporaryFile(mode='w', delete=False) as temp_file:
                json.dump({
                    "process_id": self.process_id,
                    "active_jobs": self.active_jobs,
                    "all_completed": self.all_completed,
                    "updated_at": time.time(),
                    "jobs": self.jobs
                }, temp_file, indent=2)
                
            # Then move it to the target file
            shutil.move(temp_file.name, self.status_file)
                
        except Exception as e:
            logger.error(f"Error saving status: {str(e)}")
    
    def get_status(self):
        """Get the current status of the presentation generation"""
        try:
            # Return the in-memory state
            return {
                "process_id": self.process_id,
                "active_jobs": self.active_jobs,
                "all_completed": self.all_completed,
                "updated_at": time.time(),
                "output_video": self.output_video if os.path.exists(self.output_video) else None,
                "jobs": self.jobs
            }
        except Exception as e:
            logger.error(f"Error getting status: {str(e)}")
            return {
                "process_id": self.process_id,
                "status": "error",
                "message": f"Error getting status: {str(e)}"
            }
