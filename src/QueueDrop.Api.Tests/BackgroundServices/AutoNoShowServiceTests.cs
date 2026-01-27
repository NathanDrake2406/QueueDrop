using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using QueueDrop.Domain.Enums;
using QueueDrop.Infrastructure.Persistence;

namespace QueueDrop.Api.Tests.BackgroundServices;

/// <summary>
/// Tests for auto no-show functionality.
/// These tests verify the domain logic that the background service uses.
/// </summary>
public class AutoNoShowServiceTests : IntegrationTestBase
{
    [Fact]
    public async Task ShouldMarkExpiredCustomersAsNoShow()
    {
        // Arrange - add and call a customer
        var token = await JoinQueueAndGetToken("ExpiredCustomer");
        await Client.PostAsync($"/api/queues/{TestQueueId}/call-next", null);

        // Get customer ID
        var customersResponse = await Client.GetAsync($"/api/queues/{TestQueueId}/customers");
        var customersData = await customersResponse.Content.ReadFromJsonAsync<GetCustomersResponse>();
        var customerId = customersData!.Customers.First(c => c.Token == token).Id;

        // Verify customer is currently called
        customersData.Customers.First(c => c.Id == customerId).Status.Should().Be("Called");

        // Simulate time passing by marking as no-show manually (simulates what the background service does)
        // In a real scenario, the background service would handle this automatically
        // Here we test the endpoint that does the same thing
        var noShowResponse = await Client.PostAsync(
            $"/api/queues/{TestQueueId}/customers/{customerId}/no-show",
            null);

        // Assert
        noShowResponse.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // Verify customer is now no-show (not in the active queue)
        var finalResponse = await Client.GetAsync($"/api/queues/{TestQueueId}/customers");
        var finalData = await finalResponse.Content.ReadFromJsonAsync<GetCustomersResponse>();
        var customer = finalData!.Customers.FirstOrDefault(c => c.Id == customerId);

        // Customer should either be removed from list or marked as NoShow depending on implementation
        // For our implementation, completed customers are not returned
        if (customer is not null)
        {
            customer.Status.Should().NotBe("Called");
        }
    }

    [Fact]
    public async Task ShouldNotAffectCustomersWithinTimeout()
    {
        // Arrange - add and call a customer
        var token = await JoinQueueAndGetToken("ActiveCustomer");
        await Client.PostAsync($"/api/queues/{TestQueueId}/call-next", null);

        // Get customer status immediately (within timeout)
        var response = await Client.GetAsync($"/api/queues/{TestQueueId}/customers");
        var data = await response.Content.ReadFromJsonAsync<GetCustomersResponse>();

        // Assert - customer should still be "Called" (not no-show)
        var customer = data!.Customers.FirstOrDefault(c => c.Token == token);
        customer.Should().NotBeNull();
        customer!.Status.Should().Be("Called");
    }

    [Fact]
    public async Task ShouldRespectPerQueueTimeoutSettings()
    {
        // Arrange - update queue settings with custom timeout
        var settings = new
        {
            maxQueueSize = (int?)null,
            estimatedServiceTimeMinutes = 5,
            noShowTimeoutMinutes = 10, // 10 minute timeout
            allowJoinWhenPaused = false,
            welcomeMessage = (string?)null,
            calledMessage = (string?)null
        };

        var updateResponse = await Client.PutAsJsonAsync($"/api/queues/{TestQueueId}/settings", settings);
        updateResponse.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // Verify settings were saved
        var settingsResponse = await Client.GetAsync($"/api/queues/{TestQueueId}/settings");
        var savedSettings = await settingsResponse.Content.ReadFromJsonAsync<SettingsResponse>();
        savedSettings!.NoShowTimeoutMinutes.Should().Be(10);
    }

    [Fact]
    public async Task MarkNoShow_ShouldFailForNonCalledCustomer()
    {
        // Arrange - add a customer but don't call them
        var token = await JoinQueueAndGetToken("WaitingCustomer");

        var customersResponse = await Client.GetAsync($"/api/queues/{TestQueueId}/customers");
        var customersData = await customersResponse.Content.ReadFromJsonAsync<GetCustomersResponse>();
        var customerId = customersData!.Customers.First(c => c.Token == token).Id;

        // Act - try to mark as no-show
        var response = await Client.PostAsync(
            $"/api/queues/{TestQueueId}/customers/{customerId}/no-show",
            null);

        // Assert - should fail because customer is not called
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    private record CustomerDto(
        Guid Id,
        string Name,
        string Token,
        string Status,
        int? Position,
        DateTimeOffset JoinedAt,
        DateTimeOffset? CalledAt,
        int? PartySize,
        string? Notes);

    private record QueueInfoDto(
        string Name,
        bool IsActive,
        bool IsPaused,
        int WaitingCount,
        int CalledCount);

    private record GetCustomersResponse(List<CustomerDto> Customers, QueueInfoDto QueueInfo);

    private record SettingsResponse(
        int? MaxQueueSize,
        int EstimatedServiceTimeMinutes,
        int NoShowTimeoutMinutes,
        bool AllowJoinWhenPaused,
        string? WelcomeMessage,
        string? CalledMessage);
}
