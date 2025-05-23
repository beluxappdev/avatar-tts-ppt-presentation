using Azure.Core;
using Azure.Identity;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System;

namespace PptProcessingApi.Services
{
    public class AzureCredentialService
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<AzureCredentialService> _logger;

        public AzureCredentialService(IConfiguration configuration, ILogger<AzureCredentialService> logger)
        {
            _configuration = configuration;
            _logger = logger;
        }

        public TokenCredential GetTokenCredential()
        {
            // Check environment variable to determine if we're running in Azure
            var isRunningInAzure = string.Equals(
                _configuration["ENVIRONMENT"], 
                "Azure", 
                StringComparison.OrdinalIgnoreCase);
            
            if (isRunningInAzure)
            {
                _logger.LogInformation("Using DefaultAzureCredential for authentication");
                
                // Get the managed identity client ID if specified (for user-assigned managed identity)
                var managedIdentityClientId = _configuration["AzureServices:ManagedIdentity:ClientId"];
                
                if (!string.IsNullOrEmpty(managedIdentityClientId))
                {
                    _logger.LogInformation("Using user-assigned managed identity with client ID: {ClientId}", 
                        managedIdentityClientId);
                    
                    var options = new DefaultAzureCredentialOptions
                    {
                        ManagedIdentityClientId = managedIdentityClientId
                    };
                    
                    return new DefaultAzureCredential(options);
                }
                else
                {
                    _logger.LogInformation("Using system-assigned managed identity or default credential chain");
                    return new DefaultAzureCredential();
                }
            }
            else
            {
                _logger.LogInformation("Using service principal credentials for local development");
                
                // Use service principal authentication for local development
                var tenantId = _configuration["AzureAd:TenantId"]
                            ?? throw new InvalidOperationException("TenantId is missing in configuration.");
                var clientId = _configuration["AzureAd:ClientId"]
                            ?? throw new InvalidOperationException("ClientId is missing in configuration.");
                var clientSecret = _configuration["AzureAd:ClientSecret"]
                            ?? throw new InvalidOperationException("ClientSecret is missing in configuration.");
                
                return new ClientSecretCredential(tenantId, clientId, clientSecret);
            }
        }
    }
}