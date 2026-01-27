using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QueueDrop.Domain.Abstractions;
using QueueDrop.Infrastructure.Persistence;

namespace QueueDrop.Api.Features.Queues;

/// <summary>
/// Vertical slice: Mark a customer as served.
/// POST /api/queues/{queueId}/customers/{customerId}/serve
/// </summary>
public static class MarkServed
{
    public static void MapEndpoint(IEndpointRouteBuilder app)
    {
        app.MapPost("/api/queues/{queueId:guid}/customers/{customerId:guid}/serve", Handler)
            .WithName("MarkCustomerServed")
            .WithTags("Queues")
            .Produces(StatusCodes.Status204NoContent)
            .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
            .Produces<ProblemDetails>(StatusCodes.Status404NotFound)
            .Produces<ProblemDetails>(StatusCodes.Status409Conflict);
    }

    private static async Task<IResult> Handler(
        Guid queueId,
        Guid customerId,
        AppDbContext db,
        IQueueHubNotifier notifier,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        var queue = await db.Queues
            .Include(q => q.Customers)
            .FirstOrDefaultAsync(q => q.Id == queueId, cancellationToken);

        if (queue is null)
        {
            return Results.Problem(
                title: "Queue not found",
                detail: $"No queue found with ID '{queueId}'.",
                statusCode: StatusCodes.Status404NotFound);
        }

        var customer = queue.Customers.FirstOrDefault(c => c.Id == customerId);
        if (customer is null)
        {
            return Results.Problem(
                title: "Customer not found",
                detail: $"No customer found with ID '{customerId}' in this queue.",
                statusCode: StatusCodes.Status404NotFound);
        }

        var now = timeProvider.GetUtcNow();
        var result = queue.MarkCustomerServed(customerId, now);

        if (result.IsFailure)
        {
            return Results.Problem(
                title: "Cannot mark as served",
                detail: result.Error.Message,
                statusCode: StatusCodes.Status400BadRequest);
        }

        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            return Results.Problem(
                title: "Concurrent modification",
                detail: "The queue was modified by another request. Please retry.",
                statusCode: StatusCodes.Status409Conflict);
        }

        // Notify customer of status change
        await notifier.NotifyStatusChangedAsync(customer.Token, "Served", cancellationToken);

        // Notify staff that queue updated
        await notifier.NotifyQueueUpdatedAsync(queueId, QueueUpdateType.CustomerServed, cancellationToken);

        return Results.NoContent();
    }
}
