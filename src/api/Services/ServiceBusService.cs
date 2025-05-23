using Azure.Identity;
using Azure.Messaging.ServiceBus;
using System;
using System.Collections.Generic;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace PptProcessingApi.Services
{
    public class ServiceBusService
    {
        private readonly ServiceBusSender _sender;
        private readonly ILogger<ServiceBusService> _logger;

        public ServiceBusService(IConfiguration configuration, ILogger<ServiceBusService> logger)
        {
            _logger = logger;

            // Get configuration from appsettings or environment variables
            var serviceBusNamespace = configuration["AzureServices:ServiceBus:Namespace"]
                        ?? throw new InvalidOperationException("Service Bus namespace is missing in configuration.");
            var topicName = configuration["AzureServices:ServiceBus:Topic"]
                        ?? throw new InvalidOperationException("Service Bus topic name is missing in configuration.");
            
            // Get Azure AD credentials
            var tenantId = configuration["AzureAd:TenantId"]
                        ?? throw new InvalidOperationException("TenantId is missing in configuration.");
            var clientId = configuration["AzureAd:ClientId"]
                        ?? throw new InvalidOperationException("ClientId is missing in configuration.");
            var clientSecret = configuration["AzureAd:ClientSecret"]
                            ?? throw new InvalidOperationException("ClientSecret is missing in configuration.");

            _logger.LogInformation("Configuring Azure Service Bus: Namespace: {Namespace}, Topic: {Topic}",
                serviceBusNamespace, topicName);

            // Create credentials and client
            var credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
            var fullyQualifiedNamespace = $"{serviceBusNamespace}.servicebus.windows.net";

            var clientOptions = new ServiceBusClientOptions
            { 
                TransportType = ServiceBusTransportType.AmqpWebSockets
            };
            
            var client = new ServiceBusClient(fullyQualifiedNamespace, credential, clientOptions);
            _sender = client.CreateSender(topicName);
            
            _logger.LogInformation("Service Bus sender created successfully");
        }

        public async Task SendMessageAsync(object messageBody, string messageId, string? sessionId = null)
        {
            try
            {
                var jsonMessage = JsonSerializer.Serialize(messageBody);
                var message = new ServiceBusMessage(Encoding.UTF8.GetBytes(jsonMessage))
                {
                    ContentType = "application/json",
                    MessageId = messageId,
                    SessionId = sessionId
                };

                _logger.LogInformation("Sending message to Service Bus: {MessageId}", messageId);
                await _sender.SendMessageAsync(message);
                _logger.LogInformation("Message sent successfully");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error sending message to Service Bus: {MessageId}", messageId);
                throw;
            }
        }

        public async Task<ServiceBusMessageBatch> CreateMessageBatchAsync(CancellationToken cancellationToken = default)
        {
            try
            {
                _logger.LogDebug("Creating new Service Bus message batch");
                return await _sender.CreateMessageBatchAsync(cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating Service Bus message batch");
                throw;
            }
        }

        /// <summary>
        /// Sends a batch of messages to the Service Bus
        /// </summary>
        public async Task SendMessageBatchAsync(ServiceBusMessageBatch messageBatch, CancellationToken cancellationToken = default)
        {
            try
            {
                _logger.LogInformation("Sending batch of {Count} messages to Service Bus", messageBatch.Count);
                await _sender.SendMessagesAsync(messageBatch, cancellationToken);
                _logger.LogInformation("Message batch sent successfully");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error sending message batch to Service Bus");
                throw;
            }
        }

        /// <summary>
        /// Helper method to create a message from an object
        /// </summary>
        public ServiceBusMessage CreateMessage(object messageBody, string messageId, string? sessionId = null)
        {
            var jsonMessage = JsonSerializer.Serialize(messageBody);
            return new ServiceBusMessage(Encoding.UTF8.GetBytes(jsonMessage))
            {
                ContentType = "application/json",
                MessageId = messageId,
                SessionId = sessionId
            };
        }

        /// <summary>
        /// Sends a collection of messages in optimally-sized batches
        /// </summary>
        public async Task SendMessagesAsync(IEnumerable<(object messageBody, string messageId, string sessionId)> messages, 
                                           CancellationToken cancellationToken = default)
        {
            try
            {
                var currentBatch = await CreateMessageBatchAsync(cancellationToken);
                int messageCount = 0;
                int batchCount = 1;

                foreach (var (messageBody, messageId, sessionId) in messages)
                {
                    // Create the Service Bus message
                    var message = CreateMessage(messageBody, messageId, sessionId);
                    
                    // Try to add the message to the current batch
                    if (!currentBatch.TryAddMessage(message))
                    {
                        // If the batch is full, send it
                        _logger.LogInformation("Batch {BatchNumber} is full with {Count} messages, sending...", 
                            batchCount, currentBatch.Count);
                        
                        await SendMessageBatchAsync(currentBatch, cancellationToken);
                        batchCount++;
                        
                        // Create a new batch
                        currentBatch = await CreateMessageBatchAsync(cancellationToken);
                        
                        // Add the current message to the new batch
                        if (!currentBatch.TryAddMessage(message))
                        {
                            // This should only happen if the message is too large for a batch
                            _logger.LogWarning("Message {MessageId} is too large to fit in a batch, sending individually", messageId);
                            await SendMessageAsync(messageBody, messageId, sessionId);
                        }
                        else
                        {
                            messageCount++;
                        }
                    }
                    else
                    {
                        messageCount++;
                    }
                }

                // Send any remaining messages in the batch
                if (currentBatch.Count > 0)
                {
                    _logger.LogInformation("Sending final batch {BatchNumber} with {Count} messages", 
                        batchCount, currentBatch.Count);
                    
                    await SendMessageBatchAsync(currentBatch, cancellationToken);
                }

                _logger.LogInformation("Successfully sent {MessageCount} messages in {BatchCount} batches", 
                    messageCount, batchCount);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error sending messages in batches");
                throw;
            }
        }
    }
}