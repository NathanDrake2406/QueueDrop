using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QueueDrop.Domain.Abstractions;
using QueueDrop.Domain.Entities;
using QueueDrop.Domain.Enums;
using QueueDrop.Infrastructure.Persistence;

namespace QueueDrop.Api.Features.Customers;

/// <summary>
/// Vertical slice: Customer joins a queue.
/// POST /api/join/{businessSlug}/{queueSlug?}
/// </summary>
public static class JoinQueue
{
    public sealed record Request(string Name, string? PhoneNumber = null, int? PartySize = null, string? Notes = null);

    public sealed record Response(string Token, int Position, string QueueName, string QueueSlug);

    public sealed record QueueOptionDto(string Name, string Slug, int WaitingCount, int EstimatedWaitMinutes);

    public sealed record MultipleQueuesResponse(string Message, IReadOnlyList<QueueOptionDto> Queues);

    public static void MapEndpoint(IEndpointRouteBuilder app)
    {
        // Route with optional queueSlug
        app.MapPost("/api/join/{businessSlug}/{queueSlug?}", Handler)
            .WithName("JoinQueue")
            .WithTags("Customers")
            .Produces<Response>(StatusCodes.Status201Created)
            .Produces<MultipleQueuesResponse>(StatusCodes.Status400BadRequest)
            .Produces<ProblemDetails>(StatusCodes.Status404NotFound)
            .Produces<ProblemDetails>(StatusCodes.Status409Conflict);
    }

    private static async Task<IResult> Handler(
        string businessSlug,
        string? queueSlug,
        Request request,
        AppDbContext db,
        IQueueHubNotifier notifier,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        // Validation
        if (string.IsNullOrWhiteSpace(request.Name) || request.Name.Length > 100)
        {
            return Results.Problem(
                title: "Invalid customer name",
                detail: "Name is required and must be between 1 and 100 characters.",
                statusCode: StatusCodes.Status400BadRequest);
        }

        // Find business by slug
        var business = await db.Businesses
            .Include(b => b.Queues)
                .ThenInclude(q => q.Customers)
            .FirstOrDefaultAsync(b => b.Slug == businessSlug.ToLowerInvariant(), cancellationToken);

        if (business is null)
        {
            return Results.Problem(
                title: "Business not found",
                detail: $"No business found with slug '{businessSlug}'.",
                statusCode: StatusCodes.Status404NotFound);
        }

        // Find the appropriate queue
        var activeQueues = business.Queues.Where(q => q.IsActive).ToList();

        if (activeQueues.Count == 0)
        {
            return Results.Problem(
                title: "No active queue",
                detail: "This business has no active queue.",
                statusCode: StatusCodes.Status404NotFound);
        }

        Queue? queue;

        if (!string.IsNullOrWhiteSpace(queueSlug))
        {
            // Specific queue requested
            queue = activeQueues.FirstOrDefault(q =>
                q.Slug.Equals(queueSlug, StringComparison.OrdinalIgnoreCase));

            if (queue is null)
            {
                return Results.Problem(
                    title: "Queue not found",
                    detail: $"No active queue found with slug '{queueSlug}'.",
                    statusCode: StatusCodes.Status404NotFound);
            }
        }
        else if (activeQueues.Count == 1)
        {
            // Only one queue, use it
            queue = activeQueues[0];
        }
        else
        {
            // Multiple queues, require selection
            var queueOptions = activeQueues
                .OrderBy(q => q.CreatedAt)
                .Select(q => new QueueOptionDto(
                    q.Name,
                    q.Slug,
                    q.GetWaitingCount(),
                    q.GetWaitingCount() * q.Settings.EstimatedServiceTimeMinutes))
                .ToList();

            return Results.Json(
                new MultipleQueuesResponse(
                    "Multiple queues available. Please select a queue.",
                    queueOptions),
                statusCode: StatusCodes.Status400BadRequest);
        }

        // Add customer to queue (domain logic)
        var now = timeProvider.GetUtcNow();
        var result = queue.AddCustomer(
            request.Name,
            now,
            request.PhoneNumber,
            request.PartySize,
            request.Notes);

        if (result.IsFailure)
        {
            return Results.Problem(
                title: "Could not join queue",
                detail: result.Error.Message,
                statusCode: StatusCodes.Status400BadRequest);
        }

        var customer = result.Value;

        // Explicitly mark the new customer as Added to ensure EF tracks it correctly
        // This is needed because adding to a tracked collection may not always detect new entities
        db.Entry(customer).State = EntityState.Added;

        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            return Results.Problem(
                title: "Concurrency conflict",
                detail: "The queue was modified while joining. Please try again.",
                statusCode: StatusCodes.Status409Conflict);
        }

        // Calculate position
        var position = queue.GetCustomerPosition(customer.Id) ?? 1;

        // Notify staff that a customer joined
        await notifier.NotifyQueueUpdatedAsync(queue.Id, QueueUpdateType.CustomerJoined, cancellationToken);

        return Results.Created(
            $"/api/q/{customer.Token}",
            new Response(customer.Token, position, queue.Name, queue.Slug));
    }
}
