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

    [Fact]
    public async Task GetMe_WithBusiness_ShouldIncludeRoleForOwner()
    {
        // Arrange - create user with a business (which makes them owner)
        var (token, _) = await SetupOwnerWithBusiness("businessowner@example.com", "my-shop");

        // Act
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        var response = await Client.GetAsync("/api/auth/me");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var result = await response.Content.ReadFromJsonAsync<MeResponse>();
        result.Should().NotBeNull();
        result!.Businesses.Should().HaveCount(1);
        result.Businesses[0].Role.Should().Be("owner");
    }

    [Fact]
    public async Task GetMe_AsStaff_ShouldIncludeStaffRole()
    {
        // Arrange - owner creates business, invites staff, staff accepts
        var (ownerToken, businessSlug) = await SetupOwnerWithBusiness("owner2@example.com", "owner-shop");
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", ownerToken);
        await Client.PostAsJsonAsync($"/api/business/{businessSlug}/staff/invite", new { email = "staffuser@example.com" });

        // Get the invite token and accept it
        await using var scope = ServiceProvider.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<TestAppDbContext>();
        var inviteLink = db.MagicLinks.First(l => l.Email == "staffuser@example.com");
        var verifyResponse = await Client.GetFromJsonAsync<VerifyResponse>($"/api/auth/verify?token={inviteLink.Token}");

        // Act - staff calls /api/auth/me
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", verifyResponse!.Token);
        var response = await Client.GetAsync("/api/auth/me");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var result = await response.Content.ReadFromJsonAsync<MeResponse>();
        result.Should().NotBeNull();
        result!.Businesses.Should().HaveCount(1);
        result.Businesses[0].Role.Should().Be("staff");
    }

    [Fact]
    public async Task GetMe_WithMultipleBusinesses_ShouldIncludeCorrectRoleForEach()
    {
        // Arrange - user is owner of one business and staff of another
        var (ownerToken, ownerBusinessSlug) = await SetupOwnerWithBusiness("multirole@example.com", "owned-shop");

        // Create another business by a different owner and invite our user as staff
        var (otherOwnerToken, otherBusinessSlug) = await SetupOwnerWithBusiness("otherowner@example.com", "other-shop");
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", otherOwnerToken);
        await Client.PostAsJsonAsync($"/api/business/{otherBusinessSlug}/staff/invite", new { email = "multirole@example.com" });

        // Accept the invite as the multi-role user
        await using var scope = ServiceProvider.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<TestAppDbContext>();
        // Find the INVITE link (not the login link) for this email
        var inviteLink = db.MagicLinks.First(l =>
            l.Email == "multirole@example.com" &&
            l.Type == Domain.Enums.MagicLinkType.Invite);
        await Client.GetAsync($"/api/auth/verify?token={inviteLink.Token}");

        // Act - multi-role user calls /api/auth/me (use their original owner token)
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", ownerToken);
        var response = await Client.GetAsync("/api/auth/me");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var result = await response.Content.ReadFromJsonAsync<MeResponse>();
        result.Should().NotBeNull();
        result!.Businesses.Should().HaveCount(2);

        var ownedBusiness = result.Businesses.First(b => b.Slug == "owned-shop");
        var staffedBusiness = result.Businesses.First(b => b.Slug == "other-shop");

        ownedBusiness.Role.Should().Be("owner");
        staffedBusiness.Role.Should().Be("staff");
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
    private record MeResponse(Guid UserId, string Email, List<BusinessInfo> Businesses);
    private record BusinessInfo(Guid Id, string Name, string Slug, string Role);
}
