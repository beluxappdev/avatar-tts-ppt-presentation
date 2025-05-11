using Microsoft.AspNetCore.SignalR;
using PptProcessingApi.Hubs;
using System.Threading.Tasks;

namespace PptProcessingApi.Services
{
    public class SignalRService
    {
        private readonly IHubContext<ProcessingStatusHub> _hubContext;

        public SignalRService(IHubContext<ProcessingStatusHub> hubContext)
        {
            _hubContext = hubContext;
        }

        public async Task SendStatusUpdateAsync(string pptId, string status, string detail = "None")
        {
            await _hubContext.Clients.Group(pptId).SendAsync("ReceiveStatusUpdate", new
            {
                pptId,
                status,
                detail,
                timestamp = DateTime.UtcNow
            });
        }

        public async Task SendProcessingProgressAsync(string pptId, string processingType, string status)
        {
            await _hubContext.Clients.Group(pptId).SendAsync("ReceiveProcessingUpdate", new
            {
                pptId,
                processingType,
                status,
                timestamp = DateTime.UtcNow
            });
        }
    }
}