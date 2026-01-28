using Microsoft.EntityFrameworkCore;
using QueueDrop.Domain.Entities;

namespace QueueDrop.Infrastructure.Persistence;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    // Allow derived classes to pass their own options type
    protected AppDbContext(DbContextOptions options) : base(options) { }

    public DbSet<Business> Businesses => Set<Business>();
    public DbSet<Queue> Queues => Set<Queue>();
    public DbSet<QueueCustomer> QueueCustomers => Set<QueueCustomer>();
    public DbSet<User> Users => Set<User>();
    public DbSet<BusinessMember> BusinessMembers => Set<BusinessMember>();
    public DbSet<MagicLink> MagicLinks => Set<MagicLink>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }
}
