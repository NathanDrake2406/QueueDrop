using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QueueDrop.Domain.Entities;
using QueueDrop.Infrastructure.Persistence;

namespace QueueDrop.Api.Features.Business;

/// <summary>
/// Vertical slice: Create a new business.
/// POST /api/business
/// </summary>
public static class CreateBusiness
{
    public sealed record Request(string Name, string? Slug);
    public sealed record Response(Guid Id, string Name, string Slug);

    public static void MapEndpoint(IEndpointRouteBuilder app)
    {
        app.MapPost("/api/business", Handler)
            .WithName("CreateBusiness")
            .WithTags("Business")
            .RequireAuthorization()
            .Produces<Response>(StatusCodes.Status201Created)
            .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
            .Produces<ProblemDetails>(StatusCodes.Status409Conflict);
    }

    private static async Task<IResult> Handler(
        Request request,
        ClaimsPrincipal user,
        AppDbContext db,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        var userIdClaim = user.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
        {
            return Results.Unauthorized();
        }

        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return Results.Problem(
                title: "Invalid name",
                detail: "Business name is required.",
                statusCode: StatusCodes.Status400BadRequest);
        }

        // Generate slug from name if not provided
        var slug = string.IsNullOrWhiteSpace(request.Slug)
            ? GenerateSlug(request.Name)
            : GenerateSlug(request.Slug);

        // Check for duplicate slug
        var existingBusiness = await db.Businesses
            .FirstOrDefaultAsync(b => b.Slug == slug, cancellationToken);

        if (existingBusiness is not null)
        {
            return Results.Problem(
                title: "Slug already taken",
                detail: $"A business with slug '{slug}' already exists.",
                statusCode: StatusCodes.Status409Conflict);
        }

        var now = timeProvider.GetUtcNow();
        var business = Domain.Entities.Business.Create(request.Name, slug, now);

        db.Businesses.Add(business);

        // Make the current user the owner
        var membership = BusinessMember.CreateOwner(userId, business.Id, now);
        db.BusinessMembers.Add(membership);

        await db.SaveChangesAsync(cancellationToken);

        return Results.Created(
            $"/api/business/{business.Slug}",
            new Response(business.Id, business.Name, business.Slug));
    }

    private static string GenerateSlug(string input)
    {
        return input
            .ToLowerInvariant()
            .Trim()
            .Replace(" ", "-")
            .Replace("'", "")
            .Replace("\"", "");
    }
}
