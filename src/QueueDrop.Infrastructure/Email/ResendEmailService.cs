using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using QueueDrop.Domain.Abstractions;
using QueueDrop.Domain.Common;
using Resend;

namespace QueueDrop.Infrastructure.Email;

public sealed class ResendEmailService : IEmailService
{
    private readonly IResend _resend;
    private readonly ResendOptions _options;
    private readonly ILogger<ResendEmailService> _logger;

    public ResendEmailService(
        IResend resend,
        IOptions<ResendOptions> options,
        ILogger<ResendEmailService> logger)
    {
        _resend = resend;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<Result<string>> SendMagicLinkAsync(
        string toEmail,
        string magicLinkUrl,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var message = new EmailMessage
            {
                From = $"{_options.FromName} <{_options.FromEmail}>",
                Subject = "Sign in to QueueDrop"
            };
            message.To.Add(toEmail);
            message.HtmlBody = BuildHtmlBody(magicLinkUrl);
            message.TextBody = BuildTextBody(magicLinkUrl);

            var response = await _resend.EmailSendAsync(message, cancellationToken);
            var emailId = response.Content.ToString();

            _logger.LogInformation(
                "Magic link email sent to {Email}, Resend ID: {EmailId}",
                toEmail,
                emailId);

            return Result<string>.Success(emailId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send magic link email to {Email}", toEmail);
            return Result<string>.Failure("Email.SendFailed", $"Failed to send email: {ex.Message}");
        }
    }

    private static string BuildHtmlBody(string magicLinkUrl) => $"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #334155; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <div style="text-align: center; margin-bottom: 32px;">
                <div style="display: inline-block; width: 48px; height: 48px; background: #0d9488; border-radius: 12px; margin-bottom: 16px;"></div>
                <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #0f172a;">QueueDrop</h1>
            </div>

            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 32px; text-align: center;">
                <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #0f172a;">Sign in to your account</h2>
                <p style="margin: 0 0 24px 0; color: #64748b;">Click the button below to securely sign in. This link expires in 15 minutes.</p>

                <a href="{magicLinkUrl}"
                   style="display: inline-block; background: #0d9488; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                    Sign in to QueueDrop
                </a>
            </div>

            <div style="margin-top: 32px; text-align: center; color: #94a3b8; font-size: 14px;">
                <p style="margin: 0 0 8px 0;">If you didn't request this email, you can safely ignore it.</p>
                <p style="margin: 0;">Button not working? Copy and paste this link:</p>
                <p style="margin: 8px 0 0 0; word-break: break-all; color: #64748b;">{magicLinkUrl}</p>
            </div>
        </body>
        </html>
        """;

    private static string BuildTextBody(string magicLinkUrl) => $"""
        Sign in to QueueDrop

        Click the link below to securely sign in to your account.
        This link expires in 15 minutes.

        {magicLinkUrl}

        If you didn't request this email, you can safely ignore it.
        """;
}
