using Microsoft.EntityFrameworkCore;
using QueueDrop.Domain.Abstractions;
using QueueDrop.Domain.Enums;
using QueueDrop.Infrastructure.Persistence;

namespace QueueDrop.Api.BackgroundServices;

/// <summary>
/// Background service that automatically marks called customers as no-show
/// after the configured timeout period expires.
/// </summary>
public sealed class AutoNoShowService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<AutoNoShowService> _logger;
    private readonly TimeSpan _checkInterval = TimeSpan.FromSeconds(30);

    public AutoNoShowService(
        IServiceScopeFactory scopeFactory,
        ILogger<AutoNoShowService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("AutoNoShowService started");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessExpiredCalledCustomersAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                // Expected during shutdown
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing expired called customers");
            }

            await Task.Delay(_checkInterval, stoppingToken);
        }

        _logger.LogInformation("AutoNoShowService stopped");
    }

    private async Task ProcessExpiredCalledCustomersAsync(CancellationToken cancellationToken)
    {
        await using var scope = _scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var timeProvider = scope.ServiceProvider.GetRequiredService<TimeProvider>();
        var notifier = scope.ServiceProvider.GetRequiredService<IQueueHubNotifier>();

        var now = timeProvider.GetUtcNow();

        // Find all active queues with called customers
        var queuesWithCalledCustomers = await db.Queues
            .Include(q => q.Customers.Where(c => c.Status == CustomerStatus.Called))
            .Where(q => q.IsActive && q.Customers.Any(c => c.Status == CustomerStatus.Called))
            .ToListAsync(cancellationToken);

        foreach (var queue in queuesWithCalledCustomers)
        {
            await ProcessQueueWithRetryAsync(queue.Id, db, notifier, timeProvider, cancellationToken);
        }
    }


    private async Task ProcessQueueWithRetryAsync(
        Guid queueId,
        AppDbContext db,
        IQueueHubNotifier notifier,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        const int maxRetries = 3;

        for (var attempt = 1; attempt <= maxRetries; attempt++)
        {
            try
            {
                // Reload queue fresh from database on each attempt
                var queue = await db.Queues
                    .Include(q => q.Settings)
                    .Include(q => q.Customers.Where(c => c.Status == CustomerStatus.Called))
                    .FirstOrDefaultAsync(q => q.Id == queueId, cancellationToken);

                if (queue is null)
                    return;

                var now = timeProvider.GetUtcNow();
                var timeoutMinutes = queue.Settings.NoShowTimeoutMinutes;

                // Find expired called customers for this queue
                var expiredCustomers = queue.Customers
                    .Where(c => c.Status == CustomerStatus.Called &&
                               c.CalledAt.HasValue &&
                               c.CalledAt.Value.AddMinutes(timeoutMinutes) < now)
                    .ToList();

                if (expiredCustomers.Count == 0)
                    return;

                _logger.LogInformation(
                    "Marking {Count} customers as no-show in queue {QueueId} (timeout: {Timeout} minutes)",
                    expiredCustomers.Count,
                    queue.Id,
                    timeoutMinutes);

                foreach (var customer in expiredCustomers)
                {
                    var result = queue.MarkCustomerNoShow(customer.Id, now);
                    if (result.IsFailure)
                    {
                        _logger.LogWarning(
                            "Failed to mark customer {CustomerId} as no-show: {Error}",
                            customer.Id,
                            result.Error.Message);
                        continue;
                    }

                    // Notify customer
                    await notifier.NotifyStatusChangedAsync(customer.Token, "NoShow", cancellationToken);
                }

                await db.SaveChangesAsync(cancellationToken);

                // Notify staff about queue update
                await notifier.NotifyQueueUpdatedAsync(queue.Id, QueueUpdateType.CustomerNoShow, cancellationToken);

                // Update positions for remaining waiting customers
                var updatedPositions = queue.GetUpdatedPositions()
                    .Select(p => (queue.Customers.First(c => c.Id == p.CustomerId).Token, p.NewPosition))
                    .ToList();

                if (updatedPositions.Count > 0)
                {
                    await notifier.NotifyPositionsChangedAsync(updatedPositions, cancellationToken);
                }

                return; // Success, exit retry loop
            }
            catch (DbUpdateConcurrencyException) when (attempt < maxRetries)
            {
                _logger.LogWarning(
                    "Concurrency conflict processing queue {QueueId}, attempt {Attempt}/{MaxRetries}. Retrying...",
                    queueId,
                    attempt,
                    maxRetries);

                // Clear the change tracker to get fresh entities on next attempt
                db.ChangeTracker.Clear();
            }
            catch (DbUpdateConcurrencyException)
            {
                _logger.LogError(
                    "Concurrency conflict processing queue {QueueId} after {MaxRetries} attempts. Giving up.",
                    queueId,
                    maxRetries);
            }
        }
    }
}
