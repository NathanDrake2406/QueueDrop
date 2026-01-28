using QueueDrop.Domain.Common;
using QueueDrop.Domain.Enums;

namespace QueueDrop.Domain.Entities;

/// <summary>
/// Aggregate root for queue management.
/// All queue mutations go through this entity to enforce invariants.
/// </summary>
public sealed class Queue : Entity
{
    private List<QueueCustomer> _customers = [];

    /// <summary>Display name of the queue.</summary>
    public string Name { get; private set; } = null!;

    /// <summary>URL-friendly identifier (e.g., "main-queue", "takeout").</summary>
    public string Slug { get; private set; } = null!;

    /// <summary>Whether the queue is currently accepting customers.</summary>
    public bool IsActive { get; private set; }

    /// <summary>Whether the queue is paused (not calling next, but may accept joins).</summary>
    public bool IsPaused { get; private set; }

    /// <summary>Foreign key to parent business.</summary>
    public Guid BusinessId { get; private init; }

    /// <summary>Queue configuration settings.</summary>
    public QueueSettings Settings { get; private set; } = QueueSettings.Default;

    /// <summary>Concurrency token for optimistic concurrency.</summary>
    public byte[] RowVersion { get; private set; } = [];

    /// <summary>When the queue was created.</summary>
    public DateTimeOffset CreatedAt { get; private init; }

    /// <summary>Read-only view of customers in this queue.</summary>
    public IReadOnlyList<QueueCustomer> Customers => _customers.AsReadOnly();

    // Navigation property
    public Business? Business { get; private init; }

    // EF Core constructor
    private Queue() { }

    public static Queue Create(Guid businessId, string name, string slug, DateTimeOffset createdAt)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Queue name is required", nameof(name));

        if (string.IsNullOrWhiteSpace(slug))
            throw new ArgumentException("Queue slug is required", nameof(slug));

        return new Queue
        {
            Id = Guid.NewGuid(),
            BusinessId = businessId,
            Name = name,
            Slug = NormalizeSlug(slug),
            IsActive = true,
            IsPaused = false,
            Settings = QueueSettings.Default,
            CreatedAt = createdAt,
            RowVersion = BitConverter.GetBytes(DateTimeOffset.UtcNow.Ticks)
        };
    }

    private static string NormalizeSlug(string slug)
    {
        return slug.ToLowerInvariant().Trim();
    }

    /// <summary>
    /// Adds a customer to the queue.
    /// </summary>
    public Result<QueueCustomer> AddCustomer(
        string name,
        DateTimeOffset joinedAt,
        string? phoneNumber = null,
        int? partySize = null,
        string? notes = null)
    {
        if (string.IsNullOrWhiteSpace(name) || name.Length > 100)
            return DomainErrors.Customer.InvalidName;

        if (!IsActive)
            return DomainErrors.Queue.NotActive;

        if (Settings.MaxQueueSize.HasValue && GetWaitingCount() >= Settings.MaxQueueSize.Value)
            return new Error("Queue.Full", "Queue has reached maximum capacity.");

        var joinPosition = _customers.Count + 1;
        var customer = QueueCustomer.Create(
            Id,
            name.Trim(),
            joinPosition,
            joinedAt,
            phoneNumber,
            partySize,
            notes);

        _customers.Add(customer);
        return customer;
    }

    /// <summary>
    /// Calls the next waiting customer.
    /// </summary>
    public Result<QueueCustomer> CallNext(DateTimeOffset calledAt)
    {
        if (!IsActive)
            return DomainErrors.Queue.NotActive;

        var nextCustomer = _customers
            .Where(c => c.Status == CustomerStatus.Waiting)
            .OrderBy(c => c.JoinedAt)
            .ThenBy(c => c.JoinPosition)
            .FirstOrDefault();

        if (nextCustomer is null)
            return DomainErrors.Queue.Empty;

        nextCustomer.MarkAsCalled(calledAt);
        return nextCustomer;
    }

    /// <summary>
    /// Marks a customer as served (completed).
    /// </summary>
    public Result MarkCustomerServed(Guid customerId, DateTimeOffset servedAt)
    {
        var customer = _customers.Find(c => c.Id == customerId);
        if (customer is null)
            return DomainErrors.Queue.CustomerNotFound(customerId);

        if (customer.Status != CustomerStatus.Called)
            return DomainErrors.Customer.NotWaiting;

        customer.MarkAsServed(servedAt);
        return Result.Success();
    }

    /// <summary>
    /// Marks a customer as no-show.
    /// </summary>
    public Result MarkCustomerNoShow(Guid customerId, DateTimeOffset timestamp)
    {
        var customer = _customers.Find(c => c.Id == customerId);
        if (customer is null)
            return DomainErrors.Queue.CustomerNotFound(customerId);

        if (customer.Status != CustomerStatus.Called)
            return new Error("Customer.NotCalled", "Can only mark called customers as no-show.");

        customer.MarkAsNoShow(timestamp);
        return Result.Success();
    }

    /// <summary>
    /// Removes a customer from the queue.
    /// </summary>
    public Result RemoveCustomer(Guid customerId)
    {
        var customer = _customers.Find(c => c.Id == customerId);
        if (customer is null)
            return DomainErrors.Queue.CustomerNotFound(customerId);

        if (customer.Status is CustomerStatus.Served or CustomerStatus.NoShow)
            return new Error("Customer.AlreadyCompleted", "Cannot remove a customer who has already been served.");

        customer.MarkAsRemoved();
        return Result.Success();
    }

    /// <summary>
    /// Gets the current position of a customer (1-based).
    /// Returns null if customer is not waiting.
    /// </summary>
    public int? GetCustomerPosition(Guid customerId)
    {
        var waitingCustomers = _customers
            .Where(c => c.Status == CustomerStatus.Waiting)
            .OrderBy(c => c.JoinedAt)
            .ThenBy(c => c.JoinPosition) // Secondary sort for stable ordering
            .ToList();

        var index = waitingCustomers.FindIndex(c => c.Id == customerId);
        return index >= 0 ? index + 1 : null;
    }

    /// <summary>
    /// Gets customers whose positions changed (all waiting customers after called customer).
    /// </summary>
    public IReadOnlyList<(Guid CustomerId, int NewPosition)> GetUpdatedPositions()
    {
        return _customers
            .Where(c => c.Status == CustomerStatus.Waiting)
            .OrderBy(c => c.JoinedAt)
            .ThenBy(c => c.JoinPosition)
            .Select((c, index) => (c.Id, NewPosition: index + 1))
            .ToList();
    }

    /// <summary>
    /// Gets number of customers currently waiting.
    /// </summary>
    public int GetWaitingCount() => _customers.Count(c => c.Status == CustomerStatus.Waiting);

    /// <summary>
    /// Gets number of customers served in a time window.
    /// </summary>
    public int GetServedCount(DateTimeOffset since) =>
        _customers.Count(c => c.Status == CustomerStatus.Served && c.ServedAt >= since);

    public void Activate() => IsActive = true;
    public void Deactivate() => IsActive = false;
    public void Pause() => IsPaused = true;
    public void Resume() => IsPaused = false;

    public void UpdateSettings(QueueSettings settings)
    {
        Settings = settings ?? throw new ArgumentNullException(nameof(settings));
    }

    public void Rename(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Queue name is required", nameof(name));
        Name = name;
    }

    public void UpdateSlug(string slug)
    {
        if (string.IsNullOrWhiteSpace(slug))
            throw new ArgumentException("Queue slug is required", nameof(slug));
        Slug = NormalizeSlug(slug);
    }

    /// <summary>
    /// Sets the push subscription for a customer.
    /// </summary>
    public Result SetCustomerPushSubscription(Guid customerId, string? subscription)
    {
        var customer = _customers.Find(c => c.Id == customerId);
        if (customer is null)
            return DomainErrors.Queue.CustomerNotFound(customerId);

        customer.SetPushSubscription(subscription);
        return Result.Success();
    }

    /// <summary>
    /// Gets a customer by their token.
    /// </summary>
    public QueueCustomer? GetCustomerByToken(string token)
    {
        return _customers.Find(c => c.Token == token);
    }

    /// <summary>
    /// Marks a customer as having been notified that they're near the front of the queue.
    /// </summary>
    public Result MarkCustomerNearFrontNotified(Guid customerId, DateTimeOffset timestamp)
    {
        var customer = _customers.Find(c => c.Id == customerId);
        if (customer is null)
            return DomainErrors.Queue.CustomerNotFound(customerId);

        customer.MarkNearFrontNotified(timestamp);
        return Result.Success();
    }
}
