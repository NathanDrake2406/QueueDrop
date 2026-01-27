using QueueDrop.Domain.Common;

namespace QueueDrop.Domain.Entities;

/// <summary>
/// Represents a business that manages queues.
/// </summary>
public sealed class Business : Entity
{
    private readonly List<Queue> _queues = [];

    /// <summary>Display name of the business.</summary>
    public string Name { get; private set; } = null!;

    /// <summary>URL-friendly identifier (e.g., "demo-shop").</summary>
    public string Slug { get; private set; } = null!;

    /// <summary>Optional description.</summary>
    public string? Description { get; private set; }

    /// <summary>When the business was created.</summary>
    public DateTimeOffset CreatedAt { get; private init; }

    /// <summary>Read-only view of queues for this business.</summary>
    public IReadOnlyList<Queue> Queues => _queues.AsReadOnly();

    // EF Core constructor
    private Business() { }

    public static Business Create(string name, string slug, DateTimeOffset createdAt, string? description = null)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Business name is required", nameof(name));

        if (string.IsNullOrWhiteSpace(slug))
            throw new ArgumentException("Business slug is required", nameof(slug));

        return new Business
        {
            Id = Guid.NewGuid(),
            Name = name,
            Slug = NormalizeSlug(slug),
            Description = description,
            CreatedAt = createdAt
        };
    }

    public void UpdateName(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Business name is required", nameof(name));
        Name = name;
    }

    public void UpdateSlug(string slug)
    {
        if (string.IsNullOrWhiteSpace(slug))
            throw new ArgumentException("Business slug is required", nameof(slug));
        Slug = NormalizeSlug(slug);
    }

    public void UpdateDescription(string? description) => Description = description;

    private static string NormalizeSlug(string slug)
    {
        return slug.ToLowerInvariant().Trim();
    }
}
