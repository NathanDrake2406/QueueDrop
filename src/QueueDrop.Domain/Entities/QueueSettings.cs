namespace QueueDrop.Domain.Entities;

/// <summary>
/// Value object containing queue configuration settings.
/// Owned by Queue aggregate (EF Core owned entity).
/// </summary>
public sealed record QueueSettings
{
    /// <summary>Maximum customers allowed in queue. Null means unlimited.</summary>
    public int? MaxQueueSize { get; init; }

    /// <summary>Estimated service time per customer in minutes.</summary>
    public int EstimatedServiceTimeMinutes { get; init; } = 5;

    /// <summary>Whether to allow customers to join when queue is paused.</summary>
    public bool AllowJoinWhenPaused { get; init; } = false;

    /// <summary>Minutes before a called customer is marked as no-show.</summary>
    public int NoShowTimeoutMinutes { get; init; } = 5;

    /// <summary>Custom message shown to customers when they join.</summary>
    public string? WelcomeMessage { get; init; }

    /// <summary>Custom message shown when customer is called.</summary>
    public string? CalledMessage { get; init; }

    public static QueueSettings Default => new();
}
