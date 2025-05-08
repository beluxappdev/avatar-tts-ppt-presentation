using Microsoft.Extensions.Hosting;
using PptProcessingApi.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace PptProcessingApi.Services
{
    public class OutboxProcessorService : BackgroundService
    {
        private readonly CosmosDbService _cosmosDbService;
        private readonly ServiceBusService _serviceBusService;
        private readonly ILogger<OutboxProcessorService> _logger;
        private readonly TimeSpan _processingInterval;
        private readonly TimeSpan _retryInterval;
        private readonly int _batchSize;

        public OutboxProcessorService(
            CosmosDbService cosmosDbService,
            ServiceBusService serviceBusService,
            IConfiguration configuration,
            ILogger<OutboxProcessorService> logger)
        {
            _cosmosDbService = cosmosDbService;
            _serviceBusService = serviceBusService;
            _logger = logger;

            // Get processing intervals from configuration
            int processingIntervalSeconds = configuration.GetValue<int>("OutboxProcessor:ProcessingIntervalSeconds", 15);
            int retryIntervalSeconds = configuration.GetValue<int>("OutboxProcessor:RetryIntervalSeconds", 60);
            _batchSize = configuration.GetValue<int>("OutboxProcessor:BatchSize", 50);

            _processingInterval = TimeSpan.FromSeconds(processingIntervalSeconds);
            _retryInterval = TimeSpan.FromSeconds(retryIntervalSeconds);

            _logger.LogInformation("Outbox processor configured with processing interval: {ProcessingInterval}s, retry interval: {RetryInterval}s, batch size: {BatchSize}",
                processingIntervalSeconds, retryIntervalSeconds, _batchSize);
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("Outbox processor service is starting");

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    // Process pending outbox entries
                    await ProcessPendingEntriesAsync(stoppingToken);

                    // Process failed outbox entries for retry
                    await ProcessFailedEntriesAsync(stoppingToken);

                    // Wait before next processing cycle
                    await Task.Delay(_processingInterval, stoppingToken);
                }
                catch (OperationCanceledException)
                {
                    // Normal cancellation, don't log as error
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error in outbox processor service");
                    
                    // Wait a bit before retrying after an error
                    try
                    {
                        await Task.Delay(_retryInterval, stoppingToken);
                    }
                    catch (OperationCanceledException)
                    {
                        break;
                    }
                }
            }

            _logger.LogInformation("Outbox processor service is stopping");
        }

        private async Task ProcessPendingEntriesAsync(CancellationToken stoppingToken)
        {
            try
            {
                var pendingEntries = await _cosmosDbService.GetPendingOutboxEntriesAsync(_batchSize);
                
                if (!pendingEntries.Any())
                {
                    return;
                }

                _logger.LogInformation("Processing {Count} pending outbox entries", pendingEntries.Count());

                // Group entries by user ID to ensure ordering
                var entriesByUser = pendingEntries.GroupBy(e => e.PartitionKey ?? "default").ToList();

                foreach (var userGroup in entriesByUser)
                {
                    if (stoppingToken.IsCancellationRequested)
                        break;
                    
                    var userEntries = userGroup.ToList();
                    
                    // Mark all entries as processing
                    foreach (var entry in userEntries)
                    {
                        entry.Status = "Processing";
                        entry.ProcessedAt = DateTime.UtcNow;
                        entry.LastAttemptAt = DateTime.UtcNow;
                        await _cosmosDbService.UpdateOutboxEntryAsync(entry);
                    }

                    try
                    {
                        // Prepare messages for batch sending
                        var messages = userEntries.Select(entry => (
                            messageBody: (object)new
                            {
                                MessageType = entry.MessageType,
                                PptId = entry.Id,
                                UserId = entry.PartitionKey,
                                FileName = entry.FileName,
                                BlobUrl = entry.BlobUrl,
                                Timestamp = DateTime.UtcNow
                            },
                            messageId: entry.Id,
                            sessionId: entry.PartitionKey
                        )).ToList();

                        // Send all messages using the batch-aware method
                        await _serviceBusService.SendMessagesAsync(messages, stoppingToken);

                        // Mark all entries as completed
                        foreach (var entry in userEntries)
                        {
                            entry.Status = "Processing";
                            entry.CompletedAt = DateTime.UtcNow;
                            await _cosmosDbService.UpdateOutboxEntryAsync(entry);
                        }

                        _logger.LogInformation("Successfully processed {Count} outbox entries for user {UserId}", 
                            userEntries.Count, userGroup.Key);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Error processing outbox entries for user {UserId}", userGroup.Key);
                        
                        // Mark entries as failed
                        foreach (var entry in userEntries)
                        {
                            entry.Status = "Failed";
                            entry.FailedAt = DateTime.UtcNow;
                            entry.RetryCount++;
                            entry.ErrorDetails = ex.Message;
                            await _cosmosDbService.UpdateOutboxEntryAsync(entry);
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing pending outbox entries");
                throw;
            }
        }

        private async Task ProcessFailedEntriesAsync(CancellationToken stoppingToken)
        {
            try
            {
                var failedEntries = await _cosmosDbService.GetFailedOutboxEntriesAsync(_batchSize);
                
                if (!failedEntries.Any())
                {
                    return;
                }

                _logger.LogInformation("Processing {Count} failed outbox entries for retry", failedEntries.Count());

                // Use the same processing logic as for pending entries
                // Group entries by user ID to ensure ordering
                var entriesByUser = failedEntries.GroupBy(e => e.PartitionKey ?? "default").ToList();

                foreach (var userGroup in entriesByUser)
                {
                    if (stoppingToken.IsCancellationRequested)
                        break;
                    
                    var userEntries = userGroup.ToList();
                    
                    // Mark all entries as processing
                    foreach (var entry in userEntries)
                    {
                        entry.Status = "Processing";
                        entry.LastAttemptAt = DateTime.UtcNow;
                        await _cosmosDbService.UpdateOutboxEntryAsync(entry);
                    }

                    try
                    {
                        // Prepare messages for batch sending
                        var messages = userEntries.Select(entry => (
                            messageBody: (object)new
                            {
                                MessageType = entry.MessageType,
                                PptId = entry.Id,
                                UserId = entry.PartitionKey,
                                FileName = entry.FileName,
                                BlobUrl = entry.BlobUrl,
                                Timestamp = DateTime.UtcNow
                            },
                            messageId: entry.Id,
                            sessionId: entry.PartitionKey
                        )).ToList();

                        // Send all messages using the batch-aware method
                        await _serviceBusService.SendMessagesAsync(messages, stoppingToken);

                        // Mark all entries as completed
                        foreach (var entry in userEntries)
                        {
                            entry.Status = "Completed";
                            entry.CompletedAt = DateTime.UtcNow;
                            await _cosmosDbService.UpdateOutboxEntryAsync(entry);
                        }

                        _logger.LogInformation("Successfully retried {Count} outbox entries for user {UserId}", 
                            userEntries.Count, userGroup.Key);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Error retrying outbox entries for user {UserId}", userGroup.Key);
                        
                        // Mark entries as failed again
                        foreach (var entry in userEntries)
                        {
                            entry.Status = "Failed";
                            entry.FailedAt = DateTime.UtcNow;
                            entry.RetryCount++;
                            entry.ErrorDetails = ex.Message;
                            await _cosmosDbService.UpdateOutboxEntryAsync(entry);
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing failed outbox entries");
                throw;
            }
        }
    }
}