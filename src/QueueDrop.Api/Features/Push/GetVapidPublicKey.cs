using Microsoft.Extensions.Options;
using QueueDrop.Infrastructure.PushNotifications;

namespace QueueDrop.Api.Features.Push;

/// <summary>
/// Vertical slice: Get VAPID public key for client-side push subscription.
/// GET /api/push/vapid-public-key
/// </summary>
public static class GetVapidPublicKey
{
    public sealed record Response(string PublicKey);

    public static void MapEndpoint(IEndpointRouteBuilder app)
    {
        app.MapGet("/api/push/vapid-public-key", Handler)
            .WithName("GetVapidPublicKey")
            .WithTags("Push")
            .Produces<Response>();
    }

    private static IResult Handler(IOptions<VapidOptions> options)
    {
        return Results.Ok(new Response(options.Value.PublicKey));
    }
}
