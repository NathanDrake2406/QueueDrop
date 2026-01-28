using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;

namespace QueueDrop.Api.Tests;

public class GetMeTests : IntegrationTestBase
{
    [Fact]
    public async Task GetMe_WithValidToken_ShouldReturnUserInfo()
    {
        // Arrange - create user via magic link flow
        var email = "authuser@example.com";
        await Client.PostAsJsonAsync("/api/auth/send-magic-link", new { email });

        await using var scope = ServiceProvider.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<TestAppDbContext>();
        var magicLink = db.MagicLinks.First(l => l.Email == email);

        var verifyResponse = await Client.GetFromJsonAsync<VerifyResponse>($"/api/auth/verify?token={magicLink.Token}");

        // Act
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", verifyResponse!.Token);
        var response = await Client.GetAsync("/api/auth/me");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var result = await response.Content.ReadFromJsonAsync<MeResponse>();
        result.Should().NotBeNull();
        result!.Email.Should().Be(email);
        result.UserId.Should().Be(verifyResponse.UserId);
    }

    [Fact]
    public async Task GetMe_WithoutToken_ShouldReturn401()
    {
        // Act
        Client.DefaultRequestHeaders.Authorization = null;
        var response = await Client.GetAsync("/api/auth/me");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetMe_WithInvalidToken_ShouldReturn401()
    {
        // Act
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", "invalid-token");
        var response = await Client.GetAsync("/api/auth/me");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    private record VerifyResponse(string Token, Guid UserId, string Email, bool IsNewUser);
    private record MeResponse(Guid UserId, string Email, BusinessInfo? Business);
    private record BusinessInfo(Guid Id, string Name, string Slug, string Role);
}
