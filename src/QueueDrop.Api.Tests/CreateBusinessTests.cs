using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using QueueDrop.Domain.Enums;

namespace QueueDrop.Api.Tests;

public class CreateBusinessTests : IntegrationTestBase
{
    [Fact]
    public async Task CreateBusiness_WithValidData_ShouldReturn201()
    {
        // Arrange
        var token = await GetAuthToken("owner@example.com");
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        // Act
        var response = await Client.PostAsJsonAsync("/api/business", new
        {
            name = "My Coffee Shop",
            slug = "my-coffee-shop"
        });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);

        var result = await response.Content.ReadFromJsonAsync<CreateBusinessResponse>();
        result.Should().NotBeNull();
        result!.Name.Should().Be("My Coffee Shop");
        result.Slug.Should().Be("my-coffee-shop");
    }

    [Fact]
    public async Task CreateBusiness_ShouldMakeUserOwner()
    {
        // Arrange
        var email = "newowner@example.com";
        var token = await GetAuthToken(email);
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        // Act
        await Client.PostAsJsonAsync("/api/business", new { name = "Test Shop", slug = "test-shop" });

        // Assert
        await using var scope = ServiceProvider.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<TestAppDbContext>();
        var user = db.Users.First(u => u.Email == email);
        var membership = db.BusinessMembers.First(bm => bm.UserId == user.Id);

        membership.Role.Should().Be(BusinessRole.Owner);
        membership.JoinedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task CreateBusiness_WithDuplicateSlug_ShouldReturn409()
    {
        // Arrange - create first business
        var token = await GetAuthToken("first@example.com");
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        await Client.PostAsJsonAsync("/api/business", new { name = "First Shop", slug = "unique-slug" });

        // Create second user and try same slug
        var token2 = await GetAuthToken("second@example.com");
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token2);

        // Act
        var response = await Client.PostAsJsonAsync("/api/business", new { name = "Second Shop", slug = "unique-slug" });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task CreateBusiness_WithoutAuth_ShouldReturn401()
    {
        // Act
        Client.DefaultRequestHeaders.Authorization = null;
        var response = await Client.PostAsJsonAsync("/api/business", new { name = "Shop", slug = "shop" });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
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
    private record CreateBusinessResponse(Guid Id, string Name, string Slug);
}
