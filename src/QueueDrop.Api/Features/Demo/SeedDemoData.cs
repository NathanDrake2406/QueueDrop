using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QueueDrop.Api.Auth;
using QueueDrop.Domain.Entities;
using QueueDrop.Domain.Enums;
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
    public sealed record RoleTestResponse(
        string OwnerEmail,
        string OwnerToken,
        string StaffEmail,
        string StaffToken,
        string BusinessSlug,
        string Message);

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

    public sealed record CreateQueueRequest(string Name);
    public sealed record CreateQueueResponse(Guid Id, string Name, string Slug);

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

        // Dev-only: Create queue without auth (for testing)
        app.MapPost("/api/demo/business/{businessSlug}/queues", CreateQueueHandler)
            .WithName("DevCreateQueue")
            .WithTags("Demo")
            .Produces<CreateQueueResponse>(StatusCodes.Status201Created)
            .Produces(StatusCodes.Status404NotFound)
            .Produces<ProblemDetails>(StatusCodes.Status409Conflict);

        // Dev-only: Set up owner + staff for role testing
        app.MapPost("/api/demo/setup-roles", SetupRolesHandler)
            .WithName("SetupRoleTest")
            .WithTags("Demo")
            .Produces<RoleTestResponse>(StatusCodes.Status200OK);
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

    private static async Task<IResult> CreateQueueHandler(
        string businessSlug,
        CreateQueueRequest request,
        AppDbContext db,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        var business = await db.Businesses
            .Include(b => b.Queues)
            .FirstOrDefaultAsync(b => b.Slug == businessSlug.ToLowerInvariant(), cancellationToken);

        if (business is null)
            return Results.NotFound();

        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return Results.Problem(
                title: "Invalid name",
                detail: "Queue name is required.",
                statusCode: StatusCodes.Status400BadRequest);
        }

        var slug = request.Name
            .ToLowerInvariant()
            .Trim()
            .Replace(" ", "-")
            .Replace("'", "")
            .Replace("\"", "");

        if (business.Queues.Any(q => q.Slug == slug))
        {
            return Results.Problem(
                title: "Slug already exists",
                detail: $"A queue with slug '{slug}' already exists in this business.",
                statusCode: StatusCodes.Status409Conflict);
        }

        var now = timeProvider.GetUtcNow();
        var queue = Queue.Create(business.Id, request.Name, slug, now);

        db.Queues.Add(queue);
        await db.SaveChangesAsync(cancellationToken);

        return Results.Created(
            $"/api/business/{businessSlug}/queues/{queue.Slug}",
            new CreateQueueResponse(queue.Id, queue.Name, queue.Slug));
    }

    private static async Task<IResult> SetupRolesHandler(
        AppDbContext db,
        IJwtTokenService jwtService,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        var now = timeProvider.GetUtcNow();
        const string businessSlug = "role-test-shop";
        const string ownerEmail = "owner@test.local";
        const string staffEmail = "staff@test.local";

        // Clean up any existing test data
        var existingBusiness = await db.Businesses
            .Include(b => b.Queues)
            .FirstOrDefaultAsync(b => b.Slug == businessSlug, cancellationToken);

        if (existingBusiness is not null)
        {
            // Remove queues and business
            db.Queues.RemoveRange(existingBusiness.Queues);
            db.Businesses.Remove(existingBusiness);
        }

        // Remove existing test users' memberships (but keep users for simplicity)
        var existingMemberships = await db.BusinessMembers
            .Include(bm => bm.User)
            .Where(bm => bm.User.Email == ownerEmail || bm.User.Email == staffEmail)
            .ToListAsync(cancellationToken);
        db.BusinessMembers.RemoveRange(existingMemberships);

        await db.SaveChangesAsync(cancellationToken);

        // Find or create owner user
        var ownerUser = await db.Users.FirstOrDefaultAsync(u => u.Email == ownerEmail, cancellationToken);
        if (ownerUser is null)
        {
            ownerUser = User.Create(ownerEmail, now);
            db.Users.Add(ownerUser);
        }

        // Find or create staff user
        var staffUser = await db.Users.FirstOrDefaultAsync(u => u.Email == staffEmail, cancellationToken);
        if (staffUser is null)
        {
            staffUser = User.Create(staffEmail, now);
            db.Users.Add(staffUser);
        }

        await db.SaveChangesAsync(cancellationToken);

        // Create business (NO queues - to test the NoQueuesState UI)
        var business = Domain.Entities.Business.Create("Role Test Shop", businessSlug, now, "For testing owner/staff roles");
        db.Businesses.Add(business);
        await db.SaveChangesAsync(cancellationToken);

        // Add owner membership
        var ownerMembership = BusinessMember.CreateOwner(ownerUser.Id, business.Id, now);
        db.BusinessMembers.Add(ownerMembership);

        // Add staff membership
        var staffMembership = BusinessMember.CreateStaffInvite(staffUser.Id, business.Id, now);
        staffMembership.AcceptInvite(now);
        db.BusinessMembers.Add(staffMembership);

        await db.SaveChangesAsync(cancellationToken);

        // Generate tokens
        var ownerToken = jwtService.GenerateToken(ownerUser.Id, ownerUser.Email);
        var staffToken = jwtService.GenerateToken(staffUser.Id, staffUser.Email);

        return Results.Ok(new RoleTestResponse(
            ownerEmail,
            ownerToken,
            staffEmail,
            staffToken,
            businessSlug,
            $"Created '{businessSlug}' with NO queues. Owner sees create form, staff sees 'contact owner' message. Visit /staff/{businessSlug}"));
    }
}
