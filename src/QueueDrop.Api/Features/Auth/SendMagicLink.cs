using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Mvc;
using QueueDrop.Domain.Entities;
using QueueDrop.Infrastructure.Persistence;

namespace QueueDrop.Api.Features.Auth;

/// <summary>
/// Vertical slice: Send a magic link for login/signup.
/// POST /api/auth/send-magic-link
/// </summary>
public static partial class SendMagicLink
{
    public sealed record Request(string Email);

    public static void MapEndpoint(IEndpointRouteBuilder app)
    {
        app.MapPost("/api/auth/send-magic-link", Handler)
            .WithName("SendMagicLink")
            .WithTags("Auth")
            .Produces(StatusCodes.Status200OK)
            .Produces<ProblemDetails>(StatusCodes.Status400BadRequest);
    }

    private static async Task<IResult> Handler(
        Request request,
        AppDbContext db,
        TimeProvider timeProvider,
        ILogger<Program> logger,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || !EmailRegex().IsMatch(request.Email))
        {
            return Results.Problem(
                title: "Invalid email",
                detail: "Please provide a valid email address.",
                statusCode: StatusCodes.Status400BadRequest);
        }

        var now = timeProvider.GetUtcNow();
        var magicLink = MagicLink.CreateLoginLink(
            request.Email,
            now,
            TimeSpan.FromMinutes(15));

        db.MagicLinks.Add(magicLink);
        await db.SaveChangesAsync(cancellationToken);

        // TODO: Send email - for now, log to console
        var verifyUrl = $"/auth/verify?token={magicLink.Token}";
        logger.LogInformation("Magic link created for {Email}: {Url}", request.Email, verifyUrl);

        return Results.Ok(new { message = "If an account exists, a login link has been sent." });
    }

    [GeneratedRegex(@"^[^@\s]+@[^@\s]+\.[^@\s]+$", RegexOptions.Compiled)]
    private static partial Regex EmailRegex();
}
