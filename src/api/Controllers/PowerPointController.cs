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
                    PartitionKey = userId, // Use userId as partition key for organization
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

        // 0d8e33cd-c8d3-4cc9-9d56-e0336e7a0f07 get images with thsi
        [HttpGet("ppt/{pptId}/slides")]
        public async Task<IActionResult> GetPptSlides(string pptId, [FromQuery] string userId = "tenant123")
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
            
                    return BadRequest(new {
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
                return Ok(new {
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
    }
}