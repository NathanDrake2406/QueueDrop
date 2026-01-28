using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QueueDrop.Domain.Abstractions;
using QueueDrop.Domain.Entities;
using QueueDrop.Infrastructure.Persistence;

namespace QueueDrop.Api.Features.Queues;

/// <summary>
/// Vertical slice: Update queue settings.
/// PUT /api/queues/{queueId}/settings
/// </summary>
public static class UpdateSettings
{
    public sealed record Request(
        int? MaxQueueSize,
        int EstimatedServiceTimeMinutes,
        int NoShowTimeoutMinutes,
        bool AllowJoinWhenPaused,
        string? WelcomeMessage,
        string? CalledMessage,
        int? NearFrontThreshold);

    public static void MapEndpoint(IEndpointRouteBuilder app)
    {
        app.MapPut("/api/queues/{queueId:guid}/settings", Handler)
            .WithName("UpdateQueueSettings")
            .WithTags("Queues")
            .Produces(StatusCodes.Status204NoContent)
            .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
            .Produces<ProblemDetails>(StatusCodes.Status404NotFound)
            .Produces<ProblemDetails>(StatusCodes.Status409Conflict);
    }

    private static async Task<IResult> Handler(
        Guid queueId,
        Request request,
        AppDbContext db,
        IQueueHubNotifier notifier,
        CancellationToken cancellationToken)
    {
        // Validation
        if (request.MaxQueueSize is < 1)
        {
            return Results.Problem(
                title: "Invalid max queue size",
                detail: "Max queue size must be at least 1 if specified.",
                statusCode: StatusCodes.Status400BadRequest);
        }

        if (request.EstimatedServiceTimeMinutes < 1)
        {
            return Results.Problem(
                title: "Invalid service time",
                detail: "Estimated service time must be at least 1 minute.",
                statusCode: StatusCodes.Status400BadRequest);
        }

        if (request.NoShowTimeoutMinutes < 1)
        {
            return Results.Problem(
                title: "Invalid no-show timeout",
                detail: "No-show timeout must be at least 1 minute.",
                statusCode: StatusCodes.Status400BadRequest);
        }

        var queue = await db.Queues
            .FirstOrDefaultAsync(q => q.Id == queueId, cancellationToken);

        if (queue is null)
        {
            return Results.Problem(
                title: "Queue not found",
                detail: $"No queue found with ID '{queueId}'.",
                statusCode: StatusCodes.Status404NotFound);
        }

        var newSettings = new QueueSettings
        {
            MaxQueueSize = request.MaxQueueSize,
            EstimatedServiceTimeMinutes = request.EstimatedServiceTimeMinutes,
            NoShowTimeoutMinutes = request.NoShowTimeoutMinutes,
            AllowJoinWhenPaused = request.AllowJoinWhenPaused,
            WelcomeMessage = request.WelcomeMessage?.Trim(),
            CalledMessage = request.CalledMessage?.Trim(),
            NearFrontThreshold = request.NearFrontThreshold
        };

        queue.UpdateSettings(newSettings);

        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            return Results.Problem(
                title: "Concurrent modification",
                detail: "The queue was modified by another request. Please retry.",
                statusCode: StatusCodes.Status409Conflict);
        }

        // Notify staff that settings changed
        await notifier.NotifyQueueUpdatedAsync(queueId, QueueUpdateType.QueueSettingsChanged, cancellationToken);

        return Results.NoContent();
    }
}
