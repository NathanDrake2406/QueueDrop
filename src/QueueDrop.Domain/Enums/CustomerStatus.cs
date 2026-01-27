namespace QueueDrop.Domain.Enums;

/// <summary>
/// Represents the status of a customer in the queue.
/// </summary>
public enum CustomerStatus
{
    /// <summary>Customer is waiting in the queue.</summary>
    Waiting = 0,

    /// <summary>Customer has been called and should proceed.</summary>
    Called = 1,

    /// <summary>Customer has been served and completed.</summary>
    Served = 2,

    /// <summary>Customer did not respond when called.</summary>
    NoShow = 3,

    /// <summary>Customer was removed from the queue (by staff or self).</summary>
    Removed = 4
}
