using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QueueDrop.Domain.Abstractions;
using QueueDrop.Infrastructure.Persistence;

namespace QueueDrop.Api.Features.Queues;

/// <summary>
/// Vertical slice: Remove a customer from the queue.
/// DELETE /api/queues/{queueId}/customers/{customerId}
/// </summary>
public static class RemoveCustomer
{
    public static void MapEndpoint(IEndpointRouteBuilder app)
    {
        app.MapDelete("/api/queues/{queueId:guid}/customers/{customerId:guid}", Handler)
            .WithName("RemoveCustomer")
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

        var customerToken = customer.Token;
        var result = queue.RemoveCustomer(customerId);

        if (result.IsFailure)
        {
            return Results.Problem(
                title: "Cannot remove customer",
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

        // Notify customer of removal
        await notifier.NotifyStatusChangedAsync(customerToken, "Removed", cancellationToken);

        // Notify staff that queue updated
        await notifier.NotifyQueueUpdatedAsync(queueId, QueueUpdateType.CustomerRemoved, cancellationToken);

        // Update positions for remaining waiting customers
        var updatedPositions = queue.GetUpdatedPositions()
            .Select(p => (queue.Customers.First(c => c.Id == p.CustomerId).Token, p.NewPosition))
            .ToList();

        if (updatedPositions.Count > 0)
        {
            await notifier.NotifyPositionsChangedAsync(updatedPositions, cancellationToken);
        }

        return Results.NoContent();
    }
}
