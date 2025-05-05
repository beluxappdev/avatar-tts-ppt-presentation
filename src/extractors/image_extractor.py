import os
import io
import tempfile
import logging
import subprocess
from datetime import datetime
import json
from azure.storage.blob import ContentSettings

# PDF processing
import pdf2image

from base_extractor import BaseExtractor 

# Configure logging
logger = logging.getLogger(__name__)

class ImageExtractor(BaseExtractor):
    """Extractor for extracting images from PowerPoint presentations using LibreOffice"""
    
    def __init__(self):
        """Initialize the image extractor"""
        super().__init__(extractor_type="image")
    
    def extract_images(self, ppt_id, presentation_path):
        """Extract images from PowerPoint presentation using LibreOffice
        
        Args:
            ppt_id (str): ID of the PowerPoint
            presentation_path (str): Path to the downloaded PowerPoint file
        """
        logger.info(f"Extracting images from PowerPoint: {ppt_id} using LibreOffice")
        
        # Track results for each slide for error reporting
        slide_results = {}
        overall_success = True
        error_messages = []
        
        try:
            # Create a temp directory for the conversion process
            with tempfile.TemporaryDirectory() as temp_dir:
                # Convert PowerPoint to PDF using LibreOffice
                pdf_path = self._convert_ppt_to_pdf(presentation_path, temp_dir)
                if not pdf_path:
                    error_msg = "Failed to convert PowerPoint to PDF"
                    logger.error(error_msg)
                    error_messages.append(error_msg)
                    overall_success = False
                    raise Exception(error_msg)
                
                # Convert PDF to images
                slide_images = self._convert_pdf_to_images(pdf_path)
                
                # Process each slide image
                for slide_index, image in enumerate(slide_images):
                    slide_result = {
                        "index": slide_index,
                        "success": True,
                        "image_count": 0,
                        "errors": []
                    }
                    
                    logger.info(f"Processing slide {slide_index + 1} of {len(slide_images)}")
                    
                    try:
                        # Create the slide directory path
                        slide_dir_path = f"{ppt_id}/slides/{slide_index}"
                        
                        # Save the image to blob storage
                        try:
                            # Save as PNG
                            image_blob_path = f"{slide_dir_path}/image.png"
                            
                            # Convert PIL Image to bytes
                            img_byte_arr = io.BytesIO()
                            image.save(img_byte_arr, format='PNG')
                            img_byte_arr.seek(0)
                            
                            # Upload to blob storage
                            blob_client = self.blob_container_client.get_blob_client(image_blob_path)
                            blob_client.upload_blob(img_byte_arr.getvalue(), overwrite=True, content_settings=ContentSettings(content_type='image/png'))
                            logger.info(f"Uploaded slide image: {image_blob_path}")
                            
                            slide_result["image_count"] = 1
                        except Exception as e:
                            error_msg = f"Error saving image for slide {slide_index}: {str(e)}"
                            logger.error(error_msg)
                            slide_result["errors"].append(error_msg)
                    
                    except Exception as e:
                        error_msg = f"Error processing slide {slide_index}: {str(e)}"
                        logger.error(error_msg)
                        slide_result["success"] = False
                        slide_result["errors"].append(error_msg)
                        overall_success = False
                    
                    # Store the result for this slide
                    slide_results[slide_index] = slide_result
                
                # Store additional metadata about slide extraction
                self.extraction_results = {
                    "ppt_id": ppt_id,
                    "overall_success": overall_success,
                    "slide_count": len(slide_images),
                    "slides_processed": len(slide_results),
                    "slides_with_errors": sum(1 for result in slide_results.values() if not result["success"]),
                    "slide_results": slide_results,
                    "error_messages": error_messages
                }
                
                logger.info(f"Completed image extraction from PowerPoint: {ppt_id} - Success: {overall_success}")
            
        except Exception as e:
            error_msg = f"Critical error extracting images: {str(e)}"
            logger.error(error_msg)
            error_messages.append(error_msg)
            overall_success = False
            
            # Store failure metadata
            self.extraction_results = {
                "ppt_id": ppt_id,
                "overall_success": False,
                "error_messages": error_messages
            }
            
            raise
    
    def _convert_ppt_to_pdf(self, ppt_path, output_dir):
        """Convert PowerPoint to PDF using LibreOffice
        
        Args:
            ppt_path (str): Path to PowerPoint file
            output_dir (str): Directory to save the output PDF
            
        Returns:
            str: Path to the output PDF file, or None if conversion failed
        """
        logger.info(f"Converting PowerPoint to PDF: {ppt_path}")
        try:
            # Run LibreOffice headless to convert PowerPoint to PDF
            command = [
                'libreoffice',
                '--headless',
                '--convert-to', 'pdf',
                '--outdir', output_dir,
                ppt_path
            ]
            
            # Execute the command
            process = subprocess.run(
                command,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                check=True
            )
            
            logger.info(f"LibreOffice conversion output: {process.stdout}")
            
            # Get the output PDF path
            ppt_filename = os.path.basename(ppt_path)
            pdf_filename = os.path.splitext(ppt_filename)[0] + '.pdf'
            pdf_path = os.path.join(output_dir, pdf_filename)
            
            # Check if the file exists
            if os.path.exists(pdf_path):
                logger.info(f"Successfully converted PowerPoint to PDF: {pdf_path}")
                return pdf_path
            else:
                logger.error(f"PDF file not created: {pdf_path}")
                return None
        except subprocess.CalledProcessError as e:
            logger.error(f"Error converting PowerPoint to PDF: {e.stderr}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error in PowerPoint to PDF conversion: {str(e)}")
            return None
    
    def _convert_pdf_to_images(self, pdf_path):
        """Convert PDF to images
        
        Args:
            pdf_path (str): Path to PDF file
            
        Returns:
            list: List of PIL Image objects
        """
        logger.info(f"Converting PDF to images: {pdf_path}")
        try:
            # Convert PDF to images using pdf2image
            images = pdf2image.convert_from_path(
                pdf_path,
                dpi=300,  # Higher DPI for better quality
                fmt='png'
            )
            
            logger.info(f"Successfully converted PDF to {len(images)} images")
            return images
        except Exception as e:
            logger.error(f"Error converting PDF to images: {str(e)}")
            raise
    
    def process_message(self, message):
        """Override the process_message method to modify how we handle PowerPoint files"""
        try:
            # Parse message body
            if hasattr(message.body, '__iter__') and not isinstance(message.body, (str, bytes)):
                message_body_bytes = b''.join(message.body)
                message_body = message_body_bytes.decode('utf-8')
            else:
                message_body = message.body.decode('utf-8')
            
            message_data = json.loads(message_body)
        
            if message_data.get("MessageType") != "PowerPointUploaded":
                logger.warning(f"Skipping message with unsupported type: {message_data.get('MessageType')}")
                return
        
            logger.info(f"Processing PowerPointUploaded message: {message_data}")
        
            # Extract message properties
            ppt_id = message_data.get("PptId")
            file_name = message_data.get("FileName")
            blob_url = message_data.get("BlobUrl")
            user_id = message_data.get("UserId")
            timestamp = message_data.get("Timestamp") or datetime.utcnow().isoformat()
        
            if not all([ppt_id, file_name, blob_url, user_id]):
                error_msg = "Message missing required fields"
                logger.error(error_msg)
                
                # Create a basic failure record in Cosmos even with missing fields
                if ppt_id and user_id:
                    self._log_failure(ppt_id, user_id, file_name or "unknown", blob_url or "unknown", 
                                     timestamp, error_msg)
                return
        
            # Reset extraction results tracking
            self.extraction_results = None
            
            try:
                # Download PowerPoint file
                temp_path = self._download_ppt_file(blob_url)
                
                # Process the PowerPoint directly without using python-pptx
                self.extract_images(ppt_id, temp_path)
                
                # Log the extraction to Cosmos DB
                self.log_extraction(ppt_id, file_name, user_id, timestamp)
                
                # Cleanup temporary file
                if os.path.exists(temp_path):
                    os.unlink(temp_path)
                
            except Exception as e:
                error_msg = f"Error processing PowerPoint: {str(e)}"
                logger.error(error_msg)
                
                # Log the failure to Cosmos DB
                self._log_failure(ppt_id, user_id, file_name, blob_url, timestamp, error_msg)
                
                # Cleanup temporary file if it exists
                if 'temp_path' in locals() and os.path.exists(temp_path):
                    os.unlink(temp_path)
                
                raise
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse message as JSON: {str(e)}")
        except Exception as e:
            logger.error(f"Unhandled error processing message: {str(e)}")
            raise
    
    def extract_scripts(self, ppt_id, presentation):
        """Implement required abstract method, but it's not used in ImageExtractor"""
        pass
    
    def _update_extraction_data(self, item, ppt_id):
        """Update image extraction data in the Cosmos DB document
        
        Args:
            item (dict): Cosmos DB document to update
            ppt_id (str): ID of the PowerPoint
        """
        try:
            # Count number of slides with images
            image_count = 0
            slides_data = item.get('slides', [])
            
            # If 'slides' field already exists, update it with image data
            # otherwise create a new slides array
            if not slides_data:
                slides_data = []
                
            # List all slide directories
            slide_directories = set()
            slide_prefix = f"{ppt_id}/slides/"
            
            # List all blobs with the prefix for this presentation
            blobs = list(self.blob_container_client.list_blobs(name_starts_with=slide_prefix))
            
            # Extract unique slide directories from blob paths
            for blob in blobs:
                # Get relative path after the slide prefix
                rel_path = blob.name[len(slide_prefix):]
                # Get the slide index from the first part of the path
                parts = rel_path.split('/')
                if len(parts) >= 1:
                    try:
                        slide_index = int(parts[0])
                        slide_directories.add(slide_index)
                    except ValueError:
                        logger.warning(f"Invalid slide directory format: {parts[0]}")
            
            # For each slide directory, gather image data
            for slide_index in sorted(slide_directories):
                # Find or create slide entry
                slide_data = next((slide for slide in slides_data if slide.get('index') == slide_index), None)
                
                if slide_data is None:
                    slide_data = {
                        "index": slide_index,
                        "hasImage": False,
                        "hasScript": False
                    }
                    slides_data.append(slide_data)
                
                # Check for image
                image_blob_path = f"{slide_prefix}{slide_index}/image.png"
                image_blob_exists = False
                
                for blob in blobs:
                    if blob.name == image_blob_path:
                        image_blob_exists = True
                        slide_data["hasImage"] = True
                        slide_data["imageUrl"] = f"https://{self.blob_endpoint.replace('https://', '')}/{self.blob_container_name}/{blob.name}"
                        slide_data["imageSize"] = blob.size
                        slide_data["imageType"] = "image/png"
                        image_count += 1
                        break
            
            # Update the document with processed slide data
            item['slides'] = slides_data
            item['slideCount'] = len(slides_data)
            item['slidesWithImages'] = image_count
            
        except Exception as e:
            # Log the error but don't fail the entire operation
            logger.error(f"Error updating image data: {str(e)}")
            
            # Update the document with error information
            item['imageProcessingStatus'] = "Failed" 
            item['imageProcessingError'] = str(e)
            item['imageProcessingErrorAt'] = datetime.utcnow().isoformat()
            
            raise

def main():
    """Main entry point"""
    try:
        extractor = ImageExtractor()
        extractor.start_processing()
    except Exception as e:
        logger.error(f"Unhandled exception in image extractor: {str(e)}")
        raise

if __name__ == "__main__":
    main()