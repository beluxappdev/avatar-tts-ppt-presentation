using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using Azure.Core.Serialization;
using Newtonsoft.Json;

namespace PptProcessingApi.Models
{
    // Request model for video generation
    public class VideoGenerationRequest
    {
        [Required]
        public string PptId { get; set; }
        
        [Required]
        public List<SlideVideoRequest> Slides { get; set; } = new List<SlideVideoRequest>();
    }

    public class SlideVideoRequest
    {
        [Required]
        public int Index { get; set; }
        
        public string Script { get; set; }
        
        [Required]
        public AvatarConfiguration AvatarConfig { get; set; }
    }

    public class AvatarConfiguration
    {
        public bool ShowAvatar { get; set; } = true;
        public string AvatarPosition { get; set; } = "right"; // left, center, right
        public string AvatarSize { get; set; } = "medium"; // small, medium, large
        public string AvatarType { get; set; } = "meg"; // meg, harry
    }

    // Message model for Service Bus
    public class SlideVideoGenerationMessage
    {
        public string JobId { get; set; }
        public string PptId { get; set; }
        public int SlideNumber { get; set; }
        public string Script { get; set; }
        public AvatarConfiguration AvatarConfig { get; set; }
        public string UserId { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
    }
}