using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QueueDrop.Infrastructure.Persistence;

namespace QueueDrop.Api.Features.Queues;

/// <summary>
/// Vertical slice: Get queue settings.
/// GET /api/queues/{queueId}/settings
/// </summary>
public static class GetSettings
{
    public sealed record Response(
        int? MaxQueueSize,
        int EstimatedServiceTimeMinutes,
        int NoShowTimeoutMinutes,
        bool AllowJoinWhenPaused,
        string? WelcomeMessage,
        string? CalledMessage);

    public static void MapEndpoint(IEndpointRouteBuilder app)
    {
        app.MapGet("/api/queues/{queueId:guid}/settings", Handler)
            .WithName("GetQueueSettings")
            .WithTags("Queues")
            .Produces<Response>(StatusCodes.Status200OK)
            .Produces<ProblemDetails>(StatusCodes.Status404NotFound);
    }

    private static async Task<IResult> Handler(
        Guid queueId,
        AppDbContext db,
        CancellationToken cancellationToken)
    {
        var queue = await db.Queues
            .AsNoTracking()
            .FirstOrDefaultAsync(q => q.Id == queueId, cancellationToken);

        if (queue is null)
        {
            return Results.Problem(
                title: "Queue not found",
                detail: $"No queue found with ID '{queueId}'.",
                statusCode: StatusCodes.Status404NotFound);
        }

        var settings = queue.Settings;
        return Results.Ok(new Response(
            settings.MaxQueueSize,
            settings.EstimatedServiceTimeMinutes,
            settings.NoShowTimeoutMinutes,
            settings.AllowJoinWhenPaused,
            settings.WelcomeMessage,
            settings.CalledMessage));
    }
}
