using System.Security.Claims;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QueueDrop.Api.Auth;
using QueueDrop.Domain.Entities;
using QueueDrop.Domain.Enums;
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
    public sealed record Response(string Message);

    public static void MapEndpoint(IEndpointRouteBuilder app)
    {
        app.MapPost("/api/business/{businessSlug}/staff/invite", Handler)
            .WithName("InviteStaff")
            .WithTags("Staff")
            .RequireAuthorization()
            .Produces<Response>(StatusCodes.Status201Created)
            .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
            .Produces<ProblemDetails>(StatusCodes.Status403Forbidden)
            .Produces<ProblemDetails>(StatusCodes.Status404NotFound)
            .Produces<ProblemDetails>(StatusCodes.Status409Conflict);
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

        var normalizedEmail = request.Email.ToLowerInvariant();

        // Check if email already belongs to a member
        var existingMember = await db.BusinessMembers
            .Include(bm => bm.User)
            .Include(bm => bm.Business)
            .FirstOrDefaultAsync(bm =>
                bm.User.Email == normalizedEmail &&
                bm.Business.Slug == businessSlug.ToLowerInvariant() &&
                bm.JoinedAt != null, cancellationToken);

        if (existingMember is not null)
        {
            return Results.Problem(
                title: "Already a member",
                detail: "This email is already a member of this business.",
                statusCode: StatusCodes.Status409Conflict);
        }

        var now = timeProvider.GetUtcNow();

        // Check for existing pending invite
        var existingInvite = await db.MagicLinks
            .FirstOrDefaultAsync(ml =>
                ml.Email == normalizedEmail &&
                ml.BusinessId == business.Id &&
                ml.Type == MagicLinkType.Invite &&
                !ml.UsedAt.HasValue &&
                ml.ExpiresAt > now, cancellationToken);

        if (existingInvite is not null)
        {
            return Results.Problem(
                title: "Invite already pending",
                detail: "An invite has already been sent to this email.",
                statusCode: StatusCodes.Status409Conflict);
        }

        var magicLink = MagicLink.CreateInviteLink(
            request.Email,
            business.Id,
            now,
            TimeSpan.FromDays(7)); // Invite links last 7 days

        db.MagicLinks.Add(magicLink);
        await db.SaveChangesAsync(cancellationToken);

        // TODO: Send email - for now, log to console
        var inviteUrl = $"/auth/verify?token={magicLink.Token}";
        logger.LogInformation("Staff invite created for {Email} to join {Business}",
            normalizedEmail, business.Name);

        return Results.Created(inviteUrl, new Response("Invite sent"));
    }

    [GeneratedRegex(@"^[^@\s]+@[^@\s]+\.[^@\s]+$", RegexOptions.Compiled)]
    private static partial Regex EmailRegex();
}
