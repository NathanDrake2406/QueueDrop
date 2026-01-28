using System.Text.RegularExpressions;
using QueueDrop.Domain.Common;

namespace QueueDrop.Domain.Entities;

/// <summary>
/// Represents an authenticated user (business owner or staff member).
/// </summary>
public sealed partial class User : Entity
{
    /// <summary>Email address (normalized to lowercase).</summary>
    public string Email { get; private set; } = null!;

    /// <summary>When the user account was created.</summary>
    public DateTimeOffset CreatedAt { get; private init; }

    // EF Core constructor
    private User() { }

    public static User Create(string email, DateTimeOffset createdAt)
    {
        if (string.IsNullOrWhiteSpace(email))
            throw new ArgumentException("Email is required", nameof(email));

        var normalized = email.Trim().ToLowerInvariant();

        if (!EmailRegex().IsMatch(normalized))
            throw new ArgumentException("Invalid email format", nameof(email));

        return new User
        {
            Id = Guid.NewGuid(),
            Email = normalized,
            CreatedAt = createdAt
        };
    }

    [GeneratedRegex(@"^[^@\s]+@[^@\s]+\.[^@\s]+$", RegexOptions.Compiled)]
    private static partial Regex EmailRegex();
}
