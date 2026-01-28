using FluentAssertions;
using QueueDrop.Domain.Entities;

namespace QueueDrop.Domain.Tests;

public class UserTests
{
    [Fact]
    public void Create_WithValidEmail_ShouldCreateUser()
    {
        // Arrange
        var email = "test@example.com";
        var createdAt = DateTimeOffset.UtcNow;

        // Act
        var user = User.Create(email, createdAt);

        // Assert
        user.Id.Should().NotBeEmpty();
        user.Email.Should().Be("test@example.com");
        user.CreatedAt.Should().Be(createdAt);
    }

    [Fact]
    public void Create_ShouldNormalizeEmailToLowercase()
    {
        // Act
        var user = User.Create("TEST@EXAMPLE.COM", DateTimeOffset.UtcNow);

        // Assert
        user.Email.Should().Be("test@example.com");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("invalid-email")]
    [InlineData("@example.com")]
    [InlineData("test@")]
    public void Create_WithInvalidEmail_ShouldThrow(string? email)
    {
        // Act
        var act = () => User.Create(email!, DateTimeOffset.UtcNow);

        // Assert
        act.Should().Throw<ArgumentException>();
    }
}
