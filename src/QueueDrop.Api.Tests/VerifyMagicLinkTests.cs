using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;

namespace QueueDrop.Api.Tests;

public class VerifyMagicLinkTests : IntegrationTestBase
{
    [Fact]
    public async Task VerifyMagicLink_WithValidToken_ShouldReturnJwt()
    {
        // Arrange
        var email = "newuser@example.com";
        await Client.PostAsJsonAsync("/api/auth/send-magic-link", new { email });

        await using var scope = ServiceProvider.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<TestAppDbContext>();
        var magicLink = db.MagicLinks.First(l => l.Email == email);

        // Act
        var response = await Client.GetAsync($"/api/auth/verify?token={magicLink.Token}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var result = await response.Content.ReadFromJsonAsync<VerifyResponse>();
        result.Should().NotBeNull();
        result!.Token.Should().NotBeNullOrEmpty();
        result.Email.Should().Be(email);
        result.IsNewUser.Should().BeTrue();
    }

    [Fact]
    public async Task VerifyMagicLink_ShouldCreateUserIfNotExists()
    {
        // Arrange
        var email = "brand-new@example.com";
        await Client.PostAsJsonAsync("/api/auth/send-magic-link", new { email });

        await using var scope = ServiceProvider.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<TestAppDbContext>();
        var magicLink = db.MagicLinks.First(l => l.Email == email);

        // Act
        await Client.GetAsync($"/api/auth/verify?token={magicLink.Token}");

        // Assert
        db.ChangeTracker.Clear();
        var user = db.Users.FirstOrDefault(u => u.Email == email);
        user.Should().NotBeNull();
    }

    [Fact]
    public async Task VerifyMagicLink_WithInvalidToken_ShouldReturn400()
    {
        // Act
        var response = await Client.GetAsync("/api/auth/verify?token=invalid-token");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task VerifyMagicLink_WithUsedToken_ShouldReturn400()
    {
        // Arrange
        var email = "test@example.com";
        await Client.PostAsJsonAsync("/api/auth/send-magic-link", new { email });

        await using var scope = ServiceProvider.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<TestAppDbContext>();
        var magicLink = db.MagicLinks.First(l => l.Email == email);

        // Use it once
        await Client.GetAsync($"/api/auth/verify?token={magicLink.Token}");

        // Act - try to use it again
        var response = await Client.GetAsync($"/api/auth/verify?token={magicLink.Token}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    private record VerifyResponse(string Token, Guid UserId, string Email, bool IsNewUser);
}
