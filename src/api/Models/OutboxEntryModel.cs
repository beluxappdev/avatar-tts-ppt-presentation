using Newtonsoft.Json;
using System;
using System.Collections.Generic;

namespace PptProcessingApi.Models
{
    public class SlideModel
    {
        [JsonProperty("index")]
        public int Index { get; set; }
        
        [JsonProperty("hasImage")]
        public bool HasImage { get; set; }
        
        [JsonProperty("hasScript")]
        public bool HasScript { get; set; }
        
        [JsonProperty("scriptUrl")]
        public string ScriptUrl { get; set; }
        
        [JsonProperty("scriptSize")]
        public long? ScriptSize { get; set; }
        
        [JsonProperty("scriptContent")]
        public string ScriptContent { get; set; }
        
        [JsonProperty("imageUrl")]
        public string ImageUrl { get; set; }
        
        [JsonProperty("imageSize")]
        public long? ImageSize { get; set; }
        
        [JsonProperty("imageType")]
        public string ImageType { get; set; }
        
        [JsonProperty("blobUrl")]
        public string BlobUrl { get; set; }
        
        [JsonProperty("script")]
        public string Script { get; set; }
    }

    public class OutboxEntryModel
    {
        [JsonProperty("id")]
        public string Id { get; set; }

        [JsonProperty("userId")]
        public string UserId { get; set; }
        
        // This is the partition key but using a separate property for clarity
        public string PartitionKey => UserId;

        [JsonProperty("type")]
        public string Type { get; set; } = "outboxEntry";

        [JsonProperty("status")]
        public string Status { get; set; } = "Pending"; // Pending, Processing, Completed, Failed

        [JsonProperty("imageProcessingStatus")]
        public string ImageProcessingStatus { get; set; } = "Pending"; // Pending, Processing, Completed, Failed
        
        [JsonProperty("scriptProcessingStatus")]
        public string ScriptProcessingStatus { get; set; } = "Pending"; // Pending, Processing, Completed, Failed

        [JsonProperty("videoProcessingStatus")]
        public string VideoProcessingStatus { get; set; } = "NotReady"; // NotReady, Pending, Processing, Completed, Failed
        
        [JsonProperty("imageProcessedAt")]
        public DateTime? ImageProcessedAt { get; set; }
        
        [JsonProperty("scriptProcessedAt")]
        public DateTime? ScriptProcessedAt { get; set; }

        [JsonProperty("videoProcessedAt")]
        public DateTime? VideoProcessedAt { get; set; }
        
        [JsonProperty("imageProcessingError")]
        public string ImageProcessingError { get; set; }
        
        [JsonProperty("scriptProcessingError")]
        public string ScriptProcessingError { get; set; }

        [JsonProperty("createdAt")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [JsonProperty("processedAt")]
        public DateTime? ProcessedAt { get; set; }

        [JsonProperty("completedAt")]
        public DateTime? CompletedAt { get; set; }

        [JsonProperty("failedAt")]
        public DateTime? FailedAt { get; set; }

        [JsonProperty("retryCount")]
        public int RetryCount { get; set; } = 0;

        [JsonProperty("errorDetails")]
        public string ErrorDetails { get; set; }

        [JsonProperty("lastAttemptAt")]
        public DateTime? LastAttemptAt { get; set; }

        [JsonProperty("fileName")]
        public string FileName { get; set; }

        [JsonProperty("blobUrl")]
        public string BlobUrl { get; set; }

        [JsonProperty("slideCount")]
        public int SlideCount { get; set; }

        [JsonProperty("slides")]
        public List<SlideModel> Slides { get; set; } = new List<SlideModel>();

        [JsonProperty("messageType")]
        public string MessageType { get; set; } = "PowerPointUploaded";

        [JsonProperty("ttl")]
        public int? TimeToLive { get; set; } = 7 * 24 * 60 * 60; // 7 days in seconds
        
        // Video processing related properties (for future use)
        [JsonProperty("videoJobId")]
        public string VideoJobId { get; set; }

        [JsonProperty("videoTotalSlides")]
        public int VideoTotalSlides { get; set; }

        [JsonProperty("videoCompletedSlides")]
        public int VideoCompletedSlides { get; set; }

        [JsonProperty("videoFailedSlides")]
        public int VideoFailedSlides { get; set; }

        [JsonProperty("videoUrl")]
        public string VideoUrl { get; set; }

        [JsonProperty("videoStartedAt")]
        public DateTime? VideoStartedAt { get; set; }

        [JsonProperty("videoCompletedAt")]
        public DateTime? VideoCompletedAt { get; set; }

        [JsonProperty("videoErrorMessage")]
        public string VideoErrorMessage { get; set; }
    }
}