using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using QueueDrop.Domain.Entities;

namespace QueueDrop.Infrastructure.Persistence.Configurations;

public sealed class QueueConfiguration : IEntityTypeConfiguration<Queue>
{
    public void Configure(EntityTypeBuilder<Queue> builder)
    {
        builder.ToTable("queues");

        builder.HasKey(q => q.Id);

        builder.Property(q => q.Name)
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(q => q.Slug)
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(q => q.IsActive)
            .IsRequired();

        builder.Property(q => q.IsPaused)
            .IsRequired();

        builder.Property(q => q.BusinessId)
            .IsRequired();

        builder.Property(q => q.CreatedAt)
            .IsRequired();

        // Optimistic concurrency - use IsConcurrencyToken for cross-provider compatibility
        // Note: For PostgreSQL, configure trigger-based row versioning in migration
        builder.Property(q => q.RowVersion)
            .IsConcurrencyToken();

        // QueueSettings as owned entity (stored in same table)
        builder.OwnsOne(q => q.Settings, settings =>
        {
            settings.Property(s => s.MaxQueueSize)
                .HasColumnName("settings_max_queue_size");

            settings.Property(s => s.EstimatedServiceTimeMinutes)
                .HasColumnName("settings_estimated_service_time_minutes")
                .HasDefaultValue(5);

            settings.Property(s => s.AllowJoinWhenPaused)
                .HasColumnName("settings_allow_join_when_paused")
                .HasDefaultValue(false);

            settings.Property(s => s.NoShowTimeoutMinutes)
                .HasColumnName("settings_no_show_timeout_minutes")
                .HasDefaultValue(5);

            settings.Property(s => s.WelcomeMessage)
                .HasColumnName("settings_welcome_message")
                .HasMaxLength(500);

            settings.Property(s => s.CalledMessage)
                .HasColumnName("settings_called_message")
                .HasMaxLength(500);
        });

        builder.Navigation(q => q.Settings).IsRequired();

        builder.HasMany(q => q.Customers)
            .WithOne()
            .HasForeignKey(c => c.QueueId)
            .OnDelete(DeleteBehavior.Cascade);

        // Explicitly configure backing field for proper change tracking
        builder.Navigation(q => q.Customers)
            .UsePropertyAccessMode(PropertyAccessMode.Field);

        builder.HasIndex(q => q.BusinessId);
        builder.HasIndex(q => new { q.BusinessId, q.IsActive });
        builder.HasIndex(q => new { q.BusinessId, q.Slug }).IsUnique();

        // Seed data - Main Queue
        builder.HasData(new
        {
            Id = SeedData.DemoQueueId,
            BusinessId = SeedData.DemoBusinessId,
            Name = "Main Queue",
            Slug = "main-queue",
            IsActive = true,
            IsPaused = false,
            CreatedAt = SeedData.SeedDate,
            RowVersion = new byte[] { 0, 0, 0, 0, 0, 0, 0, 1 }
        });

        // Seed data - Takeout Queue
        builder.HasData(new
        {
            Id = SeedData.TakeoutQueueId,
            BusinessId = SeedData.DemoBusinessId,
            Name = "Takeout",
            Slug = "takeout",
            IsActive = true,
            IsPaused = false,
            CreatedAt = SeedData.SeedDate,
            RowVersion = new byte[] { 0, 0, 0, 0, 0, 0, 0, 1 }
        });

        // Seed data - Bar Queue
        builder.HasData(new
        {
            Id = SeedData.BarQueueId,
            BusinessId = SeedData.DemoBusinessId,
            Name = "Bar",
            Slug = "bar",
            IsActive = true,
            IsPaused = false,
            CreatedAt = SeedData.SeedDate,
            RowVersion = new byte[] { 0, 0, 0, 0, 0, 0, 0, 1 }
        });

        // Seed owned entity data (QueueSettings) - Main Queue
        builder.OwnsOne(q => q.Settings).HasData(new
        {
            QueueId = SeedData.DemoQueueId,
            MaxQueueSize = (int?)null,
            EstimatedServiceTimeMinutes = 5,
            AllowJoinWhenPaused = false,
            NoShowTimeoutMinutes = 5,
            WelcomeMessage = (string?)null,
            CalledMessage = (string?)null
        });

        // Seed owned entity data (QueueSettings) - Takeout Queue
        builder.OwnsOne(q => q.Settings).HasData(new
        {
            QueueId = SeedData.TakeoutQueueId,
            MaxQueueSize = (int?)null,
            EstimatedServiceTimeMinutes = 3,
            AllowJoinWhenPaused = false,
            NoShowTimeoutMinutes = 5,
            WelcomeMessage = (string?)null,
            CalledMessage = (string?)null
        });

        // Seed owned entity data (QueueSettings) - Bar Queue
        builder.OwnsOne(q => q.Settings).HasData(new
        {
            QueueId = SeedData.BarQueueId,
            MaxQueueSize = 20,
            EstimatedServiceTimeMinutes = 10,
            AllowJoinWhenPaused = false,
            NoShowTimeoutMinutes = 5,
            WelcomeMessage = (string?)null,
            CalledMessage = (string?)null
        });
    }
}
