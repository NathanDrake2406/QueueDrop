using System.Net.Http.Headers;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using QueueDrop.Api.Auth;
using QueueDrop.Domain.Entities;
using QueueDrop.Domain.Enums;

namespace QueueDrop.Api.Tests;

public class BusinessAuthorizationServiceTests : IntegrationTestBase
{
    [Fact]
    public async Task GetMembership_WhenUserIsOwner_ShouldReturnOwnerMembership()
    {
        // Arrange
        var (userId, businessSlug) = await CreateUserWithBusiness("owner@test.com", "test-biz");

        await using var scope = ServiceProvider.CreateAsyncScope();
        var service = scope.ServiceProvider.GetRequiredService<IBusinessAuthorizationService>();

        // Act
        var result = await service.GetMembershipAsync(userId, businessSlug, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result!.Role.Should().Be(BusinessRole.Owner);
    }

    [Fact]
    public async Task GetMembership_WhenUserIsNotMember_ShouldReturnNull()
    {
        // Arrange
        await CreateUserWithBusiness("owner@test.com", "test-biz");
        var otherUserId = await CreateUser("other@test.com");

        await using var scope = ServiceProvider.CreateAsyncScope();
        var service = scope.ServiceProvider.GetRequiredService<IBusinessAuthorizationService>();

        // Act
        var result = await service.GetMembershipAsync(otherUserId, "test-biz", CancellationToken.None);

        // Assert
        result.Should().BeNull();
    }

    [Fact]
    public async Task IsOwner_WhenUserIsOwner_ShouldReturnTrue()
    {
        // Arrange
        var (userId, businessSlug) = await CreateUserWithBusiness("owner2@test.com", "my-shop");

        await using var scope = ServiceProvider.CreateAsyncScope();
        var service = scope.ServiceProvider.GetRequiredService<IBusinessAuthorizationService>();

        // Act
        var result = await service.IsOwnerAsync(userId, businessSlug, CancellationToken.None);

        // Assert
        result.Should().BeTrue();
    }

    [Fact]
    public async Task IsOwner_WhenUserIsStaff_ShouldReturnFalse()
    {
        // Arrange
        var (_, businessSlug) = await CreateUserWithBusiness("owner3@test.com", "shop-with-staff");
        var staffUserId = await CreateStaffMember("staff@test.com", businessSlug);

        await using var scope = ServiceProvider.CreateAsyncScope();
        var service = scope.ServiceProvider.GetRequiredService<IBusinessAuthorizationService>();

        // Act
        var result = await service.IsOwnerAsync(staffUserId, businessSlug, CancellationToken.None);

        // Assert
        result.Should().BeFalse();
    }

    [Fact]
    public async Task IsMember_WhenUserIsOwner_ShouldReturnTrue()
    {
        // Arrange
        var (userId, businessSlug) = await CreateUserWithBusiness("owner4@test.com", "member-test");

        await using var scope = ServiceProvider.CreateAsyncScope();
        var service = scope.ServiceProvider.GetRequiredService<IBusinessAuthorizationService>();

        // Act
        var result = await service.IsMemberAsync(userId, businessSlug, CancellationToken.None);

        // Assert
        result.Should().BeTrue();
    }

    [Fact]
    public async Task IsMember_WhenUserIsStaff_ShouldReturnTrue()
    {
        // Arrange
        var (_, businessSlug) = await CreateUserWithBusiness("owner5@test.com", "staff-member-test");
        var staffUserId = await CreateStaffMember("staff2@test.com", businessSlug);

        await using var scope = ServiceProvider.CreateAsyncScope();
        var service = scope.ServiceProvider.GetRequiredService<IBusinessAuthorizationService>();

        // Act
        var result = await service.IsMemberAsync(staffUserId, businessSlug, CancellationToken.None);

        // Assert
        result.Should().BeTrue();
    }

    [Fact]
    public async Task IsMember_WhenUserIsNotMember_ShouldReturnFalse()
    {
        // Arrange
        await CreateUserWithBusiness("owner6@test.com", "nonmember-test");
        var otherUserId = await CreateUser("nonmember@test.com");

        await using var scope = ServiceProvider.CreateAsyncScope();
        var service = scope.ServiceProvider.GetRequiredService<IBusinessAuthorizationService>();

        // Act
        var result = await service.IsMemberAsync(otherUserId, "nonmember-test", CancellationToken.None);

        // Assert
        result.Should().BeFalse();
    }

    private async Task<(Guid UserId, string BusinessSlug)> CreateUserWithBusiness(string email, string slug)
    {
        var token = await GetAuthToken(email);
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        await Client.PostAsJsonAsync("/api/business", new { name = slug, slug });

        await using var scope = ServiceProvider.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<TestAppDbContext>();
        var user = await db.Users.FirstAsync(u => u.Email == email);
        return (user.Id, slug);
    }

    private async Task<Guid> CreateUser(string email)
    {
        await GetAuthToken(email);
        await using var scope = ServiceProvider.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<TestAppDbContext>();
        var user = await db.Users.FirstAsync(u => u.Email == email);
        return user.Id;
    }

    private async Task<Guid> CreateStaffMember(string email, string businessSlug)
    {
        var userId = await CreateUser(email);

        await using var scope = ServiceProvider.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<TestAppDbContext>();
        var business = await db.Businesses.FirstAsync(b => b.Slug == businessSlug);

        var membership = BusinessMember.CreateStaffInvite(userId, business.Id, DateTimeOffset.UtcNow);
        membership.AcceptInvite(DateTimeOffset.UtcNow);
        db.BusinessMembers.Add(membership);
        await db.SaveChangesAsync();

        return userId;
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
