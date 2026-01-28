using System.Security.Cryptography;
using QueueDrop.Domain.Common;
using QueueDrop.Domain.Enums;

namespace QueueDrop.Domain.Entities;

/// <summary>
/// One-time use link for passwordless authentication.
/// </summary>
public sealed class MagicLink : Entity
{
    /// <summary>URL-safe token (64 hex characters from 32 random bytes).</summary>
    public string Token { get; private init; } = null!;

    /// <summary>Email this link was sent to.</summary>
    public string Email { get; private init; } = null!;

    /// <summary>Type of magic link (login or invite).</summary>
    public MagicLinkType Type { get; private init; }

    /// <summary>For invite links, the business being invited to.</summary>
    public Guid? BusinessId { get; private init; }

    public DateTimeOffset CreatedAt { get; private init; }
    public DateTimeOffset ExpiresAt { get; private init; }
    public DateTimeOffset? UsedAt { get; private set; }

    // EF Core constructor
    private MagicLink() { }

    public static MagicLink CreateLoginLink(string email, DateTimeOffset now, TimeSpan expiresIn)
    {
        return new MagicLink
        {
            Id = Guid.NewGuid(),
            Token = GenerateToken(),
            Email = email.Trim().ToLowerInvariant(),
            Type = MagicLinkType.Login,
            BusinessId = null,
            CreatedAt = now,
            ExpiresAt = now.Add(expiresIn)
        };
    }

    public static MagicLink CreateInviteLink(string email, Guid businessId, DateTimeOffset now, TimeSpan expiresIn)
    {
        return new MagicLink
        {
            Id = Guid.NewGuid(),
            Token = GenerateToken(),
            Email = email.Trim().ToLowerInvariant(),
            Type = MagicLinkType.Invite,
            BusinessId = businessId,
            CreatedAt = now,
            ExpiresAt = now.Add(expiresIn)
        };
    }

    public bool IsExpired(DateTimeOffset now) => now >= ExpiresAt;

    public void MarkUsed(DateTimeOffset usedAt)
    {
        if (UsedAt.HasValue)
            throw new InvalidOperationException("Magic link has already been used");

        UsedAt = usedAt;
    }

    private static string GenerateToken()
    {
        return Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
    }
}
