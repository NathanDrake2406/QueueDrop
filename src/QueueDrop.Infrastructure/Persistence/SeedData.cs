namespace QueueDrop.Infrastructure.Persistence;

/// <summary>
/// Seed data IDs - fixed GUIDs for reproducible migrations.
/// </summary>
public static class SeedData
{
    public static readonly Guid DemoBusinessId = new("11111111-1111-1111-1111-111111111111");
    public static readonly Guid DemoQueueId = new("22222222-2222-2222-2222-222222222222");

    public static readonly DateTimeOffset SeedDate = new(2024, 1, 1, 0, 0, 0, TimeSpan.Zero);
}
