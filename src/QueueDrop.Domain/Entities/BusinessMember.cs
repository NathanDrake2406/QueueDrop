using QueueDrop.Domain.Common;
using QueueDrop.Domain.Enums;

namespace QueueDrop.Domain.Entities;

/// <summary>
/// Links a User to a Business with a specific role.
/// </summary>
public sealed class BusinessMember : Entity
{
    public Guid UserId { get; private init; }
    public Guid BusinessId { get; private init; }
    public BusinessRole Role { get; private init; }
    public DateTimeOffset InvitedAt { get; private init; }
    public DateTimeOffset? JoinedAt { get; private set; }

    // Navigation properties
    public User User { get; private set; } = null!;
    public Business Business { get; private set; } = null!;

    // EF Core constructor
    private BusinessMember() { }

    /// <summary>Creates a business member as owner (immediately joined).</summary>
    public static BusinessMember CreateOwner(Guid userId, Guid businessId, DateTimeOffset now)
    {
        return new BusinessMember
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            BusinessId = businessId,
            Role = BusinessRole.Owner,
            InvitedAt = now,
            JoinedAt = now
        };
    }

    /// <summary>Creates a pending staff invite (not yet joined).</summary>
    public static BusinessMember CreateStaffInvite(Guid userId, Guid businessId, DateTimeOffset invitedAt)
    {
        return new BusinessMember
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            BusinessId = businessId,
            Role = BusinessRole.Staff,
            InvitedAt = invitedAt,
            JoinedAt = null
        };
    }

    public void AcceptInvite(DateTimeOffset joinedAt)
    {
        if (JoinedAt.HasValue)
            throw new InvalidOperationException("Invite has already been accepted");

        JoinedAt = joinedAt;
    }
}
