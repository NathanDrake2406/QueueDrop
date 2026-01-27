using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using QueueDrop.Domain.Entities;

namespace QueueDrop.Infrastructure.Persistence.Configurations;

public sealed class BusinessConfiguration : IEntityTypeConfiguration<Business>
{
    public void Configure(EntityTypeBuilder<Business> builder)
    {
        builder.ToTable("businesses");

        builder.HasKey(b => b.Id);

        builder.Property(b => b.Name)
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(b => b.Slug)
            .HasMaxLength(100)
            .IsRequired();

        builder.HasIndex(b => b.Slug)
            .IsUnique();

        builder.Property(b => b.Description)
            .HasMaxLength(1000);

        builder.Property(b => b.CreatedAt)
            .IsRequired();

        builder.HasMany(b => b.Queues)
            .WithOne(q => q.Business)
            .HasForeignKey(q => q.BusinessId)
            .OnDelete(DeleteBehavior.Cascade);

        // Seed data
        builder.HasData(new
        {
            Id = SeedData.DemoBusinessId,
            Name = "Demo Shop",
            Slug = "demo-shop",
            Description = "A demo business for testing QueueDrop",
            CreatedAt = SeedData.SeedDate
        });
    }
}
