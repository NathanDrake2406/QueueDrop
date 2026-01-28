using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QueueDrop.Api.Auth;
using QueueDrop.Domain.Entities;
using QueueDrop.Infrastructure.Persistence;

namespace QueueDrop.Api.Features.Queues;

/// <summary>
/// Vertical slice: Update an existing queue for a business.
/// PUT /api/business/{businessSlug}/queues/{queueSlug}
/// Only business owners can update queues.
/// </summary>
public static class UpdateQueue
{
    public sealed record Request(
        string? Name,
        int? MaxQueueSize,
        int? EstimatedServiceTimeMinutes,
        string? WelcomeMessage,
        string? CalledMessage);

    public sealed record Response(Guid Id, string Name, string Slug);

    public static void MapEndpoint(IEndpointRouteBuilder app)
    {
        app.MapPut("/api/business/{businessSlug}/queues/{queueSlug}", Handler)
            .WithName("UpdateQueue")
            .WithTags("Queues")
            .RequireAuthorization()
            .Produces<Response>(StatusCodes.Status200OK)
            .Produces<ProblemDetails>(StatusCodes.Status403Forbidden)
            .Produces<ProblemDetails>(StatusCodes.Status404NotFound);
    }

    private static async Task<IResult> Handler(
        string businessSlug,
        string queueSlug,
        Request request,
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
                detail: "Only business owners can update queues.",
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

        // Update name if provided
        if (!string.IsNullOrWhiteSpace(request.Name))
            queue.Rename(request.Name);

        // Update settings using immutable record with-expression
        var currentSettings = queue.Settings;
        var updatedSettings = currentSettings with
        {
            MaxQueueSize = request.MaxQueueSize ?? currentSettings.MaxQueueSize,
            EstimatedServiceTimeMinutes = request.EstimatedServiceTimeMinutes ?? currentSettings.EstimatedServiceTimeMinutes,
            WelcomeMessage = request.WelcomeMessage ?? currentSettings.WelcomeMessage,
            CalledMessage = request.CalledMessage ?? currentSettings.CalledMessage
        };

        // Only update settings if something changed
        if (updatedSettings != currentSettings)
            queue.UpdateSettings(updatedSettings);

        await db.SaveChangesAsync(cancellationToken);

        return Results.Ok(new Response(queue.Id, queue.Name, queue.Slug));
    }
}
