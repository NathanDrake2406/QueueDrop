using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using FluentAssertions;
using Microsoft.Extensions.Options;
using QueueDrop.Api.Auth;

namespace QueueDrop.Api.Tests;

public class JwtTokenServiceTests
{
    private readonly JwtTokenService _service;
    private readonly JwtOptions _options;

    public JwtTokenServiceTests()
    {
        _options = new JwtOptions
        {
            SecretKey = "super-secret-key-that-is-at-least-32-characters-long",
            Issuer = "TestIssuer",
            Audience = "TestAudience",
            ExpirationMinutes = 60
        };
        _service = new JwtTokenService(Options.Create(_options));
    }

    [Fact]
    public void GenerateToken_ShouldReturnValidJwt()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var email = "test@example.com";

        // Act
        var token = _service.GenerateToken(userId, email);

        // Assert
        token.Should().NotBeNullOrEmpty();

        var handler = new JwtSecurityTokenHandler();
        var jwt = handler.ReadJwtToken(token);

        jwt.Issuer.Should().Be(_options.Issuer);
        jwt.Audiences.Should().Contain(_options.Audience);
        jwt.Claims.Should().Contain(c => c.Type == ClaimTypes.NameIdentifier && c.Value == userId.ToString());
        jwt.Claims.Should().Contain(c => c.Type == ClaimTypes.Email && c.Value == email);
    }

    [Fact]
    public void GenerateToken_ShouldSetCorrectExpiration()
    {
        // Act
        var token = _service.GenerateToken(Guid.NewGuid(), "test@example.com");

        // Assert
        var handler = new JwtSecurityTokenHandler();
        var jwt = handler.ReadJwtToken(token);

        jwt.ValidTo.Should().BeCloseTo(DateTime.UtcNow.AddMinutes(_options.ExpirationMinutes), TimeSpan.FromMinutes(1));
    }
}
