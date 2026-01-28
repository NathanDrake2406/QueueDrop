using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QueueDrop.Api.Auth;
using QueueDrop.Infrastructure.Persistence;

namespace QueueDrop.Api.Features.Queues;

/// <summary>
/// Vertical slice: Delete an existing queue from a business.
/// DELETE /api/business/{businessSlug}/queues/{queueSlug}
/// Only business owners can delete queues.
/// </summary>
public static class DeleteQueue
{
    public static void MapEndpoint(IEndpointRouteBuilder app)
    {
        app.MapDelete("/api/business/{businessSlug}/queues/{queueSlug}", Handler)
            .WithName("DeleteQueue")
            .WithTags("Queues")
            .RequireAuthorization()
            .Produces(StatusCodes.Status204NoContent)
            .Produces<ProblemDetails>(StatusCodes.Status403Forbidden)
            .Produces<ProblemDetails>(StatusCodes.Status404NotFound);
    }

    private static async Task<IResult> Handler(
        string businessSlug,
        string queueSlug,
        ClaimsPrincipal user,
        AppDbContext db,
        IBusinessAuthorizationService authService,
        CancellationToken cancellationToken)
    {
        var userIdClaim = user.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
            return Results.Unauthorized();

        if (!await authService.IsOwnerAsync(userId, businessSlug, cancellationToken))
        {
            return Results.Problem(
                title: "Forbidden",
                detail: "Only business owners can delete queues.",
                statusCode: StatusCodes.Status403Forbidden);
        }

        var queue = await db.Queues
            .Include(q => q.Business)
            .FirstOrDefaultAsync(q =>
                q.Business != null &&
                q.Business.Slug == businessSlug.ToLowerInvariant() &&
                q.Slug == queueSlug.ToLowerInvariant(),
                cancellationToken);

        if (queue is null)
            return Results.NotFound();

        db.Queues.Remove(queue);
        await db.SaveChangesAsync(cancellationToken);

        return Results.NoContent();
    }
}
