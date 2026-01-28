using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;

namespace QueueDrop.Api.Tests;

public class UpdateQueueTests : IntegrationTestBase
{
    [Fact]
    public async Task UpdateQueue_AsOwner_ShouldReturn200()
    {
        // Arrange
        var (token, businessSlug, queueSlug) = await SetupOwnerWithQueue("owner@test.com", "my-shop", "main");
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        // Act
        var response = await Client.PutAsJsonAsync($"/api/business/{businessSlug}/queues/{queueSlug}", new
        {
            name = "Updated Queue Name",
            maxQueueSize = 50
        });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        await using var scope = ServiceProvider.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<TestAppDbContext>();
        var queue = db.Queues.First(q => q.Slug == queueSlug);
        queue.Name.Should().Be("Updated Queue Name");
        queue.Settings.MaxQueueSize.Should().Be(50);
    }

    [Fact]
    public async Task UpdateQueue_AsNonOwner_ShouldReturn403()
    {
        // Arrange
        var (_, businessSlug, queueSlug) = await SetupOwnerWithQueue("owner@test.com", "my-shop", "main");
        var staffToken = await GetAuthToken("other@test.com");
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", staffToken);

        // Act
        var response = await Client.PutAsJsonAsync($"/api/business/{businessSlug}/queues/{queueSlug}", new
        {
            name = "Hacked Name"
        });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task UpdateQueue_WithPartialSettings_ShouldOnlyUpdateProvided()
    {
        // Arrange
        var (token, businessSlug, queueSlug) = await SetupOwnerWithQueue("owner@test.com", "my-shop", "main");
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        // First set some initial settings
        await Client.PutAsJsonAsync($"/api/business/{businessSlug}/queues/{queueSlug}", new
        {
            maxQueueSize = 100,
            estimatedServiceTimeMinutes = 15
        });

        // Act - update only maxQueueSize
        var response = await Client.PutAsJsonAsync($"/api/business/{businessSlug}/queues/{queueSlug}", new
        {
            maxQueueSize = 50
        });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        await using var scope = ServiceProvider.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<TestAppDbContext>();
        var queue = db.Queues.First(q => q.Slug == queueSlug);
        queue.Settings.MaxQueueSize.Should().Be(50);
        queue.Settings.EstimatedServiceTimeMinutes.Should().Be(15); // unchanged
    }

    [Fact]
    public async Task UpdateQueue_WithMessages_ShouldUpdateMessages()
    {
        // Arrange
        var (token, businessSlug, queueSlug) = await SetupOwnerWithQueue("owner@test.com", "my-shop", "main");
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        // Act
        var response = await Client.PutAsJsonAsync($"/api/business/{businessSlug}/queues/{queueSlug}", new
        {
            welcomeMessage = "Welcome to our queue!",
            calledMessage = "It's your turn!"
        });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        await using var scope = ServiceProvider.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<TestAppDbContext>();
        var queue = db.Queues.First(q => q.Slug == queueSlug);
        queue.Settings.WelcomeMessage.Should().Be("Welcome to our queue!");
        queue.Settings.CalledMessage.Should().Be("It's your turn!");
    }

    [Fact]
    public async Task UpdateQueue_NonexistentQueue_ShouldReturn404()
    {
        // Arrange
        var (token, businessSlug, _) = await SetupOwnerWithQueue("owner@test.com", "my-shop", "main");
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        // Act
        var response = await Client.PutAsJsonAsync($"/api/business/{businessSlug}/queues/nonexistent", new
        {
            name = "New Name"
        });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task UpdateQueue_WithoutAuth_ShouldReturn401()
    {
        // Act
        Client.DefaultRequestHeaders.Authorization = null;
        var response = await Client.PutAsJsonAsync("/api/business/my-shop/queues/main", new
        {
            name = "Queue"
        });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    private async Task<(string Token, string BusinessSlug, string QueueSlug)> SetupOwnerWithQueue(string email, string bizSlug, string queueSlug)
    {
        var token = await GetAuthToken(email);
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        await Client.PostAsJsonAsync("/api/business", new { name = bizSlug, slug = bizSlug });
        await Client.PostAsJsonAsync($"/api/business/{bizSlug}/queues", new { name = queueSlug, slug = queueSlug });
        return (token, bizSlug, queueSlug);
    }

    private async Task<string> GetAuthToken(string email)
    {
        await Client.PostAsJsonAsync("/api/auth/send-magic-link", new { email });
        await using var scope = ServiceProvider.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<TestAppDbContext>();
        var magicLink = db.MagicLinks.OrderByDescending(l => l.CreatedAt).First(l => l.Email == email);
        var verifyResponse = await Client.GetFromJsonAsync<VerifyResponse>($"/api/auth/verify?token={magicLink.Token}");
        return verifyResponse!.Token;
    }

    private record VerifyResponse(string Token, Guid UserId, string Email, bool IsNewUser);
}
