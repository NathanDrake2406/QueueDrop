using Microsoft.EntityFrameworkCore;
using QueueDrop.Domain.Entities;
using QueueDrop.Domain.Enums;
using QueueDrop.Infrastructure.Persistence;

namespace QueueDrop.Api.Auth;

public interface IBusinessAuthorizationService
{
    Task<BusinessMember?> GetMembershipAsync(Guid userId, string businessSlug, CancellationToken cancellationToken);
    Task<bool> IsOwnerAsync(Guid userId, string businessSlug, CancellationToken cancellationToken);
    Task<bool> IsMemberAsync(Guid userId, string businessSlug, CancellationToken cancellationToken);
}

public sealed class BusinessAuthorizationService : IBusinessAuthorizationService
{
    private readonly AppDbContext _db;

    public BusinessAuthorizationService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<BusinessMember?> GetMembershipAsync(
        Guid userId,
        string businessSlug,
        CancellationToken cancellationToken)
    {
        return await _db.BusinessMembers
            .Include(bm => bm.Business)
            .FirstOrDefaultAsync(
                bm => bm.UserId == userId
                    && bm.Business.Slug == businessSlug.ToLowerInvariant()
                    && bm.JoinedAt != null,
                cancellationToken);
    }

    public async Task<bool> IsOwnerAsync(
        Guid userId,
        string businessSlug,
        CancellationToken cancellationToken)
    {
        var membership = await GetMembershipAsync(userId, businessSlug, cancellationToken);
        return membership?.Role == BusinessRole.Owner;
    }

    public async Task<bool> IsMemberAsync(
        Guid userId,
        string businessSlug,
        CancellationToken cancellationToken)
    {
        var membership = await GetMembershipAsync(userId, businessSlug, cancellationToken);
        return membership != null;
    }
}
