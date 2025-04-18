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
                    fileId = outboxEntry.Id
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing PowerPoint file");
                return StatusCode(500, "An error occurred while processing your request");
            }
        }

        // Adding a GET endpoint for testing
        [HttpGet("save_ppt")]
        public IActionResult TestSavePpt()
        {
            _logger.LogInformation("GET SavePpt endpoint called at {time}", DateTimeOffset.UtcNow);
            return Ok("GET endpoint is working! Try the POST endpoint with a PowerPoint file upload.");
        }
    }
}