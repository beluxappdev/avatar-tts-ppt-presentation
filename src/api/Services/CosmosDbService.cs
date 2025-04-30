using Azure.Identity;
using Microsoft.Azure.Cosmos;
using PptProcessingApi.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace PptProcessingApi.Services
{
    public class CosmosDbService
    {
        private readonly Container _container;
        private readonly ILogger<CosmosDbService> _logger;

        public CosmosDbService(IConfiguration configuration, ILogger<CosmosDbService> logger)
        {
            _logger = logger;

            // Get configuration from appsettings or environment variables
            var endpoint = configuration["AzureServices:CosmosDb:Endpoint"]
                        ?? throw new InvalidOperationException("Cosmos DB endpoint is missing in configuration.");
            var databaseName = configuration["AzureServices:CosmosDb:Database"]
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
                endpoint, databaseName, containerName);

            var credential = new ClientSecretCredential(tenantId, clientId, clientSecret);

            // Create CosmosClient
            var client = new CosmosClient(endpoint, credential, new CosmosClientOptions
            {
                SerializerOptions = new CosmosSerializationOptions
                {
                    PropertyNamingPolicy = CosmosPropertyNamingPolicy.CamelCase
                }
            });

            // Create database if it doesn't exist
            var database = client.CreateDatabaseIfNotExistsAsync(databaseName).GetAwaiter().GetResult();

            // Create container if it doesn't exist
            // The partition key is set to "/partitionKey"
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
                var response = await _container.ReplaceItemAsync(entry, entry.Id, new PartitionKey(entry.PartitionKey));
                return response.Resource;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating outbox entry: {Id}", entry.Id);
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
    }
}