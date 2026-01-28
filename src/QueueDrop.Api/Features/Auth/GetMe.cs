using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using QueueDrop.Infrastructure.Persistence;

namespace QueueDrop.Api.Features.Auth;

/// <summary>
/// Vertical slice: Get current authenticated user info.
/// GET /api/auth/me
/// </summary>
public static class GetMe
{
    public sealed record BusinessInfo(Guid Id, string Name, string Slug, string Role);
    public sealed record Response(Guid UserId, string Email, BusinessInfo? Business);

    public static void MapEndpoint(IEndpointRouteBuilder app)
    {
        app.MapGet("/api/auth/me", Handler)
            .WithName("GetMe")
            .WithTags("Auth")
            .RequireAuthorization()
            .Produces<Response>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status401Unauthorized);
    }

    private static async Task<IResult> Handler(
        ClaimsPrincipal user,
        AppDbContext db,
        CancellationToken cancellationToken)
    {
        var userIdClaim = user.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userIdClaim is null || !Guid.TryParse(userIdClaim, out var userId))
        {
            return Results.Unauthorized();
        }

        var dbUser = await db.Users
            .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);

        if (dbUser is null)
        {
            return Results.Unauthorized();
        }

        // Get user's business membership (if any)
        var membership = await db.BusinessMembers
            .Include(bm => bm.Business)
            .FirstOrDefaultAsync(bm => bm.UserId == userId && bm.JoinedAt != null, cancellationToken);

        BusinessInfo? businessInfo = null;
        if (membership is not null)
        {
            businessInfo = new BusinessInfo(
                membership.Business.Id,
                membership.Business.Name,
                membership.Business.Slug,
                membership.Role.ToString());
        }

        return Results.Ok(new Response(dbUser.Id, dbUser.Email, businessInfo));
    }
}
