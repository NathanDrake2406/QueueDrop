using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QueueDrop.Domain.Abstractions;
using QueueDrop.Domain.Common;
using QueueDrop.Domain.Enums;
using QueueDrop.Infrastructure.Persistence;

namespace QueueDrop.Api.Features.Customers;

/// <summary>
/// Vertical slice: Customer joins a queue.
/// POST /api/join/{businessSlug}
/// </summary>
public static class JoinQueue
{
    public sealed record Request(string Name, string? PhoneNumber = null, int? PartySize = null, string? Notes = null);

    public sealed record Response(string Token, int Position, string QueueName);

    public static void MapEndpoint(IEndpointRouteBuilder app)
    {
        app.MapPost("/api/join/{businessSlug}", Handler)
            .WithName("JoinQueue")
            .WithTags("Customers")
            .Produces<Response>(StatusCodes.Status201Created)
            .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
            .Produces<ProblemDetails>(StatusCodes.Status404NotFound);
    }

    private static async Task<IResult> Handler(
        string businessSlug,
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

        // Get active queue for business
        var queue = business.Queues.FirstOrDefault(q => q.IsActive);
        if (queue is null)
        {
            return Results.Problem(
                title: "No active queue",
                detail: "This business has no active queue.",
                statusCode: StatusCodes.Status404NotFound);
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
        db.Entry(customer).State = Microsoft.EntityFrameworkCore.EntityState.Added;

        await db.SaveChangesAsync(cancellationToken);

        // Calculate position
        var position = queue.GetCustomerPosition(customer.Id) ?? 1;

        // Notify staff that a customer joined
        await notifier.NotifyQueueUpdatedAsync(queue.Id, QueueUpdateType.CustomerJoined, cancellationToken);

        return Results.Created(
            $"/api/q/{customer.Token}",
            new Response(customer.Token, position, queue.Name));
    }
}
