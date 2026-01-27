namespace QueueDrop.Infrastructure.PushNotifications;

/// <summary>
/// Configuration options for VAPID (Voluntary Application Server Identification).
/// Used for Web Push authentication.
/// </summary>
public sealed class VapidOptions
{
    public const string SectionName = "Vapid";

    /// <summary>Contact email or URL for push service identification.</summary>
    public required string Subject { get; init; }

    /// <summary>VAPID public key (Base64 URL-safe encoded).</summary>
    public required string PublicKey { get; init; }

    /// <summary>VAPID private key (Base64 URL-safe encoded).</summary>
    public required string PrivateKey { get; init; }
}
