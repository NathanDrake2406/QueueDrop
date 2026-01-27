using Microsoft.EntityFrameworkCore;
using QueueDrop.Domain.Entities;
using QueueDrop.Infrastructure.Persistence;

namespace QueueDrop.Api.Features.Demo;

/// <summary>
/// Vertical slice: Seeds demo data for showcasing the app.
/// POST /api/demo/seed
/// </summary>
public static class SeedDemoData
{
    public sealed record Response(int CustomersAdded, string Message);

    private static readonly string[] DemoNames =
    [
        "Alice Chen", "Bob Smith", "Carlos Garcia", "Diana Ross",
        "Ethan Wong", "Fiona Lee", "George Kim", "Hannah Park",
        "Ivan Petrov", "Julia Santos", "Kevin O'Brien", "Lisa Wang"
    ];

    public static void MapEndpoint(IEndpointRouteBuilder app)
    {
        app.MapPost("/api/demo/seed", Handler)
            .WithName("SeedDemoData")
            .WithTags("Demo")
            .Produces<Response>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status404NotFound);
    }

    private static async Task<IResult> Handler(
        AppDbContext db,
        TimeProvider timeProvider,
        Guid? queueId,
        CancellationToken cancellationToken)
    {
        // Find demo queue
        var business = await db.Businesses
            .Include(b => b.Queues)
                .ThenInclude(q => q.Customers)
            .FirstOrDefaultAsync(b => b.Slug == "demo-shop", cancellationToken);

        if (business is null)
        {
            return Results.Problem(
                title: "Demo business not found",
                detail: "The demo-shop business doesn't exist. Run migrations first.",
                statusCode: StatusCodes.Status404NotFound);
        }

        // If queueId provided, use that queue; otherwise use first active queue
        var queue = queueId.HasValue
            ? business.Queues.FirstOrDefault(q => q.Id == queueId.Value && q.IsActive)
            : business.Queues.FirstOrDefault(q => q.IsActive);

        if (queue is null)
        {
            return Results.Problem(
                title: "No active queue",
                detail: queueId.HasValue ? "Specified queue not found or not active." : "Demo shop has no active queue.",
                statusCode: StatusCodes.Status404NotFound);
        }

        // Remove existing waiting/called customers for a fresh demo
        var existingCustomers = queue.Customers
            .Where(c => c.Status is Domain.Enums.CustomerStatus.Waiting or Domain.Enums.CustomerStatus.Called)
            .ToList();

        foreach (var customer in existingCustomers)
        {
            queue.RemoveCustomer(customer.Id);
        }

        // Add fresh demo customers
        var now = timeProvider.GetUtcNow();
        var customersAdded = 0;
        var random = new Random(42); // Fixed seed for reproducibility

        foreach (var name in DemoNames.Take(8))
        {
            var joinTime = now.AddMinutes(-random.Next(5, 45));
            var partySize = random.Next(1, 5);
            var notes = random.NextDouble() > 0.7 ? "Allergies" : null;

            var result = queue.AddCustomer(name, joinTime, null, partySize, notes);
            if (result.IsSuccess)
            {
                db.Entry(result.Value).State = EntityState.Added;
                customersAdded++;
            }
        }

        await db.SaveChangesAsync(cancellationToken);

        return Results.Ok(new Response(
            customersAdded,
            $"Added {customersAdded} demo customers to the queue."));
    }
}
