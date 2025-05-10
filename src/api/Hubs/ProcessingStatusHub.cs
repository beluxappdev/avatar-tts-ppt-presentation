using Microsoft.AspNetCore.SignalR;
using System.Threading.Tasks;

namespace PptProcessingApi.Hubs
{
    public class ProcessingStatusHub : Hub
    {
        // Method to allow clients to subscribe to updates for a specific PowerPoint
        public async Task SubscribeToPptUpdates(string pptId)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, pptId);
        }

        // Method to allow clients to unsubscribe from updates
        public async Task UnsubscribeFromPptUpdates(string pptId)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, pptId);
        }
    }
}