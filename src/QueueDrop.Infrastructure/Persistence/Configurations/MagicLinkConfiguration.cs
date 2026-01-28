using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using QueueDrop.Domain.Entities;

namespace QueueDrop.Infrastructure.Persistence.Configurations;

public sealed class MagicLinkConfiguration : IEntityTypeConfiguration<MagicLink>
{
    public void Configure(EntityTypeBuilder<MagicLink> builder)
    {
        builder.ToTable("magic_links");

        builder.HasKey(ml => ml.Id);

        builder.Property(ml => ml.Token)
            .HasMaxLength(64)
            .IsRequired();

        builder.HasIndex(ml => ml.Token)
            .IsUnique();

        builder.Property(ml => ml.Email)
            .HasMaxLength(255)
            .IsRequired();

        builder.HasIndex(ml => ml.Email);

        builder.Property(ml => ml.Type)
            .HasConversion<string>()
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(ml => ml.CreatedAt)
            .IsRequired();

        builder.Property(ml => ml.ExpiresAt)
            .IsRequired();
    }
}
