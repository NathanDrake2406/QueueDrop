using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;

namespace QueueDrop.Api.Tests;

public class DeleteQueueTests : IntegrationTestBase
{
    [Fact]
    public async Task DeleteQueue_AsOwner_ShouldReturn204()
    {
        // Arrange
        var (token, businessSlug, queueSlug) = await SetupOwnerWithQueue("owner@test.com", "my-shop", "to-delete");
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        // Act
        var response = await Client.DeleteAsync($"/api/business/{businessSlug}/queues/{queueSlug}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);

        await using var scope = ServiceProvider.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<TestAppDbContext>();
        db.Queues.Any(q => q.Slug == queueSlug).Should().BeFalse();
    }

    [Fact]
    public async Task DeleteQueue_AsNonOwner_ShouldReturn403()
    {
        // Arrange
        var (_, businessSlug, queueSlug) = await SetupOwnerWithQueue("owner@test.com", "my-shop", "main");
        var otherToken = await GetAuthToken("other@test.com");
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", otherToken);

        // Act
        var response = await Client.DeleteAsync($"/api/business/{businessSlug}/queues/{queueSlug}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task DeleteQueue_NonexistentQueue_ShouldReturn404()
    {
        // Arrange
        var (token, businessSlug, _) = await SetupOwnerWithQueue("owner@test.com", "my-shop", "main");
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        // Act
        var response = await Client.DeleteAsync($"/api/business/{businessSlug}/queues/nonexistent");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task DeleteQueue_WithoutAuth_ShouldReturn401()
    {
        // Act
        Client.DefaultRequestHeaders.Authorization = null;
        var response = await Client.DeleteAsync("/api/business/my-shop/queues/main");

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
