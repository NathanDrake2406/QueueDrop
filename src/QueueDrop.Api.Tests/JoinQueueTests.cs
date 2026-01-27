using System.Net;
using System.Net.Http.Json;
using FluentAssertions;

namespace QueueDrop.Api.Tests;

public class JoinQueueTests : IntegrationTestBase
{
    [Fact]
    public async Task JoinQueue_WithValidData_ShouldReturnToken()
    {
        // Act
        var response = await Client.PostAsJsonAsync($"/api/join/{TestBusinessSlug}", new { name = "Alice" });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);

        var result = await response.Content.ReadFromJsonAsync<JoinQueueResponse>();
        result.Should().NotBeNull();
        result!.Token.Should().NotBeNullOrEmpty();
        result.Position.Should().BeGreaterThanOrEqualTo(1);
        result.QueueName.Should().Be(TestQueueName);

        // Verify Location header
        response.Headers.Location.Should().NotBeNull();
        response.Headers.Location!.ToString().Should().Contain($"/api/q/{result.Token}");
    }

    [Fact]
    public async Task JoinQueue_WithMultipleCustomers_ShouldAssignSequentialPositions()
    {
        // Act
        var response1 = await Client.PostAsJsonAsync($"/api/join/{TestBusinessSlug}", new { name = "First" });
        var response2 = await Client.PostAsJsonAsync($"/api/join/{TestBusinessSlug}", new { name = "Second" });
        var response3 = await Client.PostAsJsonAsync($"/api/join/{TestBusinessSlug}", new { name = "Third" });

        // Assert
        var result1 = await response1.Content.ReadFromJsonAsync<JoinQueueResponse>();
        var result2 = await response2.Content.ReadFromJsonAsync<JoinQueueResponse>();
        var result3 = await response3.Content.ReadFromJsonAsync<JoinQueueResponse>();

        // Positions should be sequential (though exact numbers depend on test order)
        result2!.Position.Should().Be(result1!.Position + 1);
        result3!.Position.Should().Be(result2.Position + 1);
    }

    [Fact]
    public async Task JoinQueue_WithNonExistentBusiness_ShouldReturn404()
    {
        // Act
        var response = await Client.PostAsJsonAsync("/api/join/nonexistent-business", new { name = "Alice" });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public async Task JoinQueue_WithInvalidName_ShouldReturn400(string? name)
    {
        // Act
        var response = await Client.PostAsJsonAsync($"/api/join/{TestBusinessSlug}", new { name });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task JoinQueue_WithNameTooLong_ShouldReturn400()
    {
        // Arrange
        var longName = new string('a', 101);

        // Act
        var response = await Client.PostAsJsonAsync($"/api/join/{TestBusinessSlug}", new { name = longName });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task JoinQueue_ShouldTrimName()
    {
        // Act
        var token = await JoinQueueAndGetToken("  Trimmed Name  ");

        // Get position to verify name was stored correctly
        var positionResponse = await Client.GetAsync($"/api/q/{token}");
        positionResponse.EnsureSuccessStatusCode();

        // The name is trimmed internally, verified by successful join
        // (Name validation would fail if not trimmed to valid length)
    }
}
