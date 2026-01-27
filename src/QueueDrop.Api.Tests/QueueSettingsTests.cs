using System.Net;
using System.Net.Http.Json;
using FluentAssertions;

namespace QueueDrop.Api.Tests;

public class QueueSettingsTests : IntegrationTestBase
{
    [Fact]
    public async Task GetSettings_ShouldReturnCurrentSettings()
    {
        // Act
        var response = await Client.GetAsync($"/api/queues/{TestQueueId}/settings");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var settings = await response.Content.ReadFromJsonAsync<SettingsResponse>();
        settings.Should().NotBeNull();
        settings!.EstimatedServiceTimeMinutes.Should().BeGreaterThan(0);
        settings.NoShowTimeoutMinutes.Should().BeGreaterThan(0);
    }

    [Fact]
    public async Task GetSettings_WithNonExistentQueue_ShouldReturn404()
    {
        // Act
        var response = await Client.GetAsync($"/api/queues/{Guid.NewGuid()}/settings");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task UpdateSettings_ShouldPersistChanges()
    {
        // Arrange
        var newSettings = new
        {
            maxQueueSize = 50,
            estimatedServiceTimeMinutes = 10,
            noShowTimeoutMinutes = 3,
            allowJoinWhenPaused = true,
            welcomeMessage = "Welcome to our shop!",
            calledMessage = "Please proceed to the counter."
        };

        // Act
        var updateResponse = await Client.PutAsJsonAsync($"/api/queues/{TestQueueId}/settings", newSettings);
        updateResponse.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // Verify changes persisted
        var getResponse = await Client.GetAsync($"/api/queues/{TestQueueId}/settings");
        var settings = await getResponse.Content.ReadFromJsonAsync<SettingsResponse>();

        // Assert
        settings.Should().NotBeNull();
        settings!.MaxQueueSize.Should().Be(50);
        settings.EstimatedServiceTimeMinutes.Should().Be(10);
        settings.NoShowTimeoutMinutes.Should().Be(3);
        settings.AllowJoinWhenPaused.Should().BeTrue();
        settings.WelcomeMessage.Should().Be("Welcome to our shop!");
        settings.CalledMessage.Should().Be("Please proceed to the counter.");
    }

    [Fact]
    public async Task UpdateSettings_WithNullMaxQueueSize_ShouldSetUnlimited()
    {
        // Arrange
        var newSettings = new
        {
            maxQueueSize = (int?)null,
            estimatedServiceTimeMinutes = 5,
            noShowTimeoutMinutes = 5,
            allowJoinWhenPaused = false,
            welcomeMessage = (string?)null,
            calledMessage = (string?)null
        };

        // Act
        var updateResponse = await Client.PutAsJsonAsync($"/api/queues/{TestQueueId}/settings", newSettings);
        updateResponse.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // Verify
        var getResponse = await Client.GetAsync($"/api/queues/{TestQueueId}/settings");
        var settings = await getResponse.Content.ReadFromJsonAsync<SettingsResponse>();

        // Assert
        settings!.MaxQueueSize.Should().BeNull();
    }

    [Fact]
    public async Task UpdateSettings_WithInvalidMaxQueueSize_ShouldReturn400()
    {
        // Arrange - max queue size 0 is invalid
        var newSettings = new
        {
            maxQueueSize = 0,
            estimatedServiceTimeMinutes = 5,
            noShowTimeoutMinutes = 5,
            allowJoinWhenPaused = false
        };

        // Act
        var response = await Client.PutAsJsonAsync($"/api/queues/{TestQueueId}/settings", newSettings);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task UpdateSettings_WithInvalidServiceTime_ShouldReturn400()
    {
        // Arrange - service time 0 is invalid
        var newSettings = new
        {
            maxQueueSize = (int?)null,
            estimatedServiceTimeMinutes = 0,
            noShowTimeoutMinutes = 5,
            allowJoinWhenPaused = false
        };

        // Act
        var response = await Client.PutAsJsonAsync($"/api/queues/{TestQueueId}/settings", newSettings);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task UpdateSettings_WithInvalidNoShowTimeout_ShouldReturn400()
    {
        // Arrange - no-show timeout 0 is invalid
        var newSettings = new
        {
            maxQueueSize = (int?)null,
            estimatedServiceTimeMinutes = 5,
            noShowTimeoutMinutes = 0,
            allowJoinWhenPaused = false
        };

        // Act
        var response = await Client.PutAsJsonAsync($"/api/queues/{TestQueueId}/settings", newSettings);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task UpdateSettings_WithNonExistentQueue_ShouldReturn404()
    {
        // Arrange
        var newSettings = new
        {
            maxQueueSize = (int?)null,
            estimatedServiceTimeMinutes = 5,
            noShowTimeoutMinutes = 5,
            allowJoinWhenPaused = false
        };

        // Act
        var response = await Client.PutAsJsonAsync($"/api/queues/{Guid.NewGuid()}/settings", newSettings);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    private record SettingsResponse(
        int? MaxQueueSize,
        int EstimatedServiceTimeMinutes,
        int NoShowTimeoutMinutes,
        bool AllowJoinWhenPaused,
        string? WelcomeMessage,
        string? CalledMessage);
}
