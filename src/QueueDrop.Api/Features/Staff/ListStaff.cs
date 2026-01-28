using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using QueueDrop.Api.Auth;
using QueueDrop.Infrastructure.Persistence;

namespace QueueDrop.Api.Features.Staff;

/// <summary>
/// Vertical slice: List staff members of a business.
/// GET /api/business/{businessSlug}/staff
/// Only business owners can view staff list.
/// </summary>
public static class ListStaff
{
    public sealed record StaffMember(Guid UserId, string Email, string Role, DateTimeOffset JoinedAt);
    public sealed record Response(List<StaffMember> Staff);

    public static void MapEndpoint(IEndpointRouteBuilder app)
    {
        app.MapGet("/api/business/{businessSlug}/staff", Handler)
            .WithName("ListStaff")
            .WithTags("Staff")
            .RequireAuthorization()
            .Produces<Response>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status403Forbidden)
            .Produces(StatusCodes.Status404NotFound);
    }

    private static async Task<IResult> Handler(
        string businessSlug,
        ClaimsPrincipal user,
        AppDbContext db,
        IBusinessAuthorizationService authService,
        CancellationToken cancellationToken)
    {
        var userIdClaim = user.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
            return Results.Unauthorized();

        // Check business exists
        var business = await db.Businesses
            .FirstOrDefaultAsync(b => b.Slug == businessSlug.ToLowerInvariant(), cancellationToken);

        if (business is null)
            return Results.NotFound();

        // Check owner permission
        if (!await authService.IsOwnerAsync(userId, businessSlug, cancellationToken))
        {
            return Results.Problem(
                title: "Forbidden",
                detail: "Only business owners can view staff list.",
                statusCode: StatusCodes.Status403Forbidden);
        }

        var staff = await db.BusinessMembers
            .Include(bm => bm.User)
            .Include(bm => bm.Business)
            .Where(bm => bm.Business.Slug == businessSlug.ToLowerInvariant() && bm.JoinedAt != null)
            .Select(bm => new StaffMember(
                bm.UserId,
                bm.User.Email,
                bm.Role.ToString(),
                bm.JoinedAt!.Value))
            .ToListAsync(cancellationToken);

        return Results.Ok(new Response(staff));
    }
}
