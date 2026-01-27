using Microsoft.AspNetCore.SignalR;
using QueueDrop.Domain.Abstractions;

namespace QueueDrop.Infrastructure.SignalR;

/// <summary>
/// SignalR implementation of IQueueHubNotifier.
/// Sends real-time updates to customers and staff.
/// </summary>
public sealed class QueueHubNotifier : IQueueHubNotifier
{
    private readonly IHubContext<QueueHub, IQueueHubClient> _hubContext;

    public QueueHubNotifier(IHubContext<QueueHub, IQueueHubClient> hubContext)
    {
        _hubContext = hubContext;
    }

    public async Task NotifyPositionChangedAsync(
        string customerToken,
        int newPosition,
        CancellationToken cancellationToken = default)
    {
        await _hubContext.Clients
            .Group($"customer:{customerToken}")
            .PositionChanged(newPosition);
    }

    public async Task NotifyCustomerCalledAsync(
        string customerToken,
        string? message,
        CancellationToken cancellationToken = default)
    {
        await _hubContext.Clients
            .Group($"customer:{customerToken}")
            .YouAreCalled(message);
    }

    public async Task NotifyStatusChangedAsync(
        string customerToken,
        string status,
        CancellationToken cancellationToken = default)
    {
        await _hubContext.Clients
            .Group($"customer:{customerToken}")
            .StatusChanged(status);
    }

    public async Task NotifyQueueUpdatedAsync(
        Guid queueId,
        QueueUpdateType updateType,
        CancellationToken cancellationToken = default)
    {
        await _hubContext.Clients
            .Group($"queue:{queueId}")
            .QueueUpdated(updateType.ToString());
    }

    public async Task NotifyPositionsChangedAsync(
        IEnumerable<(string CustomerToken, int NewPosition)> updates,
        CancellationToken cancellationToken = default)
    {
        // Send updates in parallel for better performance
        var tasks = updates.Select(u =>
            _hubContext.Clients
                .Group($"customer:{u.CustomerToken}")
                .PositionChanged(u.NewPosition));

        await Task.WhenAll(tasks);
    }
}

/// <summary>
/// Strongly-typed hub client interface.
/// Defines methods that can be called on connected clients.
/// </summary>
public interface IQueueHubClient
{
    Task PositionChanged(int newPosition);
    Task YouAreCalled(string? message);
    Task StatusChanged(string status);
    Task QueueUpdated(string updateType);
}

/// <summary>
/// SignalR hub for queue real-time updates.
/// Clients join rooms based on their role (customer or staff).
/// </summary>
public sealed class QueueHub : Hub<IQueueHubClient>
{
    /// <summary>
    /// Customer joins their personal notification room.
    /// Called from client: connection.invoke("JoinCustomerRoom", token)
    /// </summary>
    public async Task JoinCustomerRoom(string token)
    {
        if (string.IsNullOrWhiteSpace(token))
            return;

        await Groups.AddToGroupAsync(Context.ConnectionId, $"customer:{token}");
    }

    /// <summary>
    /// Customer leaves their notification room (on disconnect or explicit leave).
    /// </summary>
    public async Task LeaveCustomerRoom(string token)
    {
        if (string.IsNullOrWhiteSpace(token))
            return;

        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"customer:{token}");
    }

    /// <summary>
    /// Staff joins a queue's management room.
    /// Called from client: connection.invoke("JoinStaffRoom", queueId)
    /// </summary>
    public async Task JoinStaffRoom(Guid queueId)
    {
        // TODO: Verify staff authorization for this queue
        await Groups.AddToGroupAsync(Context.ConnectionId, $"queue:{queueId}");
    }

    /// <summary>
    /// Staff leaves a queue's management room.
    /// </summary>
    public async Task LeaveStaffRoom(Guid queueId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"queue:{queueId}");
    }
}
