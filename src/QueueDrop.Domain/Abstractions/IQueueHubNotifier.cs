namespace QueueDrop.Domain.Abstractions;

/// <summary>
/// Port for real-time queue notifications.
/// Implementation lives in Infrastructure (SignalR adapter).
/// </summary>
public interface IQueueHubNotifier
{
    /// <summary>
    /// Notifies a customer that their position in the queue has changed.
    /// </summary>
    Task NotifyPositionChangedAsync(string customerToken, int newPosition, CancellationToken cancellationToken = default);

    /// <summary>
    /// Notifies a customer that they have been called.
    /// </summary>
    Task NotifyCustomerCalledAsync(string customerToken, string? message, CancellationToken cancellationToken = default);

    /// <summary>
    /// Notifies a customer that their status has changed.
    /// </summary>
    Task NotifyStatusChangedAsync(string customerToken, string status, CancellationToken cancellationToken = default);

    /// <summary>
    /// Notifies staff that the queue state has changed (new customer, customer called, etc.).
    /// </summary>
    Task NotifyQueueUpdatedAsync(Guid queueId, QueueUpdateType updateType, CancellationToken cancellationToken = default);

    /// <summary>
    /// Notifies multiple customers of their new positions in batch.
    /// </summary>
    Task NotifyPositionsChangedAsync(IEnumerable<(string CustomerToken, int NewPosition)> updates, CancellationToken cancellationToken = default);

    /// <summary>
    /// Notifies a customer that they're near the front of the queue.
    /// </summary>
    Task NotifyNearFrontAsync(string customerToken, int position, CancellationToken cancellationToken = default);
}

/// <summary>
/// Type of queue update for staff notifications.
/// </summary>
public enum QueueUpdateType
{
    CustomerJoined,
    CustomerCalled,
    CustomerServed,
    CustomerNoShow,
    CustomerRemoved,
    QueueSettingsChanged
}
