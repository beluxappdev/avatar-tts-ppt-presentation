using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Http;
using System;
using System.IO;
using System.Threading.Tasks;
using PptProcessingApi.Services;
using PptProcessingApi.Models;

namespace PptProcessingApi.Controllers
{
    [ApiController]
    [Route("api")]
    public class PptController : ControllerBase
    {
        private readonly ILogger<PptController> _logger;
        private readonly BlobStorageService _blobStorageService;
        private readonly CosmosDbService _cosmosDbService;

        public PptController(
            ILogger<PptController> logger,
            BlobStorageService blobStorageService,
            CosmosDbService cosmosDbService)
        {
            _logger = logger;
            _blobStorageService = blobStorageService;
            _cosmosDbService = cosmosDbService;
        }

        [HttpPost("save_ppt")]
        [RequestFormLimits(MultipartBodyLengthLimit = 1000 * 1024 * 1024)] // 100MB limit
        [RequestSizeLimit(1000 * 1024 * 1024)] // 1000MB limit
        public async Task<IActionResult> SavePpt(IFormFile file, [FromForm] string userId = "anonymous")
        {
            try
            {
                _logger.LogInformation("SavePpt endpoint called at {time} by user {userId}", DateTimeOffset.UtcNow, userId);

                if (file == null || file.Length == 0)
                {
                    _logger.LogWarning("No file was uploaded");
                    return BadRequest("Please upload a PowerPoint file");
                }

                string pptId = Guid.NewGuid().ToString();

                // Log file information
                _logger.LogInformation("Received file: {fileName}, Size: {fileSize} bytes, Content-Type: {contentType}, jobId: {jobId}",
                    file.FileName,
                    file.Length,
                    file.ContentType,
                    pptId);

                // Validate file type
                string fileExtension = Path.GetExtension(file.FileName).ToLowerInvariant();
                if (fileExtension != ".pptx" && fileExtension != ".ppt")
                {
                    _logger.LogWarning("Invalid file type: {fileExtension}", fileExtension);
                    return BadRequest("Please upload a valid PowerPoint file (.ppt or .pptx)");
                }

                // Upload to blob storage
                string blobUrl;
                using (var stream = file.OpenReadStream())
                {
                    blobUrl = await _blobStorageService.UploadFileAsync(stream, file.FileName, pptId);
                }

                // Create outbox entry - implements the Outbox pattern
                var outboxEntry = new OutboxEntryModel
                {
                    Id = pptId,
                    UserId = userId, // Use userId as partition key for organization
                    FileName = file.FileName,
                    BlobUrl = blobUrl,
                    MessageType = "PowerPointUploaded",
                    Status = "Pending"
                };

                // Save to Cosmos DB
                await _cosmosDbService.CreateOutboxEntryAsync(outboxEntry);

                _logger.LogInformation(
                    "File successfully uploaded to blob storage and outbox entry created. File: {fileName}, OutboxId: {outboxId}",
                    file.FileName,
                    outboxEntry.Id);

                // Return success with the blob URL (not waiting for outbox processing)
                return Ok(new
                {
                    pptId = pptId,
                    message = $"Successfully uploaded PowerPoint file: {file.FileName}",
                    url = blobUrl,
                    fileId = outboxEntry.Id,
                    signalRHub = "/processingStatusHub" // URL for SignalR hub
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing PowerPoint file");
                return StatusCode(500, "An error occurred while processing your request");
            }
        }

        [HttpGet("ppt/{pptId}/slides")]
        public async Task<IActionResult> GetPptSlides(string pptId, [FromQuery] string userId = "anonymous")
        {
            try
            {
                _logger.LogInformation("GetPptSlides endpoint called for pptId: {PptId} by user: {UserId}", pptId, userId);

                // Verify that the PowerPoint exists and is processed
                var outboxEntry = await _cosmosDbService.GetOutboxEntryAsync(pptId, userId);

                if (outboxEntry == null)
                {
                    _logger.LogWarning("PowerPoint not found: {PptId}", pptId);
                    return NotFound(new { message = $"PowerPoint with ID {pptId} not found" });
                }

                // Check if image processing is completed
                if (outboxEntry.ImageProcessingStatus != "Completed")
                {
                    _logger.LogWarning("Image processing not completed for pptId: {PptId}, current status: {Status}",
                        pptId, outboxEntry.ImageProcessingStatus);

                    return BadRequest(new
                    {
                        message = "Images are not ready yet. Current status: " + outboxEntry.ImageProcessingStatus,
                        status = outboxEntry.ImageProcessingStatus
                    });
                }

                // Get the slide images with SAS token
                var (slides, sasToken) = await _blobStorageService.GetSlideImagesAsync(pptId);

                if (slides.Count == 0)
                {
                    _logger.LogWarning("No slides found for pptId: {PptId}", pptId);
                    return NotFound(new { message = "No slides found for this PowerPoint" });
                }

                // Return the slide data with the SAS token
                return Ok(new
                {
                    pptId = pptId,
                    fileName = outboxEntry.FileName,
                    slideCount = slides.Count,
                    slides = slides,
                    sasToken = sasToken
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving slides for pptId: {PptId}", pptId);
                return StatusCode(500, new { message = "An error occurred while retrieving the slides" });
            }
        }

        [HttpPost("generate_video")]
        public async Task<IActionResult> GenerateVideo([FromBody] VideoGenerationRequest request, [FromQuery] string userId = "anonymous")
        {
            try
            {
                _logger.LogInformation("GenerateVideo endpoint called for pptId: {PptId} by user: {UserId}", request.PptId, userId);

                // Validate request
                if (request == null || string.IsNullOrEmpty(request.PptId) || request.Slides == null || !request.Slides.Any())
                {
                    _logger.LogWarning("Invalid video generation request: {Request}", request);
                    return BadRequest(new { message = "Invalid request. PptId and slides are required." });
                }

                // Verify that the PowerPoint exists
                var outboxEntry = await _cosmosDbService.GetOutboxEntryAsync(request.PptId, userId);
                if (outboxEntry == null)
                {
                    _logger.LogWarning("PowerPoint not found for video generation: {PptId}", request.PptId);
                    return NotFound(new { message = $"PowerPoint with ID {request.PptId} not found" });
                }

                // Check if all required processing is completed
                if (outboxEntry.ImageProcessingStatus != "Completed" || outboxEntry.ScriptProcessingStatus != "Completed")
                {
                    _logger.LogWarning("Slide processing not completed for pptId: {PptId}. Image: {ImageStatus}, Script: {ScriptStatus}",
                        request.PptId, outboxEntry.ImageProcessingStatus, outboxEntry.ScriptProcessingStatus);

                    return BadRequest(new
                    {
                        message = "Slide processing is not completed yet. Both images and scripts must be processed before generating video.",
                        imageProcessingStatus = outboxEntry.ImageProcessingStatus,
                        scriptProcessingStatus = outboxEntry.ScriptProcessingStatus
                    });
                }

                // Check if video generation is already in progress or completed
                if (outboxEntry.VideoProcessingStatus == "Pending" || outboxEntry.VideoProcessingStatus == "Processing")
                {
                    _logger.LogWarning("Video generation already in progress for pptId: {PptId}, current status: {Status}",
                        request.PptId, outboxEntry.VideoProcessingStatus);
                    return BadRequest(new
                    {
                        message = "Video generation is already in progress for this presentation.",
                        videoProcessingStatus = outboxEntry.VideoProcessingStatus
                    });
                }

                if (outboxEntry.VideoProcessingStatus == "Completed")
                {
                    return Ok(new
                    {
                        message = "Video has already been generated for this presentation.",
                        videoProcessingStatus = outboxEntry.VideoProcessingStatus,
                    });
                }

                _logger.LogInformation("Starting video generation for pptId: {PptId}, userId: {UserId}", request.PptId, userId);

                // Generate a unique job ID for this video generation request
                string videoJobId = Guid.NewGuid().ToString();

                // Update the outbox entry to start video processing
                outboxEntry.VideoProcessingStatus = "InProgress";
                outboxEntry.VideoJobId = videoJobId;
                outboxEntry.VideoTotalSlides = request.Slides.Count;
                outboxEntry.VideoCompletedSlides = 0;
                outboxEntry.VideoFailedSlides = 0;
                outboxEntry.VideoStartedAt = DateTime.UtcNow;
                outboxEntry.VideoStatus = new List<VideoStatus>(
                    request.Slides.Select(slide => new VideoStatus
                    {
                        SlideNumber = slide.Index.ToString(),
                        Status = "Pending",
                        VideoUrl = null
                    })
                );

                await _cosmosDbService.UpdateOutboxEntryAsync(outboxEntry);

                // Send a message to Service Bus for each slide
                var serviceBusService = HttpContext.RequestServices.GetRequiredService<ServiceBusService>();

                foreach (var slide in request.Slides)
                {
                    var slideVideoMessage = new SlideVideoGenerationMessage
                    {
                        JobId = videoJobId,
                        PptId = request.PptId,
                        SlideNumber = slide.Index,
                        Script = slide.Script,
                        AvatarConfig = slide.AvatarConfig,
                        UserId = userId,
                        CreatedAt = DateTimeOffset.UtcNow
                    };

                    await serviceBusService.SendSlideVideoMessageAsync(slideVideoMessage);
                    _logger.LogInformation("Video generation message sent for slide {SlideNumber} of pptId: {PptId}, jobId: {JobId}",
                        slide.Index, request.PptId, videoJobId);
                }

                _logger.LogInformation("Video generation initiated for pptId: {PptId}, jobId: {JobId}, totalSlides: {TotalSlides}",
                    request.PptId, videoJobId, request.Slides.Count);

                return Ok(new
                {
                    jobId = videoJobId,
                    message = $"Video generation started for {request.Slides.Count} slides",
                    pptId = request.PptId,
                    status = "InProgress",
                    signalRHub = "/processingStatusHub"
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing video generation request for pptId: {PptId}", request?.PptId);
                return StatusCode(500, new { message = "An error occurred while processing your video generation request" });
            }
        }

        [HttpGet("ppt/{pptId}/video")]
        public async Task<IActionResult> GetPptVideo(string pptId, [FromQuery] string userId = "anonymous")
        {
            try
            {
                _logger.LogInformation("GetPptVideo endpoint called for pptId: {PptId} by user: {UserId}", pptId, userId);

                // Verify that the PowerPoint exists
                var outboxEntry = await _cosmosDbService.GetOutboxEntryAsync(pptId, userId);

                if (outboxEntry == null)
                {
                    _logger.LogWarning("PowerPoint not found: {PptId}", pptId);
                    return NotFound(new { message = $"PowerPoint with ID {pptId} not found" });
                }

                // Check if video processing is completed
                if (outboxEntry.VideoProcessingStatus != "Completed")
                {
                    _logger.LogWarning("Video processing not completed for pptId: {PptId}, current status: {Status}", 
                        pptId, outboxEntry.VideoProcessingStatus);
    
                    return BadRequest(new {
                        message = "Video is not ready yet. Current status: " + outboxEntry.VideoProcessingStatus,
                        status = outboxEntry.VideoProcessingStatus
                    });
                }

                // Get video URL with SAS token
                string videoUrl = await _blobStorageService.GetCompletedVideoAsync(pptId);

                if (string.IsNullOrEmpty(videoUrl))
                {
                    _logger.LogWarning("No completed video found for pptId: {PptId}", pptId);
                    return NotFound(new { message = "No completed video found for this PowerPoint" });
                }

                // Return the video data with URL including SAS token
                return Ok(new {
                    pptId = pptId,
                    fileName = outboxEntry.FileName,
                    videoUrl = videoUrl
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving video for pptId: {PptId}", pptId);
                return StatusCode(500, new { message = "An error occurred while retrieving the video" });
            }
        }
    }
}