using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using QueueDrop.Domain.Entities;

namespace QueueDrop.Infrastructure.Persistence.Configurations;

public sealed class QueueCustomerConfiguration : IEntityTypeConfiguration<QueueCustomer>
{
    public void Configure(EntityTypeBuilder<QueueCustomer> builder)
    {
        builder.ToTable("queue_customers");

        builder.HasKey(c => c.Id);

        builder.Property(c => c.Token)
            .HasMaxLength(20)
            .IsRequired();

        // Index on token for fast lookup (primary access pattern)
        builder.HasIndex(c => c.Token)
            .IsUnique();

        builder.Property(c => c.Name)
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(c => c.Status)
            .IsRequired();

        builder.Property(c => c.JoinPosition)
            .IsRequired();

        builder.Property(c => c.JoinedAt)
            .IsRequired();

        builder.Property(c => c.CalledAt);

        builder.Property(c => c.ServedAt);

        builder.Property(c => c.QueueId)
            .IsRequired();

        builder.Property(c => c.PhoneNumber)
            .HasMaxLength(20);

        builder.Property(c => c.PartySize);

        builder.Property(c => c.Notes)
            .HasMaxLength(500);

        // Indexes for common queries
        builder.HasIndex(c => c.QueueId);
        builder.HasIndex(c => new { c.QueueId, c.Status });
        builder.HasIndex(c => new { c.QueueId, c.JoinedAt });
    }
}
