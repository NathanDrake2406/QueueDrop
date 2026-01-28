using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using QueueDrop.Domain.Enums;

namespace QueueDrop.Api.Tests;

public class InviteStaffTests : IntegrationTestBase
{
    [Fact]
    public async Task InviteStaff_AsOwner_ShouldReturn201()
    {
        // Arrange
        var (token, businessSlug) = await SetupOwnerWithBusiness("owner@test.com", "my-shop");
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        // Act
        var response = await Client.PostAsJsonAsync($"/api/business/{businessSlug}/staff/invite", new
        {
            email = "staff@test.com"
        });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
    }

    [Fact]
    public async Task InviteStaff_ShouldCreateMagicLinkWithInviteType()
    {
        // Arrange
        var (token, businessSlug) = await SetupOwnerWithBusiness("owner@test.com", "my-shop");
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        // Act
        await Client.PostAsJsonAsync($"/api/business/{businessSlug}/staff/invite", new
        {
            email = "newstaff@test.com"
        });

        // Assert
        await using var scope = ServiceProvider.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<TestAppDbContext>();
        var link = db.MagicLinks.First(l => l.Email == "newstaff@test.com");
        link.Type.Should().Be(MagicLinkType.Invite);
        link.BusinessId.Should().NotBeNull();
    }

    [Fact]
    public async Task InviteStaff_AsNonOwner_ShouldReturn403()
    {
        // Arrange
        var (_, businessSlug) = await SetupOwnerWithBusiness("owner@test.com", "my-shop");
        var otherToken = await GetAuthToken("other@test.com");
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", otherToken);

        // Act
        var response = await Client.PostAsJsonAsync($"/api/business/{businessSlug}/staff/invite", new
        {
            email = "staff@test.com"
        });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task InviteStaff_WithoutAuth_ShouldReturn401()
    {
        // Arrange
        var (_, businessSlug) = await SetupOwnerWithBusiness("owner@test.com", "my-shop");
        Client.DefaultRequestHeaders.Authorization = null;

        // Act
        var response = await Client.PostAsJsonAsync($"/api/business/{businessSlug}/staff/invite", new
        {
            email = "staff@test.com"
        });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task InviteStaff_WithInvalidEmail_ShouldReturn400()
    {
        // Arrange
        var (token, businessSlug) = await SetupOwnerWithBusiness("owner@test.com", "my-shop");
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        // Act
        var response = await Client.PostAsJsonAsync($"/api/business/{businessSlug}/staff/invite", new
        {
            email = "not-an-email"
        });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task InviteStaff_ForNonexistentBusiness_ShouldReturn404()
    {
        // Arrange
        var token = await GetAuthToken("owner@test.com");
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        // Act
        var response = await Client.PostAsJsonAsync("/api/business/nonexistent-shop/staff/invite", new
        {
            email = "staff@test.com"
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
}
