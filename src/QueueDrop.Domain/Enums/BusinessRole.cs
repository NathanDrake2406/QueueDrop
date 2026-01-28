namespace QueueDrop.Domain.Enums;

/// <summary>
/// Role a user has within a business.
/// </summary>
public enum BusinessRole
{
    /// <summary>Full access - can configure business, manage queues, invite staff.</summary>
    Owner = 0,

    /// <summary>Limited access - can operate queues (call next, mark served).</summary>
    Staff = 1
}
