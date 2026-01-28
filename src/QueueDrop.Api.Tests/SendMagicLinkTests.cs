using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;

namespace QueueDrop.Api.Tests;

public class SendMagicLinkTests : IntegrationTestBase
{
    [Fact]
    public async Task SendMagicLink_WithValidEmail_ShouldReturn200()
    {
        // Act
        var response = await Client.PostAsJsonAsync("/api/auth/send-magic-link", new { email = "newuser@example.com" });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task SendMagicLink_ShouldCreateMagicLinkInDatabase()
    {
        // Arrange
        var email = "test@example.com";

        // Act
        await Client.PostAsJsonAsync("/api/auth/send-magic-link", new { email });

        // Assert
        await using var scope = ServiceProvider.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<TestAppDbContext>();
        var link = db.MagicLinks.FirstOrDefault(l => l.Email == email);

        link.Should().NotBeNull();
        link!.Token.Should().HaveLength(64);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("invalid-email")]
    public async Task SendMagicLink_WithInvalidEmail_ShouldReturn400(string? email)
    {
        // Act
        var response = await Client.PostAsJsonAsync("/api/auth/send-magic-link", new { email });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }
}
