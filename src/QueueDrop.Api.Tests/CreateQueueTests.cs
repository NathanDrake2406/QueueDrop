using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;

namespace QueueDrop.Api.Tests;

public class CreateQueueTests : IntegrationTestBase
{
    [Fact]
    public async Task CreateQueue_AsOwner_ShouldReturn201()
    {
        // Arrange
        var (token, businessSlug) = await SetupOwnerWithBusiness("owner@test.com", "my-shop");
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        // Act
        var response = await Client.PostAsJsonAsync($"/api/business/{businessSlug}/queues", new
        {
            name = "Second Queue",
            slug = "second-queue"
        });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var result = await response.Content.ReadFromJsonAsync<CreateQueueResponse>();
        result!.Name.Should().Be("Second Queue");
        result.Slug.Should().Be("second-queue");
    }

    [Fact]
    public async Task CreateQueue_WithAdvancedSettings_ShouldSaveSettings()
    {
        // Arrange
        var (token, businessSlug) = await SetupOwnerWithBusiness("owner@test.com", "my-shop");
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        // Act
        var response = await Client.PostAsJsonAsync($"/api/business/{businessSlug}/queues", new
        {
            name = "VIP Queue",
            slug = "vip",
            maxQueueSize = 20,
            estimatedServiceTimeMinutes = 10
        });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);

        await using var scope = ServiceProvider.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<TestAppDbContext>();
        var queue = db.Queues.First(q => q.Slug == "vip");
        queue.Settings.MaxQueueSize.Should().Be(20);
        queue.Settings.EstimatedServiceTimeMinutes.Should().Be(10);
    }

    [Fact]
    public async Task CreateQueue_AsNonOwner_ShouldReturn403()
    {
        // Arrange
        var (_, businessSlug) = await SetupOwnerWithBusiness("owner@test.com", "my-shop");
        var staffToken = await GetAuthToken("staff@test.com");
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", staffToken);

        // Act
        var response = await Client.PostAsJsonAsync($"/api/business/{businessSlug}/queues", new
        {
            name = "New Queue"
        });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task CreateQueue_WithDuplicateSlug_ShouldReturn409()
    {
        // Arrange
        var (token, businessSlug) = await SetupOwnerWithBusiness("owner@test.com", "my-shop");
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        await Client.PostAsJsonAsync($"/api/business/{businessSlug}/queues", new { name = "First", slug = "same-slug" });

        // Act
        var response = await Client.PostAsJsonAsync($"/api/business/{businessSlug}/queues", new { name = "Second", slug = "same-slug" });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task CreateQueue_WithoutAuth_ShouldReturn401()
    {
        // Act
        Client.DefaultRequestHeaders.Authorization = null;
        var response = await Client.PostAsJsonAsync("/api/business/my-shop/queues", new
        {
            name = "Queue"
        });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task CreateQueue_WithoutSlug_ShouldAutoGenerate()
    {
        // Arrange
        var (token, businessSlug) = await SetupOwnerWithBusiness("owner@test.com", "my-shop");
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        // Act
        var response = await Client.PostAsJsonAsync($"/api/business/{businessSlug}/queues", new
        {
            name = "Walk In Line"
        });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var result = await response.Content.ReadFromJsonAsync<CreateQueueResponse>();
        result!.Slug.Should().Be("walk-in-line");
    }

    [Fact]
    public async Task CreateQueue_ForNonexistentBusiness_ShouldReturn404()
    {
        // Arrange
        var token = await GetAuthToken("owner@test.com");
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        // Act
        var response = await Client.PostAsJsonAsync("/api/business/nonexistent-business/queues", new
        {
            name = "Queue"
        });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    private async Task<(string Token, string BusinessSlug)> SetupOwnerWithBusiness(string email, string slug)
    {
        var token = await GetAuthToken(email);
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        await Client.PostAsJsonAsync("/api/business", new { name = slug, slug });
        return (token, slug);
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
    private record CreateQueueResponse(Guid Id, string Name, string Slug);
}
