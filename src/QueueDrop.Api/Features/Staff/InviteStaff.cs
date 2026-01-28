using System.Security.Claims;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QueueDrop.Api.Auth;
using QueueDrop.Domain.Entities;
using QueueDrop.Infrastructure.Persistence;

namespace QueueDrop.Api.Features.Staff;

/// <summary>
/// Vertical slice: Invite a staff member to a business.
/// POST /api/business/{businessSlug}/staff/invite
/// Only business owners can invite staff.
/// </summary>
public static partial class InviteStaff
{
    public sealed record Request(string Email);

    public static void MapEndpoint(IEndpointRouteBuilder app)
    {
        app.MapPost("/api/business/{businessSlug}/staff/invite", Handler)
            .WithName("InviteStaff")
            .WithTags("Staff")
            .RequireAuthorization()
            .Produces(StatusCodes.Status201Created)
            .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
            .Produces<ProblemDetails>(StatusCodes.Status403Forbidden)
            .Produces<ProblemDetails>(StatusCodes.Status404NotFound);
    }

    private static async Task<IResult> Handler(
        string businessSlug,
        Request request,
        ClaimsPrincipal user,
        AppDbContext db,
        IBusinessAuthorizationService authService,
        TimeProvider timeProvider,
        ILogger<Program> logger,
        CancellationToken cancellationToken)
    {
        var userIdClaim = user.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
            return Results.Unauthorized();

        // Load business first to check if it exists
        var business = await db.Businesses
            .FirstOrDefaultAsync(b => b.Slug == businessSlug.ToLowerInvariant(), cancellationToken);

        if (business is null)
            return Results.NotFound();

        // Check owner permission
        if (!await authService.IsOwnerAsync(userId, businessSlug, cancellationToken))
        {
            return Results.Problem(
                title: "Forbidden",
                detail: "Only business owners can invite staff.",
                statusCode: StatusCodes.Status403Forbidden);
        }

        // Validate email
        if (string.IsNullOrWhiteSpace(request.Email) || !EmailRegex().IsMatch(request.Email))
        {
            return Results.Problem(
                title: "Invalid email",
                detail: "Please provide a valid email address.",
                statusCode: StatusCodes.Status400BadRequest);
        }

        var now = timeProvider.GetUtcNow();
        var magicLink = MagicLink.CreateInviteLink(
            request.Email,
            business.Id,
            now,
            TimeSpan.FromDays(7)); // Invite links last 7 days

        db.MagicLinks.Add(magicLink);
        await db.SaveChangesAsync(cancellationToken);

        // TODO: Send email - for now, log to console
        var inviteUrl = $"/auth/verify?token={magicLink.Token}";
        logger.LogInformation("Staff invite created for {Email} to join {Business}: {Url}",
            request.Email, business.Name, inviteUrl);

        return Results.Created(inviteUrl, new { message = "Invite sent" });
    }

    [GeneratedRegex(@"^[^@\s]+@[^@\s]+\.[^@\s]+$", RegexOptions.Compiled)]
    private static partial Regex EmailRegex();
}
