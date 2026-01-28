using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using QueueDrop.Domain.Entities;

namespace QueueDrop.Infrastructure.Persistence.Configurations;

public sealed class BusinessMemberConfiguration : IEntityTypeConfiguration<BusinessMember>
{
    public void Configure(EntityTypeBuilder<BusinessMember> builder)
    {
        builder.ToTable("business_members");

        builder.HasKey(bm => bm.Id);

        builder.Property(bm => bm.Role)
            .HasConversion<string>()
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(bm => bm.InvitedAt)
            .IsRequired();

        builder.HasIndex(bm => new { bm.UserId, bm.BusinessId })
            .IsUnique();

        builder.HasIndex(bm => bm.UserId);
        builder.HasIndex(bm => bm.BusinessId);

        builder.HasOne(bm => bm.User)
            .WithMany()
            .HasForeignKey(bm => bm.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(bm => bm.Business)
            .WithMany()
            .HasForeignKey(bm => bm.BusinessId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
