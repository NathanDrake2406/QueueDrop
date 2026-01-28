using QueueDrop.Domain.Common;

namespace QueueDrop.Domain.Abstractions;

/// <summary>
/// Abstraction for sending transactional emails.
/// Infrastructure implements this with Resend, SendGrid, etc.
/// </summary>
public interface IEmailService
{
    Task<Result<string>> SendMagicLinkAsync(
        string toEmail,
        string magicLinkUrl,
        CancellationToken cancellationToken = default);
}
