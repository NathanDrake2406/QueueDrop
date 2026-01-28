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
    public sealed record BusinessDto(Guid Id, string Name, string Slug);
    public sealed record Response(Guid UserId, string Email, List<BusinessDto> Businesses);

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

        // Get all businesses where user is a member (JoinedAt is not null)
        var businesses = await db.BusinessMembers
            .Include(bm => bm.Business)
            .Where(bm => bm.UserId == userId && bm.JoinedAt != null)
            .Select(bm => new BusinessDto(bm.Business.Id, bm.Business.Name, bm.Business.Slug))
            .ToListAsync(cancellationToken);

        return Results.Ok(new Response(dbUser.Id, dbUser.Email, businesses));
    }
}
