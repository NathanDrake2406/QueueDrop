namespace QueueDrop.Api.Auth;

public sealed class JwtOptions
{
    public const string SectionName = "Jwt";

    public string SecretKey { get; init; } = null!;
    public string Issuer { get; init; } = "QueueDrop";
    public string Audience { get; init; } = "QueueDrop";
    public int ExpirationMinutes { get; init; } = 60;
}
