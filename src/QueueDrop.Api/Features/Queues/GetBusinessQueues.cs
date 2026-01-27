using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QueueDrop.Infrastructure.Persistence;

namespace QueueDrop.Api.Features.Queues;

/// <summary>
/// Vertical slice: Get all queues for a business.
/// GET /api/business/{businessSlug}/queues
/// </summary>
public static class GetBusinessQueues
{
    public sealed record QueueDto(
        Guid QueueId,
        string Name,
        string Slug,
        int WaitingCount,
        int EstimatedWaitMinutes);

    public sealed record Response(
        Guid BusinessId,
        string BusinessName,
        IReadOnlyList<QueueDto> Queues);

    public static void MapEndpoint(IEndpointRouteBuilder app)
    {
        app.MapGet("/api/business/{businessSlug}/queues", Handler)
            .WithName("GetBusinessQueues")
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
                .ThenInclude(q => q.Customers)
            .FirstOrDefaultAsync(b => b.Slug == businessSlug.ToLowerInvariant(), cancellationToken);

        if (business is null)
        {
            return Results.Problem(
                title: "Business not found",
                detail: $"No business found with slug '{businessSlug}'.",
                statusCode: StatusCodes.Status404NotFound);
        }

        var activeQueues = business.Queues
            .Where(q => q.IsActive)
            .OrderBy(q => q.CreatedAt)
            .Select(q => new QueueDto(
                q.Id,
                q.Name,
                q.Slug,
                q.GetWaitingCount(),
                q.GetWaitingCount() * q.Settings.EstimatedServiceTimeMinutes))
            .ToList();

        return Results.Ok(new Response(
            business.Id,
            business.Name,
            activeQueues));
    }
}
