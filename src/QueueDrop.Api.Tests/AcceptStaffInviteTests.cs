using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using QueueDrop.Domain.Enums;

namespace QueueDrop.Api.Tests;

public class AcceptStaffInviteTests : IntegrationTestBase
{
    [Fact]
    public async Task AcceptInvite_ShouldCreateStaffMembership()
    {
        // Arrange - owner creates business and invites staff
        var (ownerToken, businessSlug) = await SetupOwnerWithBusiness("owner@test.com", "my-shop");
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", ownerToken);
        await Client.PostAsJsonAsync($"/api/business/{businessSlug}/staff/invite", new { email = "newstaff@test.com" });

        // Get the invite token
        await using var scope = ServiceProvider.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<TestAppDbContext>();
        var inviteLink = db.MagicLinks.First(l => l.Email == "newstaff@test.com" && l.Type == MagicLinkType.Invite);

        // Act - staff accepts invite
        Client.DefaultRequestHeaders.Authorization = null;
        var response = await Client.GetAsync($"/api/auth/verify?token={inviteLink.Token}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        db.ChangeTracker.Clear();
        var staff = db.Users.First(u => u.Email == "newstaff@test.com");
        var membership = db.BusinessMembers.First(bm => bm.UserId == staff.Id);
        membership.Role.Should().Be(BusinessRole.Staff);
        membership.JoinedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task AcceptInvite_ShouldReturnBusinessInfoInResponse()
    {
        // Arrange
        var (ownerToken, businessSlug) = await SetupOwnerWithBusiness("owner@test.com", "my-shop");
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", ownerToken);
        await Client.PostAsJsonAsync($"/api/business/{businessSlug}/staff/invite", new { email = "staff2@test.com" });

        await using var scope = ServiceProvider.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<TestAppDbContext>();
        var inviteLink = db.MagicLinks.First(l => l.Email == "staff2@test.com");

        // Act
        Client.DefaultRequestHeaders.Authorization = null;
        var result = await Client.GetFromJsonAsync<VerifyResponse>($"/api/auth/verify?token={inviteLink.Token}");

        // Assert
        result!.Email.Should().Be("staff2@test.com");
        result.Token.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task AcceptInvite_WithExistingMembership_ShouldNotCreateDuplicate()
    {
        // Arrange - owner creates business and invites staff
        var (ownerToken, businessSlug) = await SetupOwnerWithBusiness("owner@test.com", "my-shop");
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", ownerToken);

        // Invite staff
        await Client.PostAsJsonAsync($"/api/business/{businessSlug}/staff/invite", new { email = "existingstaff@test.com" });

        await using var scope = ServiceProvider.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<TestAppDbContext>();
        var inviteLink = db.MagicLinks.First(l => l.Email == "existingstaff@test.com" && l.Type == MagicLinkType.Invite);

        // Accept first invite
        Client.DefaultRequestHeaders.Authorization = null;
        await Client.GetAsync($"/api/auth/verify?token={inviteLink.Token}");

        // Get business for second invite
        var business = db.Businesses.First(b => b.Slug == businessSlug);

        // Create another invite link directly (simulating edge case)
        var secondInvite = QueueDrop.Domain.Entities.MagicLink.CreateInviteLink(
            "existingstaff@test.com",
            business.Id,
            DateTimeOffset.UtcNow,
            TimeSpan.FromHours(48));
        db.MagicLinks.Add(secondInvite);
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();

        // Act - try to accept second invite
        var response = await Client.GetAsync($"/api/auth/verify?token={secondInvite.Token}");

        // Assert - should succeed but not create duplicate membership
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        db.ChangeTracker.Clear();
        var staff = db.Users.First(u => u.Email == "existingstaff@test.com");
        var memberships = db.BusinessMembers.Where(bm => bm.UserId == staff.Id && bm.BusinessId == business.Id).ToList();
        memberships.Should().HaveCount(1);
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
