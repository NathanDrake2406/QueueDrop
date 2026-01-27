using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using WebPush;

namespace QueueDrop.Infrastructure.PushNotifications;

/// <summary>
/// Service for sending Web Push notifications to subscribed customers.
/// </summary>
public interface IWebPushService
{
    /// <summary>Sends a push notification to the specified subscription.</summary>
    Task<bool> SendNotificationAsync(
        string subscriptionJson,
        string title,
        string body,
        CancellationToken cancellationToken = default);

    /// <summary>Gets the VAPID public key for client-side subscription.</summary>
    string GetPublicKey();
}

public sealed class WebPushService : IWebPushService
{
    private readonly VapidOptions _options;
    private readonly WebPushClient _client;
    private readonly ILogger<WebPushService> _logger;

    public WebPushService(IOptions<VapidOptions> options, ILogger<WebPushService> logger)
    {
        _options = options.Value;
        _logger = logger;
        _client = new WebPushClient();
    }

    public string GetPublicKey() => _options.PublicKey;

    public async Task<bool> SendNotificationAsync(
        string subscriptionJson,
        string title,
        string body,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var subscription = DeserializeSubscription(subscriptionJson);
            if (subscription is null)
            {
                _logger.LogWarning("Failed to deserialize push subscription");
                return false;
            }

            var vapidDetails = new VapidDetails(
                _options.Subject,
                _options.PublicKey,
                _options.PrivateKey);

            var payload = JsonSerializer.Serialize(new { title, body });

            await _client.SendNotificationAsync(subscription, payload, vapidDetails);

            _logger.LogDebug("Push notification sent successfully to {Endpoint}", subscription.Endpoint);
            return true;
        }
        catch (WebPushException ex) when (ex.StatusCode == System.Net.HttpStatusCode.Gone)
        {
            // Subscription is no longer valid
            _logger.LogInformation("Push subscription expired or unsubscribed");
            return false;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send push notification");
            return false;
        }
    }

    private static PushSubscription? DeserializeSubscription(string json)
    {
        try
        {
            var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            var endpoint = root.GetProperty("endpoint").GetString();
            var p256dh = root.GetProperty("keys").GetProperty("p256dh").GetString();
            var auth = root.GetProperty("keys").GetProperty("auth").GetString();

            if (endpoint is null || p256dh is null || auth is null)
                return null;

            return new PushSubscription(endpoint, p256dh, auth);
        }
        catch
        {
            return null;
        }
    }
}
