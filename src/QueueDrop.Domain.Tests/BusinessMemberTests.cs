using FluentAssertions;
using QueueDrop.Domain.Entities;
using QueueDrop.Domain.Enums;

namespace QueueDrop.Domain.Tests;

public class BusinessMemberTests
{
    [Fact]
    public void CreateOwner_ShouldCreateMemberWithOwnerRole()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var businessId = Guid.NewGuid();
        var now = DateTimeOffset.UtcNow;

        // Act
        var member = BusinessMember.CreateOwner(userId, businessId, now);

        // Assert
        member.Id.Should().NotBeEmpty();
        member.UserId.Should().Be(userId);
        member.BusinessId.Should().Be(businessId);
        member.Role.Should().Be(BusinessRole.Owner);
        member.JoinedAt.Should().Be(now);
    }

    [Fact]
    public void CreateStaffInvite_ShouldCreatePendingMember()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var businessId = Guid.NewGuid();
        var now = DateTimeOffset.UtcNow;

        // Act
        var member = BusinessMember.CreateStaffInvite(userId, businessId, now);

        // Assert
        member.Role.Should().Be(BusinessRole.Staff);
        member.InvitedAt.Should().Be(now);
        member.JoinedAt.Should().BeNull();
    }

    [Fact]
    public void AcceptInvite_ShouldSetJoinedAt()
    {
        // Arrange
        var member = BusinessMember.CreateStaffInvite(Guid.NewGuid(), Guid.NewGuid(), DateTimeOffset.UtcNow);
        var joinedAt = DateTimeOffset.UtcNow.AddHours(1);

        // Act
        member.AcceptInvite(joinedAt);

        // Assert
        member.JoinedAt.Should().Be(joinedAt);
    }

    [Fact]
    public void AcceptInvite_WhenAlreadyJoined_ShouldThrow()
    {
        // Arrange
        var member = BusinessMember.CreateOwner(Guid.NewGuid(), Guid.NewGuid(), DateTimeOffset.UtcNow);

        // Act
        var act = () => member.AcceptInvite(DateTimeOffset.UtcNow);

        // Assert
        act.Should().Throw<InvalidOperationException>();
    }
}
