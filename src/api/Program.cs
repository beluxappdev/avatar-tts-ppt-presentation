using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using PptProcessingApi.Services;

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

// Register services
builder.Services.AddSingleton<BlobStorageService>();
builder.Services.AddSingleton<CosmosDbService>();
builder.Services.AddSingleton<ServiceBusService>();
builder.Services.AddHostedService<OutboxProcessorService>();

// Configure logging
builder.Logging.ClearProviders();
builder.Logging.AddConsole();
builder.Logging.AddDebug();
builder.Logging.SetMinimumLevel(LogLevel.Information);

var app = builder.Build();

// Enable CORS
app.UseCors(builder => builder
    .AllowAnyOrigin()
    .AllowAnyMethod()
    .AllowAnyHeader());

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

// Add a simple test endpoint
app.MapGet("/", () => "API is running!");

app.Run();