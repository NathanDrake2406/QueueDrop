using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Mvc;
using QueueDrop.Domain.Abstractions;
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
        IEmailService emailService,
        IConfiguration configuration,
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

        // Build the full magic link URL
        var baseUrl = configuration["App:BaseUrl"] ?? "http://localhost:5173";
        var verifyUrl = $"{baseUrl}/auth/verify?token={magicLink.Token}";

        // Send the email
        var emailResult = await emailService.SendMagicLinkAsync(
            request.Email,
            verifyUrl,
            cancellationToken);

        if (!emailResult.IsSuccess)
        {
            logger.LogWarning(
                "Failed to send magic link email to {Email}: {Error}",
                request.Email,
                emailResult.Error);
            // Still return success to avoid leaking whether email exists
        }

        return Results.Ok(new { message = "If an account exists, a login link has been sent." });
    }

    [GeneratedRegex(@"^[^@\s]+@[^@\s]+\.[^@\s]+$", RegexOptions.Compiled)]
    private static partial Regex EmailRegex();
}
