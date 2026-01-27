using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QueueDrop.Infrastructure.Persistence;

namespace QueueDrop.Api.Features.Queues;

/// <summary>
/// Vertical slice: Get active queue for a business (staff dashboard entry point).
/// GET /api/business/{businessSlug}/queue
/// </summary>
public static class GetQueueByBusiness
{
    public sealed record Response(
        Guid QueueId,
        string QueueName,
        Guid BusinessId,
        string BusinessName);

    public static void MapEndpoint(IEndpointRouteBuilder app)
    {
        app.MapGet("/api/business/{businessSlug}/queue", Handler)
            .WithName("GetQueueByBusiness")
            .WithTags("Queues")
            .Produces<Response>(StatusCodes.Status200OK)
            .Produces<ProblemDetails>(StatusCodes.Status404NotFound);
    }

    private static async Task<IResult> Handler(
        string businessSlug,
        AppDbContext db,
        CancellationToken cancellationToken)
    {
        var business = await db.Businesses
            .Include(b => b.Queues)
            .FirstOrDefaultAsync(b => b.Slug == businessSlug.ToLowerInvariant(), cancellationToken);

        if (business is null)
        {
            return Results.Problem(
                title: "Business not found",
                detail: $"No business found with slug '{businessSlug}'.",
                statusCode: StatusCodes.Status404NotFound);
        }

        var activeQueue = business.Queues.FirstOrDefault(q => q.IsActive);
        if (activeQueue is null)
        {
            return Results.Problem(
                title: "No active queue",
                detail: "This business has no active queue.",
                statusCode: StatusCodes.Status404NotFound);
        }

        return Results.Ok(new Response(
            activeQueue.Id,
            activeQueue.Name,
            business.Id,
            business.Name));
    }
}
