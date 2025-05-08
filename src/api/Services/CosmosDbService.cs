using Azure.Identity;
using Microsoft.Azure.Cosmos;
using PptProcessingApi.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using static Microsoft.Azure.Cosmos.ChangeFeedProcessor;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using PptProcessingApi.Services;

namespace PptProcessingApi.Services
{
    public class CosmosDbService
    {
        private readonly Container _container;
        private readonly ILogger<CosmosDbService> _logger;
        private readonly SignalRService _signalRService;
        private readonly string _databaseName;
        private readonly CosmosClient _cosmosClient;

        public CosmosDbService(
            IConfiguration configuration, 
            ILogger<CosmosDbService> logger,
            SignalRService signalRService)
        {
            _logger = logger;
            _signalRService = signalRService;

            // Get configuration from appsettings or environment variables
            var endpoint = configuration["AzureServices:CosmosDb:Endpoint"]
                        ?? throw new InvalidOperationException("Cosmos DB endpoint is missing in configuration.");
            _databaseName = configuration["AzureServices:CosmosDb:Database"]
                        ?? throw new InvalidOperationException("Cosmos DB database name is missing in configuration.");
            var containerName = configuration["AzureServices:CosmosDb:Container"]
                        ?? throw new InvalidOperationException("Cosmos DB container name is missing in configuration.");

            var tenantId = configuration["AzureAd:TenantId"]
                        ?? throw new InvalidOperationException("TenantId is missing in configuration.");
            var clientId = configuration["AzureAd:ClientId"]
                        ?? throw new InvalidOperationException("ClientId is missing in configuration.");
            var clientSecret = configuration["AzureAd:ClientSecret"]
                            ?? throw new InvalidOperationException("ClientSecret is missing in configuration.");

            _logger.LogInformation("Configuring Azure Cosmos DB: Endpoint: {Endpoint}, Database: {Database}, Container: {Container}",
                endpoint, _databaseName, containerName);

            var credential = new ClientSecretCredential(tenantId, clientId, clientSecret);

            // Create CosmosClient
            _cosmosClient = new CosmosClient(endpoint, credential, new CosmosClientOptions
            {
                SerializerOptions = new CosmosSerializationOptions
                {
                    PropertyNamingPolicy = CosmosPropertyNamingPolicy.CamelCase
                }
            });

            // Create database if it doesn't exist
            var database = _cosmosClient.CreateDatabaseIfNotExistsAsync(_databaseName).GetAwaiter().GetResult();

            // Create container if it doesn't exist
            // The partition key is set to "/userId"
            var containerProperties = new ContainerProperties(containerName, "/userId")
            {
                DefaultTimeToLive = -1 // Enable TTL but don't set a default
            };
            _container = database.Database.CreateContainerIfNotExistsAsync(containerProperties).GetAwaiter().GetResult();
        }

        public async Task<OutboxEntryModel> CreateOutboxEntryAsync(OutboxEntryModel entry)
        {
            try
            {
                _logger.LogInformation("Creating outbox entry for file: {FileName}", entry.FileName);
                var response = await _container.CreateItemAsync(entry, new PartitionKey(entry.PartitionKey));
                
                // Notify clients about the new entry via SignalR
                await _signalRService.SendStatusUpdateAsync(entry.Id, entry.Status, $"PowerPoint file uploaded: {entry.FileName}");
                
                return response.Resource;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating outbox entry");
                throw;
            }
        }

        public async Task<OutboxEntryModel> UpdateOutboxEntryAsync(OutboxEntryModel entry)
        {
            try
            {
                var previousEntry = await GetOutboxEntryAsync(entry.Id, entry.PartitionKey);
                var response = await _container.ReplaceItemAsync(entry, entry.Id, new PartitionKey(entry.PartitionKey));
                
                // Check if status has changed and notify clients via SignalR
                if (previousEntry == null || previousEntry.Status != entry.Status)
                {
                    await _signalRService.SendStatusUpdateAsync(entry.Id, entry.Status);
                    _logger.LogInformation("Status change notification sent for {Id}: {Status}", entry.Id, entry.Status);
                }
                
                // Check if image processing status has changed
                if (previousEntry == null || previousEntry.ImageProcessingStatus != entry.ImageProcessingStatus)
                {
                    await _signalRService.SendProcessingProgressAsync(entry.Id, "ImageProcessing", entry.ImageProcessingStatus);
                    _logger.LogInformation("Image processing status change notification sent for {Id}: {Status}", 
                        entry.Id, entry.ImageProcessingStatus);
                }
                
                // Check if script processing status has changed
                if (previousEntry == null || previousEntry.ScriptProcessingStatus != entry.ScriptProcessingStatus)
                {
                    await _signalRService.SendProcessingProgressAsync(entry.Id, "ScriptProcessing", entry.ScriptProcessingStatus);
                    _logger.LogInformation("Script processing status change notification sent for {Id}: {Status}", 
                        entry.Id, entry.ScriptProcessingStatus);
                }
                
                return response.Resource;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating outbox entry: {Id}", entry.Id);
                throw;
            }
        }

        public async Task<OutboxEntryModel> GetOutboxEntryAsync(string id, string partitionKey)
        {
            try
            {
                var response = await _container.ReadItemAsync<OutboxEntryModel>(id, new PartitionKey(partitionKey));
                return response.Resource;
            }
            catch (CosmosException ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
            {
                _logger.LogWarning("Outbox entry not found: {Id}", id);
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving outbox entry: {Id}", id);
                throw;
            }
        }

        public async Task<IEnumerable<OutboxEntryModel>> GetPendingOutboxEntriesAsync(int maxItems = 10)
        {
            try
            {
                var query = new QueryDefinition("SELECT * FROM c WHERE c.type = 'outboxEntry' AND c.status = 'Pending' ORDER BY c.createdAt ASC OFFSET 0 LIMIT @limit")
                    .WithParameter("@limit", maxItems);

                var results = new List<OutboxEntryModel>();
                var iterator = _container.GetItemQueryIterator<OutboxEntryModel>(query);

                while (iterator.HasMoreResults)
                {
                    var response = await iterator.ReadNextAsync();
                    results.AddRange(response);
                }

                _logger.LogInformation("Retrieved {Count} pending outbox entries", results.Count);
                return results;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving pending outbox entries");
                throw;
            }
        }

        public async Task<IEnumerable<OutboxEntryModel>> GetFailedOutboxEntriesAsync(int maxItems = 10, int maxRetries = 5)
        {
            try
            {
                var query = new QueryDefinition("SELECT * FROM c WHERE c.type = 'outboxEntry' AND c.status = 'Failed' AND c.retryCount < @maxRetries ORDER BY c.lastAttemptAt ASC OFFSET 0 LIMIT @limit")
                    .WithParameter("@maxRetries", maxRetries)
                    .WithParameter("@limit", maxItems);

                var results = new List<OutboxEntryModel>();
                var iterator = _container.GetItemQueryIterator<OutboxEntryModel>(query);

                while (iterator.HasMoreResults)
                {
                    var response = await iterator.ReadNextAsync();
                    results.AddRange(response);
                }

                _logger.LogInformation("Retrieved {Count} failed outbox entries for retry", results.Count);
                return results;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving failed outbox entries");
                throw;
            }
        }

        // Start the Change Feed processor to monitor for changes to Cosmos DB
        public async Task StartChangeProcessorAsync(string leaseContainerName)
        {
            try
            {
                _logger.LogInformation("Starting Cosmos DB Change Feed Processor");

                // Get a reference to the lease container
                Container leaseContainer = _cosmosClient.GetContainer(_databaseName, leaseContainerName);

                // Create the lease container if it doesn't exist
                try
                {
                    await leaseContainer.ReadContainerAsync();
                    _logger.LogInformation("Lease container already exists: {Container}", leaseContainerName);
                }
                catch (CosmosException ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
                {
                    _logger.LogInformation("Creating lease container: {Container}", leaseContainerName);
                    await _cosmosClient.GetDatabase(_databaseName).CreateContainerAsync(
                        new ContainerProperties(leaseContainerName, "/id"));
                }

                // Create and start the Change Feed processor
                var processor = _container
                    .GetChangeFeedProcessorBuilder<OutboxEntryModel>("StatusChangeProcessor", HandleChangesAsync)
                    .WithInstanceName(Environment.MachineName)
                    .WithLeaseContainer(leaseContainer)
                    .Build();

                await processor.StartAsync();
                _logger.LogInformation("Change Feed Processor started successfully");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error starting Change Feed Processor");
                throw;
            }
        }

        // Handler for processing changes from the Change Feed
        private async Task HandleChangesAsync(IReadOnlyCollection<OutboxEntryModel> changes, CancellationToken cancellationToken)
        {
            try
            {
                _logger.LogInformation("Processing {Count} changes from Change Feed", changes.Count);

                foreach (var item in changes)
                {
                    _logger.LogInformation("Change detected for document {Id} with status {Status}", item.Id, item.Status);
                    
                    // Send overall status update via SignalR
                    await _signalRService.SendStatusUpdateAsync(item.Id, item.Status);
                    
                    // If image processing status is not pending, send update
                    if (item.ImageProcessingStatus != "Pending")
                    {
                        await _signalRService.SendProcessingProgressAsync(item.Id, "ImageProcessing", item.ImageProcessingStatus);
                    }
                    
                    // If script processing status is not pending, send update
                    if (item.ScriptProcessingStatus != "Pending")
                    {
                        await _signalRService.SendProcessingProgressAsync(item.Id, "ScriptProcessing", item.ScriptProcessingStatus);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error handling changes from Change Feed");
                // We don't rethrow here to prevent the Change Feed processor from stopping
            }
        }
    }
}