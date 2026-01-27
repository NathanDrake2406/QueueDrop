using Microsoft.EntityFrameworkCore;
using QueueDrop.Domain.Entities;
using QueueDrop.Infrastructure.Persistence;

namespace QueueDrop.Api.Tests;

/// <summary>
/// Test-specific DbContext that handles InMemory provider quirks:
/// 1. Disables concurrency checking (InMemory doesn't support row versioning)
/// 2. Fixes entity state detection for entities added through navigation properties
/// </summary>
public sealed class TestAppDbContext : AppDbContext
{
    public TestAppDbContext(DbContextOptions<TestAppDbContext> options) : base(options)
    {
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // InMemory provider has issues with row versioning - disable it for tests
        modelBuilder.Entity<Queue>(builder =>
        {
            builder.Property(q => q.RowVersion)
                .IsConcurrencyToken(false);
        });
    }

    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        // InMemory provider has a bug where entities added through navigation properties
        // with backing fields are detected as Modified instead of Added.
        // Fix: Check if "Modified" entities actually exist in the store - if not, mark as Added.
        FixEntityStatesForInMemoryProvider();
        return await base.SaveChangesAsync(cancellationToken);
    }

    public override int SaveChanges()
    {
        FixEntityStatesForInMemoryProvider();
        return base.SaveChanges();
    }

    private void FixEntityStatesForInMemoryProvider()
    {
        // InMemory provider has a bug where entities added through navigation properties
        // with backing fields are detected as Modified instead of Added.
        // Fix: Check if "Modified" entities actually exist in the store - if not, mark as Added.
        var modifiedEntries = ChangeTracker.Entries()
            .Where(e => e.State == EntityState.Modified)
            .ToList();

        foreach (var entry in modifiedEntries)
        {
            if (entry.Entity is QueueCustomer customer)
            {
                var existsInStore = QueueCustomers
                    .AsNoTracking()
                    .Any(c => c.Id == customer.Id);

                if (!existsInStore)
                {
                    entry.State = EntityState.Added;
                }
            }
        }
    }
}
