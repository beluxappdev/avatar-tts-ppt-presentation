using Newtonsoft.Json;
using System;

namespace PptProcessingApi.Models
{
        public class SlideModel
    {
        [JsonProperty(PropertyName = "index")]
        public int Index { get; set; }
        
        [JsonProperty(PropertyName = "blobUrl")]
        public string BlobUrl { get; set; }
        
        [JsonProperty(PropertyName = "script")]
        public string Script { get; set; }
    }
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

        [JsonProperty(PropertyName = "imageProcessingStatus")]
        public string ImageProcessingStatus { get; set; } = "Pending"; // Pending, Processing, Completed, Failed
        
        [JsonProperty(PropertyName = "scriptProcessingStatus")]
        public string ScriptProcessingStatus { get; set; } = "Pending"; // Pending, Processing, Completed, Failed
        
        [JsonProperty(PropertyName = "imageProcessedAt")]
        public DateTime? ImageProcessedAt { get; set; }
        
        [JsonProperty(PropertyName = "scriptProcessedAt")]
        public DateTime? ScriptProcessedAt { get; set; }
        
        [JsonProperty(PropertyName = "imageProcessingError")]
        public string ImageProcessingError { get; set; }
        
        [JsonProperty(PropertyName = "scriptProcessingError")]
        public string ScriptProcessingError { get; set; }

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

        [JsonProperty(PropertyName = "slides")]
        public List<SlideModel> Slides { get; set; } = new List<SlideModel>();

        [JsonProperty(PropertyName = "messageType")]
        public string MessageType { get; set; } = "PowerPointUploaded";

        [JsonProperty(PropertyName = "ttl")]
        public int? TimeToLive { get; set; } = 7 * 24 * 60 * 60; // 7 days in seconds
    }
}