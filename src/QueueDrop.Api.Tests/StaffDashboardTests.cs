using System.Net;
using System.Net.Http.Json;
using FluentAssertions;

namespace QueueDrop.Api.Tests;

public class StaffDashboardTests : IntegrationTestBase
{
    [Fact]
    public async Task GetQueueCustomers_ShouldReturnAllCustomers()
    {
        // Arrange - add some customers
        await JoinQueueAndGetToken("Alice");
        await JoinQueueAndGetToken("Bob");
        await JoinQueueAndGetToken("Charlie");

        // Act
        var response = await Client.GetAsync($"/api/queues/{TestQueueId}/customers");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var data = await response.Content.ReadFromJsonAsync<GetCustomersResponse>();
        data.Should().NotBeNull();
        data!.Customers.Should().HaveCount(3);
        data.QueueInfo.WaitingCount.Should().Be(3);
        data.QueueInfo.Name.Should().Be(TestQueueName);
    }

    [Fact]
    public async Task GetQueueCustomers_ShouldCalculatePositions()
    {
        // Arrange
        await JoinQueueAndGetToken("First");
        await JoinQueueAndGetToken("Second");
        await JoinQueueAndGetToken("Third");

        // Act
        var response = await Client.GetAsync($"/api/queues/{TestQueueId}/customers");
        var data = await response.Content.ReadFromJsonAsync<GetCustomersResponse>();

        // Assert
        var waitingCustomers = data!.Customers.Where(c => c.Status == "Waiting").ToList();
        waitingCustomers.Should().HaveCount(3);
        waitingCustomers[0].Position.Should().Be(1);
        waitingCustomers[1].Position.Should().Be(2);
        waitingCustomers[2].Position.Should().Be(3);
    }

    [Fact]
    public async Task GetQueueCustomers_WithNonExistentQueue_ShouldReturn404()
    {
        // Act
        var response = await Client.GetAsync($"/api/queues/{Guid.NewGuid()}/customers");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task MarkServed_WhenCalled_ShouldSucceed()
    {
        // Arrange - add customer and call them
        var token = await JoinQueueAndGetToken("Customer");
        await Client.PostAsync($"/api/queues/{TestQueueId}/call-next", null);

        // Get customer ID
        var customers = await GetQueueCustomers();
        var customerId = customers.First(c => c.Token == token).Id;

        // Act
        var response = await Client.PostAsync($"/api/queues/{TestQueueId}/customers/{customerId}/serve", null);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // Verify customer is now served
        var updatedCustomers = await GetQueueCustomers();
        updatedCustomers.Should().NotContain(c => c.Id == customerId && c.Status == "Called");
    }

    [Fact]
    public async Task MarkServed_WhenWaiting_ShouldReturn400()
    {
        // Arrange - add customer but don't call them
        var token = await JoinQueueAndGetToken("WaitingCustomer");
        var customers = await GetQueueCustomers();
        var customerId = customers.First(c => c.Token == token).Id;

        // Act
        var response = await Client.PostAsync($"/api/queues/{TestQueueId}/customers/{customerId}/serve", null);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task MarkNoShow_WhenCalled_ShouldSucceed()
    {
        // Arrange - add customer and call them
        var token = await JoinQueueAndGetToken("NoShowCustomer");
        await Client.PostAsync($"/api/queues/{TestQueueId}/call-next", null);

        var customers = await GetQueueCustomers();
        var customerId = customers.First(c => c.Token == token).Id;

        // Act
        var response = await Client.PostAsync($"/api/queues/{TestQueueId}/customers/{customerId}/no-show", null);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task RemoveCustomer_WhenWaiting_ShouldSucceed()
    {
        // Arrange
        var token = await JoinQueueAndGetToken("ToRemove");
        var customers = await GetQueueCustomers();
        var customerId = customers.First(c => c.Token == token).Id;

        // Act
        var response = await Client.DeleteAsync($"/api/queues/{TestQueueId}/customers/{customerId}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // Verify customer is removed
        var updatedCustomers = await GetQueueCustomers();
        updatedCustomers.Should().NotContain(c => c.Id == customerId);
    }

    [Fact]
    public async Task GetQueueByBusiness_ShouldReturnQueueInfo()
    {
        // Act
        var response = await Client.GetAsync($"/api/business/{TestBusinessSlug}/queue");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var data = await response.Content.ReadFromJsonAsync<QueueByBusinessResponse>();
        data.Should().NotBeNull();
        data!.QueueId.Should().Be(TestQueueId);
        data.QueueName.Should().Be(TestQueueName);
        data.BusinessName.Should().Be(TestBusinessName);
    }

    [Fact]
    public async Task GetQueueByBusiness_WithNonExistentBusiness_ShouldReturn404()
    {
        // Act
        var response = await Client.GetAsync("/api/business/nonexistent/queue");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    private async Task<List<CustomerDto>> GetQueueCustomers()
    {
        var response = await Client.GetAsync($"/api/queues/{TestQueueId}/customers");
        var data = await response.Content.ReadFromJsonAsync<GetCustomersResponse>();
        return data!.Customers;
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

    private record QueueByBusinessResponse(Guid QueueId, string QueueName, Guid BusinessId, string BusinessName);
}
