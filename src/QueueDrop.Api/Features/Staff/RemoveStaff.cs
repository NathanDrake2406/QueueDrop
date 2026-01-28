using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QueueDrop.Api.Auth;
using QueueDrop.Domain.Enums;
using QueueDrop.Infrastructure.Persistence;

namespace QueueDrop.Api.Features.Staff;

/// <summary>
/// Vertical slice: Remove a staff member from a business.
/// DELETE /api/business/{businessSlug}/staff/{userId}
/// Only business owners can remove staff. Owners cannot be removed.
/// </summary>
public static class RemoveStaff
{
    public static void MapEndpoint(IEndpointRouteBuilder app)
    {
        app.MapDelete("/api/business/{businessSlug}/staff/{userId:guid}", Handler)
            .WithName("RemoveStaff")
            .WithTags("Staff")
            .RequireAuthorization()
            .Produces(StatusCodes.Status204NoContent)
            .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
            .Produces<ProblemDetails>(StatusCodes.Status403Forbidden)
            .Produces<ProblemDetails>(StatusCodes.Status404NotFound);
    }

    private static async Task<IResult> Handler(
        string businessSlug,
        Guid userId,
        ClaimsPrincipal user,
        AppDbContext db,
        IBusinessAuthorizationService authService,
        CancellationToken cancellationToken)
    {
        var currentUserIdClaim = user.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(currentUserIdClaim, out var currentUserId))
            return Results.Unauthorized();

        if (!await authService.IsOwnerAsync(currentUserId, businessSlug, cancellationToken))
        {
            return Results.Problem(
                title: "Forbidden",
                detail: "Only business owners can remove staff.",
                statusCode: StatusCodes.Status403Forbidden);
        }

        var membership = await db.BusinessMembers
            .Include(bm => bm.Business)
            .FirstOrDefaultAsync(bm =>
                bm.UserId == userId &&
                bm.Business.Slug == businessSlug.ToLowerInvariant(),
                cancellationToken);

        if (membership is null)
            return Results.NotFound();

        // Cannot remove owners
        if (membership.Role == BusinessRole.Owner)
        {
            return Results.Problem(
                title: "Cannot remove owner",
                detail: "Business owners cannot be removed from their own business.",
                statusCode: StatusCodes.Status400BadRequest);
        }

        db.BusinessMembers.Remove(membership);
        await db.SaveChangesAsync(cancellationToken);

        return Results.NoContent();
    }
}
