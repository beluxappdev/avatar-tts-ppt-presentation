using Newtonsoft.Json;
using System;

namespace PptProcessingApi.Models
{
    public class OutboxEntryModel
    {
        [JsonProperty(PropertyName = "id")]
        public string Id { get; set; }

        [JsonProperty(PropertyName = "userId")]
        public string PartitionKey { get; set; }

        [JsonProperty(PropertyName = "type")]
        public string Type { get; set; } = "outboxEntry";

        [JsonProperty(PropertyName = "status")]
        public string Status { get; set; } = "Pending"; // Pending, Processing, Completed, Failed

        [JsonProperty(PropertyName = "createdAt")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [JsonProperty(PropertyName = "processedAt")]
        public DateTime? ProcessedAt { get; set; }

        [JsonProperty(PropertyName = "completedAt")]
        public DateTime? CompletedAt { get; set; }

        [JsonProperty(PropertyName = "failedAt")]
        public DateTime? FailedAt { get; set; }

        [JsonProperty(PropertyName = "retryCount")]
        public int RetryCount { get; set; } = 0;

        [JsonProperty(PropertyName = "errorDetails")]
        public string ErrorDetails { get; set; }

        [JsonProperty(PropertyName = "lastAttemptAt")]
        public DateTime? LastAttemptAt { get; set; }

        [JsonProperty(PropertyName = "fileName")]
        public string FileName { get; set; }

        [JsonProperty(PropertyName = "blobUrl")]
        public string BlobUrl { get; set; }

        [JsonProperty(PropertyName = "messageType")]
        public string MessageType { get; set; } = "PowerPointUploaded";

        [JsonProperty(PropertyName = "ttl")]
        public int? TimeToLive { get; set; } = 7 * 24 * 60 * 60; // 7 days in seconds
    }
}