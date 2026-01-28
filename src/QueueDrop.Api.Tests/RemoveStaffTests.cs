using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.EntityFrameworkCore;
using QueueDrop.Domain.Enums;

namespace QueueDrop.Api.Tests;

public class RemoveStaffTests : IntegrationTestBase
{
    [Fact]
    public async Task RemoveStaff_AsOwner_ShouldReturn204()
    {
        // Arrange
        var (ownerToken, businessSlug, staffUserId) = await SetupOwnerWithStaff("owner@test.com", "my-shop", "staff@test.com");
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", ownerToken);

        // Act
        var response = await Client.DeleteAsync($"/api/business/{businessSlug}/staff/{staffUserId}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);

        await using var scope = ServiceProvider.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<TestAppDbContext>();
        db.BusinessMembers.Any(bm => bm.UserId == staffUserId).Should().BeFalse();
    }

    [Fact]
    public async Task RemoveStaff_CannotRemoveOwner_ShouldReturn400()
    {
        // Arrange
        var (ownerToken, businessSlug) = await SetupOwnerWithBusiness("owner@test.com", "my-shop");
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", ownerToken);

        await using var scope = ServiceProvider.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<TestAppDbContext>();
        var owner = await db.Users.FirstAsync(u => u.Email == "owner@test.com");

        // Act - try to remove self (owner)
        var response = await Client.DeleteAsync($"/api/business/{businessSlug}/staff/{owner.Id}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task RemoveStaff_AsNonOwner_ShouldReturn403()
    {
        // Arrange
        var (_, businessSlug, _) = await SetupOwnerWithStaff("owner@test.com", "my-shop", "staff@test.com");
        var otherToken = await GetAuthToken("other@test.com");
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", otherToken);

        await using var scope = ServiceProvider.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<TestAppDbContext>();
        var staff = await db.Users.FirstAsync(u => u.Email == "staff@test.com");

        // Act
        var response = await Client.DeleteAsync($"/api/business/{businessSlug}/staff/{staff.Id}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task RemoveStaff_WithoutAuth_ShouldReturn401()
    {
        // Arrange
        var (_, businessSlug, staffUserId) = await SetupOwnerWithStaff("owner@test.com", "my-shop", "staff@test.com");
        Client.DefaultRequestHeaders.Authorization = null;

        // Act
        var response = await Client.DeleteAsync($"/api/business/{businessSlug}/staff/{staffUserId}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task RemoveStaff_NonexistentMember_ShouldReturn404()
    {
        // Arrange
        var (ownerToken, businessSlug) = await SetupOwnerWithBusiness("owner@test.com", "my-shop");
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", ownerToken);
        var nonexistentUserId = Guid.NewGuid();

        // Act
        var response = await Client.DeleteAsync($"/api/business/{businessSlug}/staff/{nonexistentUserId}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task RemoveStaff_AsStaff_ShouldReturn403()
    {
        // Arrange - owner creates business with staff member
        var (_, businessSlug, staffUserId, staffToken) = await SetupOwnerWithStaffAndToken("owner@test.com", "my-shop", "staff@test.com");

        // Use staff's token
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", staffToken);

        // Act - staff tries to remove themselves
        var response = await Client.DeleteAsync($"/api/business/{businessSlug}/staff/{staffUserId}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    private async Task<(string OwnerToken, string BusinessSlug, Guid StaffUserId, string StaffToken)> SetupOwnerWithStaffAndToken(string ownerEmail, string slug, string staffEmail)
    {
        var (ownerToken, businessSlug) = await SetupOwnerWithBusiness(ownerEmail, slug);

        // Create staff via invite flow
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", ownerToken);
        await Client.PostAsJsonAsync($"/api/business/{businessSlug}/staff/invite", new { email = staffEmail });

        await using var scope = ServiceProvider.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<TestAppDbContext>();
        var inviteLink = db.MagicLinks.First(l => l.Email == staffEmail && l.Type == MagicLinkType.Invite);

        // Accept invite and get the token
        Client.DefaultRequestHeaders.Authorization = null;
        var verifyResponse = await Client.GetFromJsonAsync<VerifyResponse>($"/api/auth/verify?token={inviteLink.Token}");

        db.ChangeTracker.Clear();
        var staff = await db.Users.FirstAsync(u => u.Email == staffEmail);
        return (ownerToken, businessSlug, staff.Id, verifyResponse!.Token);
    }

    private async Task<(string Token, string BusinessSlug, Guid StaffUserId)> SetupOwnerWithStaff(string ownerEmail, string slug, string staffEmail)
    {
        var (ownerToken, businessSlug, staffUserId, _) = await SetupOwnerWithStaffAndToken(ownerEmail, slug, staffEmail);
        return (ownerToken, businessSlug, staffUserId);
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
