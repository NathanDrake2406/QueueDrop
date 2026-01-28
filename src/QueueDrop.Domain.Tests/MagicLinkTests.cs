using FluentAssertions;
using QueueDrop.Domain.Entities;
using QueueDrop.Domain.Enums;

namespace QueueDrop.Domain.Tests;

public class MagicLinkTests
{
    [Fact]
    public void CreateLoginLink_ShouldCreateValidLink()
    {
        // Arrange
        var email = "test@example.com";
        var now = DateTimeOffset.UtcNow;
        var expiresIn = TimeSpan.FromMinutes(15);

        // Act
        var link = MagicLink.CreateLoginLink(email, now, expiresIn);

        // Assert
        link.Id.Should().NotBeEmpty();
        link.Token.Should().NotBeNullOrEmpty();
        link.Token.Should().HaveLength(64); // 32 bytes = 64 hex chars
        link.Email.Should().Be("test@example.com");
        link.Type.Should().Be(MagicLinkType.Login);
        link.BusinessId.Should().BeNull();
        link.CreatedAt.Should().Be(now);
        link.ExpiresAt.Should().Be(now.Add(expiresIn));
        link.UsedAt.Should().BeNull();
    }

    [Fact]
    public void CreateInviteLink_ShouldIncludeBusinessId()
    {
        // Arrange
        var businessId = Guid.NewGuid();

        // Act
        var link = MagicLink.CreateInviteLink("staff@example.com", businessId, DateTimeOffset.UtcNow, TimeSpan.FromDays(7));

        // Assert
        link.Type.Should().Be(MagicLinkType.Invite);
        link.BusinessId.Should().Be(businessId);
    }

    [Fact]
    public void IsExpired_WhenNotExpired_ShouldReturnFalse()
    {
        // Arrange
        var now = DateTimeOffset.UtcNow;
        var link = MagicLink.CreateLoginLink("test@example.com", now, TimeSpan.FromMinutes(15));

        // Act & Assert
        link.IsExpired(now.AddMinutes(10)).Should().BeFalse();
    }

    [Fact]
    public void IsExpired_WhenExpired_ShouldReturnTrue()
    {
        // Arrange
        var now = DateTimeOffset.UtcNow;
        var link = MagicLink.CreateLoginLink("test@example.com", now, TimeSpan.FromMinutes(15));

        // Act & Assert
        link.IsExpired(now.AddMinutes(20)).Should().BeTrue();
    }

    [Fact]
    public void MarkUsed_ShouldSetUsedAt()
    {
        // Arrange
        var link = MagicLink.CreateLoginLink("test@example.com", DateTimeOffset.UtcNow, TimeSpan.FromMinutes(15));
        var usedAt = DateTimeOffset.UtcNow.AddMinutes(5);

        // Act
        link.MarkUsed(usedAt);

        // Assert
        link.UsedAt.Should().Be(usedAt);
    }

    [Fact]
    public void MarkUsed_WhenAlreadyUsed_ShouldThrow()
    {
        // Arrange
        var link = MagicLink.CreateLoginLink("test@example.com", DateTimeOffset.UtcNow, TimeSpan.FromMinutes(15));
        link.MarkUsed(DateTimeOffset.UtcNow);

        // Act
        var act = () => link.MarkUsed(DateTimeOffset.UtcNow);

        // Assert
        act.Should().Throw<InvalidOperationException>();
    }

    [Fact]
    public void CreateLoginLink_ShouldGenerateUniqueTokens()
    {
        // Act
        var link1 = MagicLink.CreateLoginLink("test@example.com", DateTimeOffset.UtcNow, TimeSpan.FromMinutes(15));
        var link2 = MagicLink.CreateLoginLink("test@example.com", DateTimeOffset.UtcNow, TimeSpan.FromMinutes(15));

        // Assert
        link1.Token.Should().NotBe(link2.Token);
    }
}
