using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using QueueDrop.Domain.Enums;

namespace QueueDrop.Api.Tests;

public class ListStaffTests : IntegrationTestBase
{
    [Fact]
    public async Task ListStaff_AsOwner_ShouldReturnAllMembers()
    {
        // Arrange
        var (token, businessSlug) = await SetupOwnerWithBusiness("owner@test.com", "my-shop");
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        // Act
        var response = await Client.GetAsync($"/api/business/{businessSlug}/staff");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<StaffListResponse>();
        result!.Staff.Should().HaveCount(1); // Just the owner
        result.Staff[0].Role.Should().Be("Owner");
    }

    [Fact]
    public async Task ListStaff_AsNonOwner_ShouldReturn403()
    {
        // Arrange
        var (_, businessSlug) = await SetupOwnerWithBusiness("owner@test.com", "my-shop");
        var otherToken = await GetAuthToken("other@test.com");
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", otherToken);

        // Act
        var response = await Client.GetAsync($"/api/business/{businessSlug}/staff");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task ListStaff_WithoutAuth_ShouldReturn401()
    {
        // Arrange
        var (_, businessSlug) = await SetupOwnerWithBusiness("owner@test.com", "my-shop");
        Client.DefaultRequestHeaders.Authorization = null;

        // Act
        var response = await Client.GetAsync($"/api/business/{businessSlug}/staff");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task ListStaff_ForNonexistentBusiness_ShouldReturn404()
    {
        // Arrange
        var token = await GetAuthToken("owner@test.com");
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        // Act
        var response = await Client.GetAsync("/api/business/nonexistent-shop/staff");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task ListStaff_ShouldNotIncludePendingInvites()
    {
        // Arrange
        var (token, businessSlug) = await SetupOwnerWithBusiness("owner@test.com", "my-shop");
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        // Invite staff but don't accept
        await Client.PostAsJsonAsync($"/api/business/{businessSlug}/staff/invite", new
        {
            email = "pending@test.com"
        });

        // Act
        var response = await Client.GetAsync($"/api/business/{businessSlug}/staff");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<StaffListResponse>();
        result!.Staff.Should().HaveCount(1); // Only the owner, not the pending invite
        result.Staff.Should().NotContain(s => s.Email == "pending@test.com");
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
    private record StaffListResponse(List<StaffMember> Staff);
    private record StaffMember(Guid UserId, string Email, string Role, DateTimeOffset JoinedAt);
}
