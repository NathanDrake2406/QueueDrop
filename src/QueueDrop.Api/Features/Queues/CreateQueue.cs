using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QueueDrop.Api.Auth;
using QueueDrop.Domain.Entities;
using QueueDrop.Infrastructure.Persistence;

namespace QueueDrop.Api.Features.Queues;

/// <summary>
/// Vertical slice: Create a new queue for a business.
/// POST /api/business/{businessSlug}/queues
/// Only business owners can create queues.
/// </summary>
public static class CreateQueue
{
    public sealed record Request(
        string Name,
        string? Slug,
        int? MaxQueueSize = null,
        int? EstimatedServiceTimeMinutes = null,
        string? WelcomeMessage = null);

    public sealed record Response(Guid Id, string Name, string Slug);

    public static void MapEndpoint(IEndpointRouteBuilder app)
    {
        app.MapPost("/api/business/{businessSlug}/queues", Handler)
            .WithName("CreateQueue")
            .WithTags("Queues")
            .RequireAuthorization()
            .Produces<Response>(StatusCodes.Status201Created)
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
        CancellationToken cancellationToken)
    {
        var userIdClaim = user.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
            return Results.Unauthorized();

        // Load business first to check if it exists
        var business = await db.Businesses
            .Include(b => b.Queues)
            .FirstOrDefaultAsync(b => b.Slug == businessSlug.ToLowerInvariant(), cancellationToken);

        if (business is null)
            return Results.NotFound();

        // Check owner permission
        if (!await authService.IsOwnerAsync(userId, businessSlug, cancellationToken))
        {
            return Results.Problem(
                title: "Forbidden",
                detail: "Only business owners can create queues.",
                statusCode: StatusCodes.Status403Forbidden);
        }

        // Validate required fields
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return Results.Problem(
                title: "Invalid name",
                detail: "Queue name is required.",
                statusCode: StatusCodes.Status400BadRequest);
        }

        // Generate slug from name if not provided
        var slug = string.IsNullOrWhiteSpace(request.Slug)
            ? GenerateSlug(request.Name)
            : GenerateSlug(request.Slug);

        // Check for duplicate slug within business
        if (business.Queues.Any(q => q.Slug == slug))
        {
            return Results.Problem(
                title: "Slug already exists",
                detail: $"A queue with slug '{slug}' already exists in this business.",
                statusCode: StatusCodes.Status409Conflict);
        }

        var now = timeProvider.GetUtcNow();
        var queue = Queue.Create(business.Id, request.Name, slug, now);

        // Apply optional settings if provided
        if (request.MaxQueueSize.HasValue || request.EstimatedServiceTimeMinutes.HasValue || !string.IsNullOrWhiteSpace(request.WelcomeMessage))
        {
            var settings = new QueueSettings
            {
                MaxQueueSize = request.MaxQueueSize,
                EstimatedServiceTimeMinutes = request.EstimatedServiceTimeMinutes ?? QueueSettings.Default.EstimatedServiceTimeMinutes,
                NoShowTimeoutMinutes = QueueSettings.Default.NoShowTimeoutMinutes,
                AllowJoinWhenPaused = QueueSettings.Default.AllowJoinWhenPaused,
                WelcomeMessage = request.WelcomeMessage?.Trim(),
                CalledMessage = QueueSettings.Default.CalledMessage
            };
            queue.UpdateSettings(settings);
        }

        db.Queues.Add(queue);
        await db.SaveChangesAsync(cancellationToken);

        return Results.Created(
            $"/api/business/{businessSlug}/queues/{queue.Slug}",
            new Response(queue.Id, queue.Name, queue.Slug));
    }

    private static string GenerateSlug(string input) => input
        .ToLowerInvariant()
        .Trim()
        .Replace(" ", "-")
        .Replace("'", "")
        .Replace("\"", "");
}
