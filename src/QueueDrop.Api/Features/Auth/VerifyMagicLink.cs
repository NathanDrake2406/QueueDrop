using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QueueDrop.Api.Auth;
using QueueDrop.Domain.Entities;
using QueueDrop.Infrastructure.Persistence;

namespace QueueDrop.Api.Features.Auth;

/// <summary>
/// Vertical slice: Verify a magic link and return JWT.
/// GET /api/auth/verify?token=xxx
/// </summary>
public static class VerifyMagicLink
{
    public sealed record Response(string Token, Guid UserId, string Email, bool IsNewUser);

    public static void MapEndpoint(IEndpointRouteBuilder app)
    {
        app.MapGet("/api/auth/verify", Handler)
            .WithName("VerifyMagicLink")
            .WithTags("Auth")
            .Produces<Response>(StatusCodes.Status200OK)
            .Produces<ProblemDetails>(StatusCodes.Status400BadRequest);
    }

    private static async Task<IResult> Handler(
        [FromQuery] string token,
        AppDbContext db,
        IJwtTokenService jwtService,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        var magicLink = await db.MagicLinks
            .FirstOrDefaultAsync(ml => ml.Token == token, cancellationToken);

        if (magicLink is null)
        {
            return Results.Problem(
                title: "Invalid token",
                detail: "This link is invalid or has expired.",
                statusCode: StatusCodes.Status400BadRequest);
        }

        var now = timeProvider.GetUtcNow();

        if (magicLink.UsedAt.HasValue)
        {
            return Results.Problem(
                title: "Link already used",
                detail: "This link has already been used. Please request a new one.",
                statusCode: StatusCodes.Status400BadRequest);
        }

        if (magicLink.IsExpired(now))
        {
            return Results.Problem(
                title: "Link expired",
                detail: "This link has expired. Please request a new one.",
                statusCode: StatusCodes.Status400BadRequest);
        }

        // Mark as used
        magicLink.MarkUsed(now);

        // Find or create user
        var user = await db.Users
            .FirstOrDefaultAsync(u => u.Email == magicLink.Email, cancellationToken);

        var isNewUser = user is null;

        if (isNewUser)
        {
            user = User.Create(magicLink.Email, now);
            db.Users.Add(user);
        }

        await db.SaveChangesAsync(cancellationToken);

        // Generate JWT
        var jwt = jwtService.GenerateToken(user!.Id, user.Email);

        return Results.Ok(new Response(jwt, user.Id, user.Email, isNewUser));
    }
}
