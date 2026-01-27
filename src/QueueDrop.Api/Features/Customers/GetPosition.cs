using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QueueDrop.Domain.Enums;
using QueueDrop.Infrastructure.Persistence;

namespace QueueDrop.Api.Features.Customers;

/// <summary>
/// Vertical slice: Customer checks their queue position.
/// GET /api/q/{token}
/// </summary>
public static class GetPosition
{
    public sealed record Response(
        int? Position,
        string Status,
        string QueueName,
        string BusinessName,
        int? EstimatedWaitMinutes,
        int RecentActivity,
        string? WelcomeMessage,
        string? CalledMessage);

    public static void MapEndpoint(IEndpointRouteBuilder app)
    {
        app.MapGet("/api/q/{token}", Handler)
            .WithName("GetPosition")
            .WithTags("Customers")
            .Produces<Response>()
            .Produces<ProblemDetails>(StatusCodes.Status404NotFound);
    }

    private static async Task<IResult> Handler(
        string token,
        AppDbContext db,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        // Find customer by token
        var customer = await db.QueueCustomers
            .FirstOrDefaultAsync(c => c.Token == token, cancellationToken);

        if (customer is null)
        {
            return Results.Problem(
                title: "Customer not found",
                detail: $"No customer found with token '{token}'.",
                statusCode: StatusCodes.Status404NotFound);
        }

        // Get queue with settings and customers for position calculation
        var queue = await db.Queues
            .Include(q => q.Settings)
            .Include(q => q.Business)
            .Include(q => q.Customers)
            .FirstOrDefaultAsync(q => q.Id == customer.QueueId, cancellationToken);

        if (queue is null)
        {
            return Results.Problem(
                title: "Queue not found",
                detail: "The queue for this customer no longer exists.",
                statusCode: StatusCodes.Status404NotFound);
        }

        // Calculate position (null if not waiting)
        int? position = customer.Status == CustomerStatus.Waiting
            ? queue.GetCustomerPosition(customer.Id)
            : null;

        // Calculate estimated wait (position * estimated service time)
        int? estimatedWaitMinutes = position.HasValue
            ? (position.Value - 1) * queue.Settings.EstimatedServiceTimeMinutes
            : null;

        // Get recent activity (customers served in last 30 minutes)
        var thirtyMinutesAgo = timeProvider.GetUtcNow().AddMinutes(-30);
        var recentActivity = queue.GetServedCount(thirtyMinutesAgo);

        // Determine which message to show
        var calledMessage = customer.Status == CustomerStatus.Called
            ? queue.Settings.CalledMessage ?? "You've been called! Please proceed."
            : null;

        return Results.Ok(new Response(
            Position: position,
            Status: customer.Status.ToString(),
            QueueName: queue.Name,
            BusinessName: queue.Business?.Name ?? "Unknown",
            EstimatedWaitMinutes: estimatedWaitMinutes,
            RecentActivity: recentActivity,
            WelcomeMessage: queue.Settings.WelcomeMessage,
            CalledMessage: calledMessage));
    }
}
