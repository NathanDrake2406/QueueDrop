using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QueueDrop.Domain.Abstractions;
using QueueDrop.Domain.Enums;
using QueueDrop.Infrastructure.Persistence;
using QueueDrop.Infrastructure.PushNotifications;

namespace QueueDrop.Api.Features.Queues;

/// <summary>
/// Vertical slice: Staff calls the next customer in queue.
/// POST /api/queues/{queueId}/call-next
/// </summary>
public static class CallNext
{
    public sealed record Response(
        Guid CustomerId,
        string CustomerName,
        string Token,
        int? PartySize,
        string? Notes);

    public static void MapEndpoint(IEndpointRouteBuilder app)
    {
        app.MapPost("/api/queues/{queueId:guid}/call-next", Handler)
            .WithName("CallNext")
            .WithTags("Queues")
            .Produces<Response>()
            .Produces<ProblemDetails>(StatusCodes.Status404NotFound)
            .Produces<ProblemDetails>(StatusCodes.Status409Conflict);
        // TODO: Add .RequireAuthorization() for staff auth
    }

    private static async Task<IResult> Handler(
        Guid queueId,
        AppDbContext db,
        IQueueHubNotifier notifier,
        IWebPushService webPush,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        // Get queue with customers (include for aggregate operations)
        var queue = await db.Queues
            .Include(q => q.Settings)
            .Include(q => q.Customers)
            .FirstOrDefaultAsync(q => q.Id == queueId, cancellationToken);

        if (queue is null)
        {
            return Results.Problem(
                title: "Queue not found",
                detail: $"No queue found with ID '{queueId}'.",
                statusCode: StatusCodes.Status404NotFound);
        }

        // Call next customer (domain logic)
        var now = timeProvider.GetUtcNow();
        var result = queue.CallNext(now);

        if (result.IsFailure)
        {
            var statusCode = result.Error.Code == "Queue.Empty"
                ? StatusCodes.Status404NotFound
                : StatusCodes.Status400BadRequest;

            return Results.Problem(
                title: "Could not call next customer",
                detail: result.Error.Message,
                statusCode: statusCode);
        }

        var calledCustomer = result.Value;

        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            return Results.Problem(
                title: "Concurrency conflict",
                detail: "Another staff member modified the queue. Please try again.",
                statusCode: StatusCodes.Status409Conflict);
        }

        // Get all position updates for remaining waiting customers
        var positionUpdates = queue.GetUpdatedPositions()
            .Select(u =>
            {
                var customer = queue.Customers.First(c => c.Id == u.CustomerId);
                return (customer.Token, u.NewPosition);
            })
            .ToList();

        // Send notifications in parallel
        var notificationTasks = new List<Task>
        {
            // Notify the called customer via SignalR
            notifier.NotifyCustomerCalledAsync(
                calledCustomer.Token,
                queue.Settings.CalledMessage,
                cancellationToken),

            // Notify all remaining customers of their new positions
            notifier.NotifyPositionsChangedAsync(positionUpdates, cancellationToken),

            // Notify staff dashboard
            notifier.NotifyQueueUpdatedAsync(queue.Id, QueueUpdateType.CustomerCalled, cancellationToken)
        };

        // Send Web Push notification if customer has a subscription
        if (!string.IsNullOrEmpty(calledCustomer.PushSubscription))
        {
            notificationTasks.Add(webPush.SendNotificationAsync(
                calledCustomer.PushSubscription,
                "It's Your Turn!",
                queue.Settings.CalledMessage ?? "You've been called! Please proceed.",
                cancellationToken));
        }

        await Task.WhenAll(notificationTasks);

        return Results.Ok(new Response(
            CustomerId: calledCustomer.Id,
            CustomerName: calledCustomer.Name,
            Token: calledCustomer.Token,
            PartySize: calledCustomer.PartySize,
            Notes: calledCustomer.Notes));
    }
}
