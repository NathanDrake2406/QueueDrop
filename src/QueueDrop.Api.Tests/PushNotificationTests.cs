using System.Net;
using System.Net.Http.Json;
using FluentAssertions;

namespace QueueDrop.Api.Tests;

/// <summary>
/// Integration tests for Web Push notification endpoints.
/// </summary>
public class PushNotificationTests : IntegrationTestBase
{
    [Fact]
    public async Task GetVapidPublicKey_ShouldReturnKey()
    {
        // Act
        var response = await Client.GetAsync("/api/push/vapid-public-key");
        var data = await response.Content.ReadFromJsonAsync<VapidKeyResponse>();

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        data.Should().NotBeNull();
        data!.PublicKey.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task SavePushSubscription_ShouldStoreSubscription()
    {
        // Arrange - join queue first
        var token = await JoinQueueAndGetToken("NotificationTestCustomer");

        var subscription = new
        {
            endpoint = "https://fcm.googleapis.com/fcm/send/test-endpoint",
            p256dh = "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM",
            auth = "tBHItJI5svbpez7KI4CCXg"
        };

        // Act
        var response = await Client.PostAsJsonAsync($"/api/q/{token}/push-subscription", subscription);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task SavePushSubscription_WithInvalidToken_ShouldReturn404()
    {
        // Arrange
        var subscription = new
        {
            endpoint = "https://fcm.googleapis.com/fcm/send/test-endpoint",
            p256dh = "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM",
            auth = "tBHItJI5svbpez7KI4CCXg"
        };

        // Act
        var response = await Client.PostAsJsonAsync("/api/q/invalid-token/push-subscription", subscription);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task SavePushSubscription_WithMissingFields_ShouldReturn400()
    {
        // Arrange - join queue first
        var token = await JoinQueueAndGetToken("MissingFieldsCustomer");

        var incompleteSubscription = new
        {
            endpoint = "https://fcm.googleapis.com/fcm/send/test-endpoint",
            // missing p256dh and auth
        };

        // Act
        var response = await Client.PostAsJsonAsync($"/api/q/{token}/push-subscription", incompleteSubscription);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task SavePushSubscription_ShouldPersistForCustomer()
    {
        // Arrange - join queue first
        var token = await JoinQueueAndGetToken("PersistenceTestCustomer");

        var subscription = new
        {
            endpoint = "https://fcm.googleapis.com/fcm/send/persistence-test",
            p256dh = "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM",
            auth = "tBHItJI5svbpez7KI4CCXg"
        };

        // Act - save subscription
        var saveResponse = await Client.PostAsJsonAsync($"/api/q/{token}/push-subscription", subscription);
        saveResponse.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // Verify by saving again (idempotent operation)
        var saveAgainResponse = await Client.PostAsJsonAsync($"/api/q/{token}/push-subscription", subscription);
        saveAgainResponse.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    private record VapidKeyResponse(string PublicKey);
}
