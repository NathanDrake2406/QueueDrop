using QueueDrop.Domain.Common;
using QueueDrop.Domain.Enums;

namespace QueueDrop.Domain.Entities;

/// <summary>
/// Represents a customer in a queue.
/// Owned by the Queue aggregate - all mutations go through Queue methods.
/// </summary>
public sealed class QueueCustomer : Entity
{
    /// <summary>Unique token for customer URL access (e.g., /q/{token}).</summary>
    public string Token { get; private init; } = null!;

    /// <summary>Customer's display name.</summary>
    public string Name { get; private init; } = null!;

    /// <summary>Current status in the queue.</summary>
    public CustomerStatus Status { get; private set; }

    /// <summary>Position when customer joined (1-based, for historical reference).</summary>
    public int JoinPosition { get; private init; }

    /// <summary>When the customer joined the queue.</summary>
    public DateTimeOffset JoinedAt { get; private init; }

    /// <summary>When the customer was called (null if not yet called).</summary>
    public DateTimeOffset? CalledAt { get; private set; }

    /// <summary>When the customer was served/completed (null if not yet served).</summary>
    public DateTimeOffset? ServedAt { get; private set; }

    /// <summary>Foreign key to parent queue.</summary>
    public Guid QueueId { get; private init; }

    /// <summary>Optional phone number for notifications.</summary>
    public string? PhoneNumber { get; private init; }

    /// <summary>Optional party size.</summary>
    public int? PartySize { get; private init; }

    /// <summary>Optional notes from customer.</summary>
    public string? Notes { get; private init; }

    /// <summary>Serialized Web Push subscription (JSON) for notifications.</summary>
    public string? PushSubscription { get; private set; }

    /// <summary>When the customer was notified they're near the front. Null if not yet notified.</summary>
    public DateTimeOffset? NearFrontNotifiedAt { get; private set; }

    internal void MarkNearFrontNotified(DateTimeOffset timestamp) => NearFrontNotifiedAt = timestamp;

    // EF Core constructor
    private QueueCustomer() { }

    /// <summary>
    /// Sets the push subscription for this customer.
    /// Called by the API when customer enables push notifications.
    /// </summary>
    internal void SetPushSubscription(string? subscription) => PushSubscription = subscription;

    internal static QueueCustomer Create(
        Guid queueId,
        string name,
        int joinPosition,
        DateTimeOffset joinedAt,
        string? phoneNumber = null,
        int? partySize = null,
        string? notes = null)
    {
        return new QueueCustomer
        {
            Id = Guid.NewGuid(),
            Token = GenerateToken(),
            QueueId = queueId,
            Name = name,
            Status = CustomerStatus.Waiting,
            JoinPosition = joinPosition,
            JoinedAt = joinedAt,
            PhoneNumber = phoneNumber,
            PartySize = partySize,
            Notes = notes
        };
    }

    internal void MarkAsCalled(DateTimeOffset calledAt)
    {
        if (Status != CustomerStatus.Waiting)
            throw new InvalidOperationException($"Cannot call customer with status {Status}");

        Status = CustomerStatus.Called;
        CalledAt = calledAt;
    }

    internal void MarkAsServed(DateTimeOffset servedAt)
    {
        if (Status != CustomerStatus.Called)
            throw new InvalidOperationException($"Cannot mark customer as served with status {Status}");

        Status = CustomerStatus.Served;
        ServedAt = servedAt;
    }

    internal void MarkAsNoShow(DateTimeOffset timestamp)
    {
        if (Status != CustomerStatus.Called)
            throw new InvalidOperationException($"Cannot mark customer as no-show with status {Status}");

        Status = CustomerStatus.NoShow;
        ServedAt = timestamp;
    }

    internal void MarkAsRemoved()
    {
        if (Status is CustomerStatus.Served or CustomerStatus.NoShow)
            throw new InvalidOperationException($"Cannot remove customer with status {Status}");

        Status = CustomerStatus.Removed;
    }

    private static string GenerateToken()
    {
        // Generate URL-safe token: 8 random bytes = 11 base64 chars (trimmed)
        var bytes = new byte[8];
        Random.Shared.NextBytes(bytes);
        return Convert.ToBase64String(bytes)
            .Replace("+", "-")
            .Replace("/", "_")
            .TrimEnd('=');
    }
}
