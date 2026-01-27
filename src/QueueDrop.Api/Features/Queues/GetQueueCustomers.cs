using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QueueDrop.Domain.Enums;
using QueueDrop.Infrastructure.Persistence;

namespace QueueDrop.Api.Features.Queues;

/// <summary>
/// Vertical slice: Get all customers for a queue (staff dashboard).
/// GET /api/queues/{queueId}/customers
/// </summary>
public static class GetQueueCustomers
{
    public sealed record CustomerDto(
        Guid Id,
        string Name,
        string Token,
        string Status,
        int? Position,
        DateTimeOffset JoinedAt,
        DateTimeOffset? CalledAt,
        int? PartySize,
        string? Notes);

    public sealed record QueueInfoDto(
        string Name,
        bool IsActive,
        bool IsPaused,
        int WaitingCount,
        int CalledCount);

    public sealed record Response(
        IReadOnlyList<CustomerDto> Customers,
        QueueInfoDto QueueInfo);

    public static void MapEndpoint(IEndpointRouteBuilder app)
    {
        app.MapGet("/api/queues/{queueId:guid}/customers", Handler)
            .WithName("GetQueueCustomers")
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
            .Include(q => q.Customers)
            .FirstOrDefaultAsync(q => q.Id == queueId, cancellationToken);

        if (queue is null)
        {
            return Results.Problem(
                title: "Queue not found",
                detail: $"No queue found with ID '{queueId}'.",
                statusCode: StatusCodes.Status404NotFound);
        }

        // Get waiting customers ordered by position
        var waitingCustomers = queue.Customers
            .Where(c => c.Status == CustomerStatus.Waiting)
            .OrderBy(c => c.JoinedAt)
            .ThenBy(c => c.JoinPosition)
            .ToList();

        // Get called customers
        var calledCustomers = queue.Customers
            .Where(c => c.Status == CustomerStatus.Called)
            .OrderBy(c => c.CalledAt)
            .ToList();

        // Build customer DTOs with calculated positions
        var customerDtos = new List<CustomerDto>();

        // Add called customers first (position = null for called)
        foreach (var customer in calledCustomers)
        {
            customerDtos.Add(new CustomerDto(
                customer.Id,
                customer.Name,
                customer.Token,
                customer.Status.ToString(),
                Position: null,
                customer.JoinedAt,
                customer.CalledAt,
                customer.PartySize,
                customer.Notes));
        }

        // Add waiting customers with their positions
        for (var i = 0; i < waitingCustomers.Count; i++)
        {
            var customer = waitingCustomers[i];
            customerDtos.Add(new CustomerDto(
                customer.Id,
                customer.Name,
                customer.Token,
                customer.Status.ToString(),
                Position: i + 1,
                customer.JoinedAt,
                customer.CalledAt,
                customer.PartySize,
                customer.Notes));
        }

        var queueInfo = new QueueInfoDto(
            queue.Name,
            queue.IsActive,
            queue.IsPaused,
            waitingCustomers.Count,
            calledCustomers.Count);

        return Results.Ok(new Response(customerDtos, queueInfo));
    }
}
