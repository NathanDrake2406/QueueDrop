using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using QueueDrop.Domain.Common;
using QueueDrop.Domain.Entities;
using QueueDrop.Infrastructure.Persistence;

namespace QueueDrop.Api.Tests;

/// <summary>
/// Base class for integration tests. Each test class gets its own isolated InMemory database.
/// Uses TestAppDbContext which disables concurrency tokens for InMemory compatibility.
/// </summary>
public abstract class IntegrationTestBase : IAsyncLifetime
{
    private static readonly DateTimeOffset FixedTime = new(2024, 1, 15, 12, 0, 0, TimeSpan.Zero);

    protected static readonly Guid TestBusinessId = new("11111111-1111-1111-1111-111111111111");
    protected static readonly Guid TestQueueId = new("22222222-2222-2222-2222-222222222222");
    protected const string TestBusinessSlug = "demo-shop";
    protected const string TestBusinessName = "Demo Shop";
    protected const string TestQueueName = "Main Queue";

    private readonly WebApplicationFactory<Program> _factory;
    private readonly string _databaseName = $"TestDb_{Guid.NewGuid()}";
    protected HttpClient Client { get; private set; } = null!;
    protected IServiceProvider ServiceProvider => _factory.Services;

    protected IntegrationTestBase()
    {
        _factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.ConfigureServices(services =>
                {
                    // Remove all DbContext registrations (both generic and concrete types)
                    var descriptorsToRemove = services
                        .Where(d =>
                            d.ServiceType == typeof(DbContextOptions<AppDbContext>) ||
                            d.ServiceType == typeof(DbContextOptions<TestAppDbContext>) ||
                            d.ServiceType == typeof(AppDbContext) ||
                            d.ServiceType == typeof(TestAppDbContext))
                        .ToList();
                    foreach (var d in descriptorsToRemove)
                        services.Remove(d);

                    // Register TestAppDbContext with InMemory database
                    // TestAppDbContext disables concurrency tokens for InMemory compatibility
                    services.AddDbContext<TestAppDbContext>((sp, options) =>
                    {
                        options.UseInMemoryDatabase(_databaseName);
                        options.EnableSensitiveDataLogging();
                        options.ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning));
                    });

                    // Also register as AppDbContext so DI can resolve it for handlers
                    services.AddScoped<AppDbContext>(sp => sp.GetRequiredService<TestAppDbContext>());

                    // Use fake TimeProvider for deterministic tests
                    services.RemoveAll<TimeProvider>();
                    services.AddSingleton<TimeProvider>(new FakeTimeProvider(FixedTime));
                });

                builder.UseEnvironment("Testing");
            });
    }

    public async Task InitializeAsync()
    {
        Client = _factory.CreateClient();

        await using var scope = _factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<TestAppDbContext>();

        // Delete existing data and recreate
        await db.Database.EnsureDeletedAsync();

        // Seed data manually through the change tracker
        await SeedTestDataAsync(db);

        // Allow derived classes to seed additional data
        await SeedAdditionalDataAsync(db);
    }

    /// <summary>
    /// Override to seed additional test data for specific test scenarios.
    /// </summary>
    protected virtual Task SeedAdditionalDataAsync(TestAppDbContext db) => Task.CompletedTask;

    private static async Task SeedTestDataAsync(TestAppDbContext db)
    {
        // Create business through domain factory (properly tracked)
        var business = Business.Create(
            TestBusinessName,
            TestBusinessSlug,
            FixedTime,
            "A demo business for testing QueueDrop");

        // Set predictable ID via reflection
        typeof(Entity).GetProperty(nameof(Entity.Id))!.SetValue(business, TestBusinessId);
        db.Businesses.Add(business);

        // Create queue through domain factory (properly tracked)
        var queue = Queue.Create(
            TestBusinessId,
            TestQueueName,
            "test-queue",
            FixedTime);

        // Set predictable ID via reflection
        typeof(Entity).GetProperty(nameof(Entity.Id))!.SetValue(queue, TestQueueId);
        db.Queues.Add(queue);

        await db.SaveChangesAsync();

        // Detach all tracked entities so subsequent operations get fresh tracking
        db.ChangeTracker.Clear();
    }

    public async Task DisposeAsync()
    {
        Client.Dispose();
        await _factory.DisposeAsync();
    }

    protected Task<Guid> GetTestQueueId() => Task.FromResult(TestQueueId);

    protected async Task<string> JoinQueueAndGetToken(string name = "Test Customer")
    {
        var response = await Client.PostAsJsonAsync($"/api/join/{TestBusinessSlug}", new { name });
        response.EnsureSuccessStatusCode();
        var result = await response.Content.ReadFromJsonAsync<JoinQueueResponse>();
        return result!.Token;
    }

    protected record JoinQueueResponse(string Token, int Position, string QueueName, string QueueSlug);
}

/// <summary>
/// Fake TimeProvider for deterministic testing.
/// </summary>
public sealed class FakeTimeProvider : TimeProvider
{
    private DateTimeOffset _now;

    public FakeTimeProvider(DateTimeOffset initialTime)
    {
        _now = initialTime;
    }

    public override DateTimeOffset GetUtcNow() => _now;

    public void Advance(TimeSpan duration) => _now = _now.Add(duration);
}
