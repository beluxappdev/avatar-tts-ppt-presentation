using Azure.Identity;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;

namespace PptProcessingApi.Services
{
    public class BlobStorageService
    {
        private readonly BlobServiceClient _blobServiceClient;
        private readonly string _containerName;
        private readonly ILogger<BlobStorageService> _logger;

        public BlobStorageService(IConfiguration configuration, ILogger<BlobStorageService> logger)
        {
            _logger = logger;
            
            // Get configuration from appsettings or environment variables
            var storageAccount = configuration["AzureServices:BlobStorage:Endpoint"]
                        ?? throw new InvalidOperationException("Blob storage endpoint is missing in configuration.");
            _containerName = configuration["AzureServices:BlobStorage:Container"]
                            ?? throw new InvalidOperationException("Blob container name is missing in configuration.");

            var tenantId = configuration["AzureAd:TenantId"]
                        ?? throw new InvalidOperationException("TenantId is missing in configuration.");
            var clientId = configuration["AzureAd:ClientId"]
                        ?? throw new InvalidOperationException("ClientId is missing in configuration.");
            var clientSecret = configuration["AzureAd:ClientSecret"]
                            ?? throw new InvalidOperationException("ClientSecret is missing in configuration.");


            // Log configuration (mask sensitive data)
            _logger.LogInformation("Configuring Azure Blob Storage: Account: {Account}, Container: {Container}", 
                storageAccount, _containerName);

            // Create client using service principal authentication
            var credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
            var blobUri = new Uri(storageAccount);
            _blobServiceClient = new BlobServiceClient(blobUri, credential);
        }

        public async Task<string> UploadFileAsync(Stream fileStream, string fileName, string pptId)
        {
            try
            {
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
                
                // Return the URL of the uploaded blob
                return blobClient.Uri.ToString();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error uploading file to blob storage");
                throw;
            }
        }
    }
}