using Azure.Identity;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Azure.Storage.Sas;
using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using System.Linq;
using PptProcessingApi.Models;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Azure.Storage;
using System.ComponentModel;

namespace PptProcessingApi.Services
{
    public class BlobStorageService
    {
        private readonly BlobServiceClient _blobServiceClient;
        private readonly string _containerName;
        private readonly ILogger<BlobStorageService> _logger;
        private readonly SignalRService _signalRService;
        private readonly IConfiguration _configuration;
        private readonly StorageSharedKeyCredential _storageSharedKeyCredential;
        private readonly string _accountName;

        public BlobStorageService(
            IConfiguration configuration, 
            ILogger<BlobStorageService> logger,
            SignalRService signalRService)
        {
            _logger = logger;
            _signalRService = signalRService;
            _configuration = configuration;
            
            // Get configuration from appsettings or environment variables
            _accountName = configuration["AzureServices:BlobStorage:AccountName"]
                        ?? throw new InvalidOperationException("Storage account name is missing in configuration.");
            _containerName = configuration["AzureServices:BlobStorage:Container"]
                            ?? throw new InvalidOperationException("Blob container name is missing in configuration.");

            // For storage account shared key authentication (needed for SAS generation)
            var accountKey = configuration["AzureServices:BlobStorage:AccountKey"]
                          ?? throw new InvalidOperationException("Storage account key is missing in configuration.");

            // Log configuration (mask sensitive data)
            _logger.LogInformation("Configuring Azure Blob Storage: Account: {Account}, Container: {Container}", 
                _accountName, _containerName);

            // Create StorageSharedKeyCredential for SAS generation
            _storageSharedKeyCredential = new StorageSharedKeyCredential(_accountName, accountKey);

            // Create BlobServiceClient with the shared key credential
            _blobServiceClient = new BlobServiceClient(
                new Uri($"https://{_accountName}.blob.core.windows.net"),
                _storageSharedKeyCredential);
        }

        public async Task<string> UploadFileAsync(Stream fileStream, string fileName, string pptId)
        {
            try
            {
                // Send initial notification that upload is starting
                await _signalRService.SendProcessingProgressAsync(
                    pptId, 
                    "BlobStorage", 
                    "Uploading");
                
                var containerClient = _blobServiceClient.GetBlobContainerClient(_containerName);
                
                // Create the container if it doesn't exist
                await containerClient.CreateIfNotExistsAsync(PublicAccessType.None);

                // Generate a unique blob name
                string blobName = $"{pptId}/{fileName}";
                var blobClient = containerClient.GetBlobClient(blobName);

                _logger.LogInformation("Uploading file to blob storage: {BlobName}", blobName);
                
                // Upload the file
                await blobClient.UploadAsync(fileStream, new BlobHttpHeaders
                {
                    ContentType = "application/vnd.openxmlformats-officedocument.presentationml.presentation"
                });

                _logger.LogInformation("File uploaded successfully to {BlobUri}", blobClient.Uri);
                
                // Send success notification via SignalR
                await _signalRService.SendProcessingProgressAsync(
                    pptId, 
                    "BlobStorage", 
                    "Completed");
                
                // Return the URL of the uploaded blob
                return blobClient.Uri.ToString();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error uploading file to blob storage");
                
                // Send error notification via SignalR
                await _signalRService.SendProcessingProgressAsync(
                    pptId, 
                    "BlobStorage", 
                    "Failed");
                throw;
            }
        }

        public async Task<(List<SlideModel>, string)> GetSlideImagesAsync(string pptId)
        {
            _logger.LogInformation("Getting slide images for PowerPoint: {PptId}", pptId);

            // Create the list to hold slide information
            var slides = new List<SlideModel>();
            var scriptsBySlideNumber = new Dictionary<int, string>();
    
            try
            {
                // Get a reference to the container
                BlobContainerClient containerClient = _blobServiceClient.GetBlobContainerClient(_containerName);
        
                // Generate SAS token for the blob container
                string sasToken = CreateBlobPrefixSasToken(pptId);
                _logger.LogInformation("Generated SAS token for container: {Container}", _containerName);
    
                // List blobs with the proper prefix to find all slides for this PPT
                string prefix = $"{pptId}/slides/";
    
                // First pass: collect all script files
                await foreach (var blobItem in containerClient.GetBlobsAsync(prefix: prefix))
                {
                    // Check if this is a script file
                    if (blobItem.Name.EndsWith("/script.txt"))
                    {
                        // Extract the slide number from the path
                        string[] pathParts = blobItem.Name.Split('/');
                        if (pathParts.Length >= 4 && int.TryParse(pathParts[pathParts.Length - 2], out int slideNumber))
                        {
                            // Get the blob client for the script file
                            BlobClient scriptBlobClient = containerClient.GetBlobClient(blobItem.Name);
                    
                            // Download the script content
                            BlobDownloadInfo download = await scriptBlobClient.DownloadAsync();
                    
                            // Read the script content
                            using (var streamReader = new StreamReader(download.Content))
                            {
                                string scriptContent = await streamReader.ReadToEndAsync();
                                scriptsBySlideNumber[slideNumber] = scriptContent;
                            }
                        }
                    }
                }
    
                // Second pass: collect all image files and match with scripts
                await foreach (var blobItem in containerClient.GetBlobsAsync(prefix: prefix))
                {
                    // Check if the blob is an image in the expected pattern
                    if (blobItem.Name.EndsWith("/image.png"))
                    {
                        // Extract the slide number from the path
                        string[] pathParts = blobItem.Name.Split('/');
                        if (pathParts.Length >= 4 && int.TryParse(pathParts[pathParts.Length - 2], out int slideNumber))
                        {
                            // Get a reference to the specific blob
                            BlobClient blobClient = containerClient.GetBlobClient(blobItem.Name);
                    
                            // Create the URL with SAS token properly
                            string blobUrlWithSas = $"{blobClient.Uri}?{sasToken}";
                    
                            // Create a SlideModel for this slide
                            var slide = new SlideModel
                            {
                                Index = slideNumber,
                                BlobUrl = blobUrlWithSas,
                                // Add the script content if available
                                Script = scriptsBySlideNumber.ContainsKey(slideNumber) 
                                        ? scriptsBySlideNumber[slideNumber] 
                                        : "null"
                            };
                
                            slides.Add(slide);
                        }
                    }
                }
    
                // Sort the slides by slide number
                slides = slides.OrderBy(s => s.Index).ToList();
    
                _logger.LogInformation("Found {SlideCount} slides for PowerPoint: {PptId}", slides.Count, pptId);
    
                return (slides, sasToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving slides for PowerPoint: {PptId}", pptId);
                throw;
            }
        }

        // Method to create SAS token with a specific prefix (virtual directory)
        private string CreateBlobPrefixSasToken(string pptId)
        {
            try
            {
                BlobContainerClient containerPptName = _blobServiceClient.GetBlobContainerClient($"{_containerName}/{pptId}");
                // Create a SAS token that's valid for 1 hour
                BlobSasBuilder sasBuilder = new BlobSasBuilder
                {
                    BlobContainerName = containerPptName.Name,
                    Resource = "c", // 'c' for container
                    ExpiresOn = DateTimeOffset.UtcNow.AddHours(24)
                };
        
                // Set the prefix to limit access to only the blobs with this pptId
                sasBuilder.SetPermissions(BlobContainerSasPermissions.Read);
        
                // Generate only the SAS token without the URL
                string sasToken = sasBuilder.ToSasQueryParameters(_storageSharedKeyCredential).ToString();
        
                _logger.LogInformation("Generated SAS token with prefix: {Prefix}", $"{pptId}/");
        
                return sasToken;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error generating SAS token with prefix: {Prefix}", $"{pptId}/");
                throw;
            }
        }
    }
}