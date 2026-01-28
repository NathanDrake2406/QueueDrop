using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QueueDrop.Infrastructure.Persistence;

namespace QueueDrop.Api.Features.Customers;

/// <summary>
/// Vertical slice: Customer saves their push subscription for notifications.
/// POST /api/q/{token}/push-subscription
/// </summary>
public static class SavePushSubscription
{
    public sealed record Request(
        string Endpoint,
        string P256dh,
        string Auth);

    public static void MapEndpoint(IEndpointRouteBuilder app)
    {
        app.MapPost("/api/q/{token}/push-subscription", Handler)
            .WithName("SavePushSubscription")
            .WithTags("Customers")
            .Produces(StatusCodes.Status204NoContent)
            .Produces<ProblemDetails>(StatusCodes.Status404NotFound)
            .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
            .Produces<ProblemDetails>(StatusCodes.Status409Conflict);
    }

    private static async Task<IResult> Handler(
        string token,
        Request request,
        AppDbContext db,
        CancellationToken cancellationToken)
    {
        // Validate request
        if (string.IsNullOrWhiteSpace(request.Endpoint) ||
            string.IsNullOrWhiteSpace(request.P256dh) ||
            string.IsNullOrWhiteSpace(request.Auth))
        {
            return Results.Problem(
                title: "Invalid subscription",
                detail: "Endpoint, p256dh, and auth are all required.",
                statusCode: StatusCodes.Status400BadRequest);
        }

        // Find queue containing customer by token
        var queue = await db.Queues
            .Include(q => q.Customers)
            .FirstOrDefaultAsync(q => q.Customers.Any(c => c.Token == token), cancellationToken);

        if (queue is null)
        {
            return Results.Problem(
                title: "Customer not found",
                detail: $"No customer found with token '{token}'.",
                statusCode: StatusCodes.Status404NotFound);
        }

        var customer = queue.GetCustomerByToken(token);
        if (customer is null)
        {
            return Results.Problem(
                title: "Customer not found",
                detail: $"No customer found with token '{token}'.",
                statusCode: StatusCodes.Status404NotFound);
        }

        // Serialize subscription to JSON for storage
        var subscriptionJson = JsonSerializer.Serialize(new
        {
            endpoint = request.Endpoint,
            keys = new
            {
                p256dh = request.P256dh,
                auth = request.Auth
            }
        });

        // Save subscription through aggregate
        var result = queue.SetCustomerPushSubscription(customer.Id, subscriptionJson);
        if (!result.IsSuccess)
        {
            return Results.Problem(
                title: "Failed to save subscription",
                detail: result.Error.Message,
                statusCode: StatusCodes.Status400BadRequest);
        }

        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            return Results.Problem(
                title: "Concurrency conflict",
                detail: "Please try again.",
                statusCode: StatusCodes.Status409Conflict);
        }

        return Results.NoContent();
    }
}
