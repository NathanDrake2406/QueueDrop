using Microsoft.Extensions.Logging;
using QueueDrop.Domain.Abstractions;
using QueueDrop.Domain.Common;

namespace QueueDrop.Infrastructure.Email;

/// <summary>
/// Development-only email service that logs emails to console.
/// Used when Resend API key is not configured.
/// </summary>
public sealed class ConsoleEmailService : IEmailService
{
    private readonly ILogger<ConsoleEmailService> _logger;

    public ConsoleEmailService(ILogger<ConsoleEmailService> logger)
    {
        _logger = logger;
    }

    public Task<Result<string>> SendMagicLinkAsync(
        string toEmail,
        string magicLinkUrl,
        CancellationToken cancellationToken = default)
    {
        _logger.LogWarning("=== DEVELOPMENT EMAIL (Resend not configured) ===");
        _logger.LogWarning("To: {Email}", toEmail);
        _logger.LogWarning("Subject: Sign in to QueueDrop");
        _logger.LogWarning("Magic Link: {Url}", magicLinkUrl);
        _logger.LogWarning("================================================");

        return Task.FromResult(Result<string>.Success("console-dev-email"));
    }
}
