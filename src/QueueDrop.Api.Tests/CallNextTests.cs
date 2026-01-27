using System.Net;
using System.Net.Http.Json;
using FluentAssertions;

namespace QueueDrop.Api.Tests;

public class CallNextTests : IntegrationTestBase
{

    private record CallNextResponse(
        Guid CustomerId,
        string CustomerName,
        string Token,
        int? PartySize,
        string? Notes);

    [Fact]
    public async Task CallNext_WithWaitingCustomers_ShouldReturnCalledCustomer()
    {
        // Arrange
        var token = await JoinQueueAndGetToken("Alice");
        var queueId = await GetTestQueueId();

        // Act
        var response = await Client.PostAsync($"/api/queues/{queueId}/call-next", null);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var result = await response.Content.ReadFromJsonAsync<CallNextResponse>();
        result.Should().NotBeNull();
        result!.CustomerName.Should().Be("Alice");
        result.Token.Should().Be(token);
    }

    [Fact]
    public async Task CallNext_ShouldCallOldestCustomerFirst()
    {
        // Arrange
        var token1 = await JoinQueueAndGetToken("First");
        await JoinQueueAndGetToken("Second");
        await JoinQueueAndGetToken("Third");
        var queueId = await GetTestQueueId();

        // Act
        var response = await Client.PostAsync($"/api/queues/{queueId}/call-next", null);

        // Assert
        var result = await response.Content.ReadFromJsonAsync<CallNextResponse>();
        result!.CustomerName.Should().Be("First");
        result.Token.Should().Be(token1);
    }

    [Fact]
    public async Task CallNext_ShouldSkipAlreadyCalledCustomers()
    {
        // Arrange
        await JoinQueueAndGetToken("First");
        var token2 = await JoinQueueAndGetToken("Second");
        var queueId = await GetTestQueueId();

        // Call first customer
        await Client.PostAsync($"/api/queues/{queueId}/call-next", null);

        // Act - call next
        var response = await Client.PostAsync($"/api/queues/{queueId}/call-next", null);

        // Assert
        var result = await response.Content.ReadFromJsonAsync<CallNextResponse>();
        result!.CustomerName.Should().Be("Second");
        result.Token.Should().Be(token2);
    }

    [Fact]
    public async Task CallNext_WhenQueueEmpty_ShouldReturn404()
    {
        // Arrange
        var queueId = await GetTestQueueId();

        // Act - no customers have joined
        var response = await Client.PostAsync($"/api/queues/{queueId}/call-next", null);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task CallNext_WhenAllCustomersCalled_ShouldReturn404()
    {
        // Arrange
        await JoinQueueAndGetToken("Only Customer");
        var queueId = await GetTestQueueId();

        // Call the only customer
        await Client.PostAsync($"/api/queues/{queueId}/call-next", null);

        // Act - try to call next when no one is waiting
        var response = await Client.PostAsync($"/api/queues/{queueId}/call-next", null);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task CallNext_WithNonExistentQueue_ShouldReturn404()
    {
        // Act
        var response = await Client.PostAsync($"/api/queues/{Guid.NewGuid()}/call-next", null);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task CallNext_ShouldUpdateCustomerPositions()
    {
        // Arrange
        await JoinQueueAndGetToken("First");
        var token2 = await JoinQueueAndGetToken("Second");
        var token3 = await JoinQueueAndGetToken("Third");
        var queueId = await GetTestQueueId();

        // Get initial positions
        var pos2Before = await GetPosition(token2);
        var pos3Before = await GetPosition(token3);

        // Act - call first customer
        await Client.PostAsync($"/api/queues/{queueId}/call-next", null);

        // Assert - positions should have shifted
        var pos2After = await GetPosition(token2);
        var pos3After = await GetPosition(token3);

        pos2After.Should().Be(pos2Before - 1);
        pos3After.Should().Be(pos3Before - 1);
    }

    private async Task<int> GetPosition(string token)
    {
        var response = await Client.GetAsync($"/api/q/{token}");
        var result = await response.Content.ReadFromJsonAsync<PositionResponse>();
        return result!.Position ?? 0;
    }

    private record PositionResponse(int? Position, string Status);
}
