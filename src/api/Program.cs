using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using PptProcessingApi.Services;
using PptProcessingApi.Hubs;

var builder = WebApplication.CreateBuilder(args);

// Configure listening URLs explicitly
builder.WebHost.ConfigureKestrel(serverOptions =>
{
    serverOptions.ListenAnyIP(80);
});

// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddSignalR();

// Register services
builder.Services.AddSingleton<AzureCredentialService>();
builder.Services.AddSingleton<BlobStorageService>();
builder.Services.AddSingleton<CosmosDbService>();
builder.Services.AddSingleton<ServiceBusService>();
builder.Services.AddHostedService<OutboxProcessorService>();
builder.Services.AddSingleton<SignalRService>();

// Configure logging
builder.Logging.ClearProviders();
builder.Logging.AddConsole();
builder.Logging.AddDebug();
builder.Logging.SetMinimumLevel(LogLevel.Information);

var app = builder.Build();

app.UseStaticFiles();

// Enable CORS
app.UseCors(builder => builder
    .SetIsOriginAllowed(_ => true) // For testing, allow any origin
    .AllowAnyMethod()
    .AllowAnyHeader()
    .AllowCredentials()); // Important for SignalR

// Configure the HTTP request pipeline.
app.UseSwagger();
app.UseSwaggerUI();

// Simple middleware to log all requests
app.Use(async (context, next) =>
{
    var logger = context.RequestServices.GetRequiredService<ILogger<Program>>();
    logger.LogInformation($"Request received: {context.Request.Method} {context.Request.Path}");
    await next.Invoke();
    logger.LogInformation($"Request completed: {context.Response.StatusCode}");
});

app.UseRouting();
app.UseAuthorization();

app.MapControllers();
app.MapHub<ProcessingStatusHub>("/processingStatusHub");

// Add a simple test endpoint
app.MapGet("/", () => "API is running!");

var cosmosDbService = app.Services.GetRequiredService<CosmosDbService>();
await cosmosDbService.StartChangeProcessorAsync("leaseContainer");

app.Run();