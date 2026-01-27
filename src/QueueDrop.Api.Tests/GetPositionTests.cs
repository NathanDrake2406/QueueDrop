using System.Net;
using System.Net.Http.Json;
using FluentAssertions;

namespace QueueDrop.Api.Tests;

public class GetPositionTests : IntegrationTestBase
{

    private record PositionResponse(
        int? Position,
        string Status,
        string QueueName,
        string BusinessName,
        int? EstimatedWaitMinutes,
        int RecentActivity,
        string? WelcomeMessage,
        string? CalledMessage);

    [Fact]
    public async Task GetPosition_WithValidToken_ShouldReturnPosition()
    {
        // Arrange
        var token = await JoinQueueAndGetToken("Alice");

        // Act
        var response = await Client.GetAsync($"/api/q/{token}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var result = await response.Content.ReadFromJsonAsync<PositionResponse>();
        result.Should().NotBeNull();
        result!.Position.Should().BeGreaterThanOrEqualTo(1);
        result.Status.Should().Be("Waiting");
        result.QueueName.Should().Be(TestQueueName);
        result.BusinessName.Should().Be(TestBusinessName);
    }

    [Fact]
    public async Task GetPosition_ShouldCalculateEstimatedWait()
    {
        // Arrange - join as second customer so wait time > 0
        await JoinQueueAndGetToken("First");
        var token = await JoinQueueAndGetToken("Second");

        // Act
        var response = await Client.GetAsync($"/api/q/{token}");

        // Assert
        var result = await response.Content.ReadFromJsonAsync<PositionResponse>();
        result!.Position.Should().BeGreaterThan(1);
        result.EstimatedWaitMinutes.Should().BeGreaterThanOrEqualTo(0);
    }

    [Fact]
    public async Task GetPosition_WithInvalidToken_ShouldReturn404()
    {
        // Act
        var response = await Client.GetAsync("/api/q/invalid-token-12345");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GetPosition_AfterBeingCalled_ShouldShowCalledStatus()
    {
        // Arrange
        var token = await JoinQueueAndGetToken("Only Customer");
        var queueId = await GetTestQueueId();

        // Call next
        var callResponse = await Client.PostAsync($"/api/queues/{queueId}/call-next", null);
        callResponse.EnsureSuccessStatusCode();

        // Act
        var response = await Client.GetAsync($"/api/q/{token}");

        // Assert
        var result = await response.Content.ReadFromJsonAsync<PositionResponse>();
        result!.Status.Should().Be("Called");
        result.Position.Should().BeNull("called customers have no position");
        result.CalledMessage.Should().NotBeNull();
    }

    [Fact]
    public async Task GetPosition_MultipleCustomers_ShouldReturnCorrectPositions()
    {
        // Arrange
        var token1 = await JoinQueueAndGetToken("First");
        var token2 = await JoinQueueAndGetToken("Second");
        var token3 = await JoinQueueAndGetToken("Third");

        // Act
        var response1 = await Client.GetAsync($"/api/q/{token1}");
        var response2 = await Client.GetAsync($"/api/q/{token2}");
        var response3 = await Client.GetAsync($"/api/q/{token3}");

        // Assert
        var result1 = await response1.Content.ReadFromJsonAsync<PositionResponse>();
        var result2 = await response2.Content.ReadFromJsonAsync<PositionResponse>();
        var result3 = await response3.Content.ReadFromJsonAsync<PositionResponse>();

        result2!.Position.Should().Be(result1!.Position + 1);
        result3!.Position.Should().Be(result2.Position + 1);
    }
}
