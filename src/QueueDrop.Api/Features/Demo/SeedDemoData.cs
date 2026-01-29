using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QueueDrop.Domain.Entities;
using QueueDrop.Infrastructure.Persistence;

namespace QueueDrop.Api.Features.Demo;

/// <summary>
/// Vertical slice: Seeds demo data for showcasing the app.
/// POST /api/demo/seed - Add random demo customers
/// POST /api/demo/reset - Clear all customers from queue
/// </summary>
public static class SeedDemoData
{
    public sealed record SeedResponse(int CustomersAdded, string Message);
    public sealed record ResetResponse(int CustomersRemoved, string Message);

    private static readonly string[] FirstNames =
    [
        "Alice", "Bob", "Carlos", "Diana", "Ethan", "Fiona", "George", "Hannah",
        "Ivan", "Julia", "Kevin", "Lisa", "Marcus", "Nina", "Oscar", "Priya",
        "Quinn", "Rosa", "Sam", "Tara", "Uma", "Victor", "Wendy", "Xavier", "Yuki", "Zara"
    ];

    private static readonly string[] LastNames =
    [
        "Chen", "Smith", "Garcia", "Williams", "Wong", "Lee", "Kim", "Park",
        "Petrov", "Santos", "O'Brien", "Wang", "Johnson", "Brown", "Davis", "Miller",
        "Wilson", "Moore", "Taylor", "Anderson", "Thomas", "Jackson", "White", "Harris"
    ];

    public static void MapEndpoint(IEndpointRouteBuilder app)
    {
        app.MapPost("/api/demo/seed", SeedHandler)
            .WithName("SeedDemoData")
            .WithTags("Demo")
            .Produces<SeedResponse>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status404NotFound)
            .Produces<ProblemDetails>(StatusCodes.Status409Conflict);

        app.MapPost("/api/demo/reset", ResetHandler)
            .WithName("ResetDemoData")
            .WithTags("Demo")
            .Produces<ResetResponse>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status404NotFound)
            .Produces<ProblemDetails>(StatusCodes.Status409Conflict);
    }

    private static async Task<IResult> SeedHandler(
        AppDbContext db,
        TimeProvider timeProvider,
        Guid? queueId,
        int? count,
        CancellationToken cancellationToken)
    {
        var queue = await GetDemoQueueAsync(db, queueId, cancellationToken);
        if (queue is null)
        {
            return Results.Problem(
                title: "Demo queue not found",
                detail: "The demo-shop business or queue doesn't exist.",
                statusCode: StatusCodes.Status404NotFound);
        }

        // Add random demo customers (don't clear existing ones)
        var now = timeProvider.GetUtcNow();
        var customersAdded = 0;
        var random = new Random(); // Random seed for variety
        var customersToAdd = Math.Min(count ?? 5, 10); // Default 5, max 10

        for (var i = 0; i < customersToAdd; i++)
        {
            var firstName = FirstNames[random.Next(FirstNames.Length)];
            var lastName = LastNames[random.Next(LastNames.Length)];
            var name = $"{firstName} {lastName}";

            var joinTime = now.AddMinutes(-random.Next(1, 30));
            var partySize = random.Next(1, 6);
            var notes = random.NextDouble() > 0.8 ? GetRandomNote(random) : null;

            var result = queue.AddCustomer(name, joinTime, null, partySize, notes);
            if (result.IsSuccess)
            {
                db.Entry(result.Value).State = EntityState.Added;
                customersAdded++;
            }
        }

        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            return Results.Problem(
                title: "Concurrency conflict",
                detail: "The demo data was modified. Please try again.",
                statusCode: StatusCodes.Status409Conflict);
        }

        return Results.Ok(new SeedResponse(
            customersAdded,
            $"Added {customersAdded} demo customers to the queue."));
    }

    private static async Task<IResult> ResetHandler(
        AppDbContext db,
        Guid? queueId,
        CancellationToken cancellationToken)
    {
        var queue = await GetDemoQueueAsync(db, queueId, cancellationToken);
        if (queue is null)
        {
            return Results.Problem(
                title: "Demo queue not found",
                detail: "The demo-shop business or queue doesn't exist.",
                statusCode: StatusCodes.Status404NotFound);
        }

        // Remove all waiting and called customers
        var customersToRemove = queue.Customers
            .Where(c => c.Status is Domain.Enums.CustomerStatus.Waiting or Domain.Enums.CustomerStatus.Called)
            .ToList();

        foreach (var customer in customersToRemove)
        {
            queue.RemoveCustomer(customer.Id);
        }

        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            return Results.Problem(
                title: "Concurrency conflict",
                detail: "The demo data was modified. Please try again.",
                statusCode: StatusCodes.Status409Conflict);
        }

        return Results.Ok(new ResetResponse(
            customersToRemove.Count,
            $"Removed {customersToRemove.Count} customers from the queue."));
    }

    private static async Task<Queue?> GetDemoQueueAsync(
        AppDbContext db,
        Guid? queueId,
        CancellationToken cancellationToken)
    {
        var business = await db.Businesses
            .Include(b => b.Queues)
                .ThenInclude(q => q.Customers)
            .FirstOrDefaultAsync(b => b.Slug == "demo-shop", cancellationToken);

        if (business is null) return null;

        return queueId.HasValue
            ? business.Queues.FirstOrDefault(q => q.Id == queueId.Value && q.IsActive)
            : business.Queues.FirstOrDefault(q => q.IsActive);
    }

    private static string GetRandomNote(Random random)
    {
        var notes = new[] { "Allergies", "Wheelchair access", "Birthday celebration", "VIP", "First time visitor" };
        return notes[random.Next(notes.Length)];
    }
}
