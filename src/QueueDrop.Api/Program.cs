using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using QueueDrop.Api.Auth;
using QueueDrop.Api.BackgroundServices;
using QueueDrop.Api.Features.Auth;
using QueueDrop.Api.Features.Customers;
using QueueDrop.Api.Features.Demo;
using QueueDrop.Api.Features.Push;
using QueueDrop.Api.Features.Queues;
using QueueDrop.Domain.Abstractions;
using QueueDrop.Infrastructure.Persistence;
using QueueDrop.Infrastructure.PushNotifications;
using QueueDrop.Infrastructure.SignalR;

var builder = WebApplication.CreateBuilder(args);

// JSON serialization - use camelCase for JavaScript frontend compatibility
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
});

// Database
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// SignalR - configure with camelCase for JavaScript compatibility
builder.Services.AddSignalR()
    .AddJsonProtocol(options =>
    {
        options.PayloadSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
    });
builder.Services.AddScoped<IQueueHubNotifier, QueueHubNotifier>();

// Time provider (injectable for testing)
builder.Services.AddSingleton(TimeProvider.System);

// JWT Authentication
builder.Services.Configure<JwtOptions>(builder.Configuration.GetSection(JwtOptions.SectionName));
builder.Services.AddSingleton<IJwtTokenService, JwtTokenService>();

// CORS - configurable for production
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
    ?? ["http://localhost:5173", "http://localhost:3000"];

builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        policy.WithOrigins(allowedOrigins)
            .AllowAnyMethod()
            .AllowAnyHeader()
            .AllowCredentials();
    });
});

// OpenAPI/Swagger
builder.Services.AddEndpointsApiExplorer();

// Background services
builder.Services.AddHostedService<AutoNoShowService>();

// Web Push
builder.Services.Configure<VapidOptions>(builder.Configuration.GetSection(VapidOptions.SectionName));
builder.Services.AddSingleton<IWebPushService, WebPushService>();

var app = builder.Build();

// Configure pipeline
app.UseCors("Frontend");

// Health check
app.MapGet("/", () => "QueueDrop API");
app.MapGet("/health", () => Results.Ok(new { status = "healthy", timestamp = DateTimeOffset.UtcNow }));

// Feature endpoints (vertical slices)
JoinQueue.MapEndpoint(app);
GetPosition.MapEndpoint(app);
CallNext.MapEndpoint(app);
GetSettings.MapEndpoint(app);
UpdateSettings.MapEndpoint(app);
GetQueueCustomers.MapEndpoint(app);
MarkServed.MapEndpoint(app);
MarkNoShow.MapEndpoint(app);
RemoveCustomer.MapEndpoint(app);
GetQueueByBusiness.MapEndpoint(app);
GetBusinessQueues.MapEndpoint(app);
SavePushSubscription.MapEndpoint(app);
GetVapidPublicKey.MapEndpoint(app);

// Auth endpoints
SendMagicLink.MapEndpoint(app);
VerifyMagicLink.MapEndpoint(app);

// Demo endpoints (enabled for portfolio demo)
SeedDemoData.MapEndpoint(app);

// SignalR hub
app.MapHub<QueueHub>("/hubs/queue");

// Apply migrations on startup
var runMigrations = app.Configuration.GetValue<bool>("RunMigrationsOnStartup", app.Environment.IsDevelopment());
if (runMigrations)
{
    await using var scope = app.Services.CreateAsyncScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.MigrateAsync();
}

app.Run();

// Make Program accessible for integration tests
public partial class Program { }
