namespace QueueDrop.Infrastructure.Email;

public sealed class ResendOptions
{
    public const string SectionName = "Resend";

    /// <summary>
    /// Resend API key. Get one at https://resend.com/api-keys
    /// </summary>
    public required string ApiKey { get; init; }

    /// <summary>
    /// The "from" email address. Must be verified in Resend.
    /// For development, use "onboarding@resend.dev".
    /// For production, use your own domain like "noreply@queuedrop.com".
    /// </summary>
    public required string FromEmail { get; init; }

    /// <summary>
    /// Display name for the sender.
    /// </summary>
    public string FromName { get; init; } = "QueueDrop";
}
