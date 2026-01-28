# Auth Foundation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add magic link authentication so business owners can sign up, log in, and create businesses.

**Architecture:** Three new domain entities (User, BusinessMember, MagicLink) following existing patterns. JWT tokens for session management. Vertical slice API endpoints. No email sending yet - log magic links to console for dev.

**Tech Stack:** .NET 8, EF Core, JWT Bearer auth, existing vertical slice patterns.

---

## Task 1: User Entity

**Files:**
- Create: `src/QueueDrop.Domain/Entities/User.cs`
- Test: `src/QueueDrop.Domain.Tests/UserTests.cs`

**Step 1: Write the failing test**

Create `src/QueueDrop.Domain.Tests/UserTests.cs`:

```csharp
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
```

**Step 2: Run test to verify it fails**

Run: `dotnet test src/QueueDrop.Domain.Tests --filter "FullyQualifiedName~UserTests" --verbosity minimal`
Expected: Build failure - `User` type does not exist

**Step 3: Write minimal implementation**

Create `src/QueueDrop.Domain/Entities/User.cs`:

```csharp
using System.Text.RegularExpressions;
using QueueDrop.Domain.Common;

namespace QueueDrop.Domain.Entities;

/// <summary>
/// Represents an authenticated user (business owner or staff member).
/// </summary>
public sealed partial class User : Entity
{
    /// <summary>Email address (normalized to lowercase).</summary>
    public string Email { get; private set; } = null!;

    /// <summary>When the user account was created.</summary>
    public DateTimeOffset CreatedAt { get; private init; }

    // EF Core constructor
    private User() { }

    public static User Create(string email, DateTimeOffset createdAt)
    {
        if (string.IsNullOrWhiteSpace(email))
            throw new ArgumentException("Email is required", nameof(email));

        var normalized = email.Trim().ToLowerInvariant();

        if (!EmailRegex().IsMatch(normalized))
            throw new ArgumentException("Invalid email format", nameof(email));

        return new User
        {
            Id = Guid.NewGuid(),
            Email = normalized,
            CreatedAt = createdAt
        };
    }

    [GeneratedRegex(@"^[^@\s]+@[^@\s]+\.[^@\s]+$", RegexOptions.Compiled)]
    private static partial Regex EmailRegex();
}
```

**Step 4: Run test to verify it passes**

Run: `dotnet test src/QueueDrop.Domain.Tests --filter "FullyQualifiedName~UserTests" --verbosity minimal`
Expected: All 3 tests pass

**Step 5: Commit**

```bash
git add src/QueueDrop.Domain/Entities/User.cs src/QueueDrop.Domain.Tests/UserTests.cs
git commit -m "Add User entity with email validation"
```

---

## Task 2: BusinessRole Enum and BusinessMember Entity

**Files:**
- Create: `src/QueueDrop.Domain/Enums/BusinessRole.cs`
- Create: `src/QueueDrop.Domain/Entities/BusinessMember.cs`
- Test: `src/QueueDrop.Domain.Tests/BusinessMemberTests.cs`

**Step 1: Create the enum (no test needed for simple enum)**

Create `src/QueueDrop.Domain/Enums/BusinessRole.cs`:

```csharp
namespace QueueDrop.Domain.Enums;

/// <summary>
/// Role a user has within a business.
/// </summary>
public enum BusinessRole
{
    /// <summary>Full access - can configure business, manage queues, invite staff.</summary>
    Owner,

    /// <summary>Limited access - can operate queues (call next, mark served).</summary>
    Staff
}
```

**Step 2: Write the failing test**

Create `src/QueueDrop.Domain.Tests/BusinessMemberTests.cs`:

```csharp
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
```

**Step 3: Run test to verify it fails**

Run: `dotnet test src/QueueDrop.Domain.Tests --filter "FullyQualifiedName~BusinessMemberTests" --verbosity minimal`
Expected: Build failure - `BusinessMember` type does not exist

**Step 4: Write minimal implementation**

Create `src/QueueDrop.Domain/Entities/BusinessMember.cs`:

```csharp
using QueueDrop.Domain.Common;
using QueueDrop.Domain.Enums;

namespace QueueDrop.Domain.Entities;

/// <summary>
/// Links a User to a Business with a specific role.
/// </summary>
public sealed class BusinessMember : Entity
{
    public Guid UserId { get; private init; }
    public Guid BusinessId { get; private init; }
    public BusinessRole Role { get; private init; }
    public DateTimeOffset InvitedAt { get; private init; }
    public DateTimeOffset? JoinedAt { get; private set; }

    // Navigation properties
    public User User { get; private set; } = null!;
    public Business Business { get; private set; } = null!;

    // EF Core constructor
    private BusinessMember() { }

    /// <summary>Creates a business member as owner (immediately joined).</summary>
    public static BusinessMember CreateOwner(Guid userId, Guid businessId, DateTimeOffset now)
    {
        return new BusinessMember
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            BusinessId = businessId,
            Role = BusinessRole.Owner,
            InvitedAt = now,
            JoinedAt = now
        };
    }

    /// <summary>Creates a pending staff invite (not yet joined).</summary>
    public static BusinessMember CreateStaffInvite(Guid userId, Guid businessId, DateTimeOffset invitedAt)
    {
        return new BusinessMember
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            BusinessId = businessId,
            Role = BusinessRole.Staff,
            InvitedAt = invitedAt,
            JoinedAt = null
        };
    }

    public void AcceptInvite(DateTimeOffset joinedAt)
    {
        if (JoinedAt.HasValue)
            throw new InvalidOperationException("Invite has already been accepted");

        JoinedAt = joinedAt;
    }
}
```

**Step 5: Run test to verify it passes**

Run: `dotnet test src/QueueDrop.Domain.Tests --filter "FullyQualifiedName~BusinessMemberTests" --verbosity minimal`
Expected: All 4 tests pass

**Step 6: Commit**

```bash
git add src/QueueDrop.Domain/Enums/BusinessRole.cs src/QueueDrop.Domain/Entities/BusinessMember.cs src/QueueDrop.Domain.Tests/BusinessMemberTests.cs
git commit -m "Add BusinessMember entity with Owner and Staff roles"
```

---

## Task 3: MagicLink Entity

**Files:**
- Create: `src/QueueDrop.Domain/Enums/MagicLinkType.cs`
- Create: `src/QueueDrop.Domain/Entities/MagicLink.cs`
- Test: `src/QueueDrop.Domain.Tests/MagicLinkTests.cs`

**Step 1: Create the enum**

Create `src/QueueDrop.Domain/Enums/MagicLinkType.cs`:

```csharp
namespace QueueDrop.Domain.Enums;

public enum MagicLinkType
{
    /// <summary>For login or signup.</summary>
    Login,

    /// <summary>For staff invitation.</summary>
    Invite
}
```

**Step 2: Write the failing test**

Create `src/QueueDrop.Domain.Tests/MagicLinkTests.cs`:

```csharp
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
```

**Step 3: Run test to verify it fails**

Run: `dotnet test src/QueueDrop.Domain.Tests --filter "FullyQualifiedName~MagicLinkTests" --verbosity minimal`
Expected: Build failure - `MagicLink` type does not exist

**Step 4: Write minimal implementation**

Create `src/QueueDrop.Domain/Entities/MagicLink.cs`:

```csharp
using System.Security.Cryptography;
using QueueDrop.Domain.Common;
using QueueDrop.Domain.Enums;

namespace QueueDrop.Domain.Entities;

/// <summary>
/// One-time use link for passwordless authentication.
/// </summary>
public sealed class MagicLink : Entity
{
    /// <summary>URL-safe token (64 hex characters from 32 random bytes).</summary>
    public string Token { get; private init; } = null!;

    /// <summary>Email this link was sent to.</summary>
    public string Email { get; private init; } = null!;

    /// <summary>Type of magic link (login or invite).</summary>
    public MagicLinkType Type { get; private init; }

    /// <summary>For invite links, the business being invited to.</summary>
    public Guid? BusinessId { get; private init; }

    public DateTimeOffset CreatedAt { get; private init; }
    public DateTimeOffset ExpiresAt { get; private init; }
    public DateTimeOffset? UsedAt { get; private set; }

    // EF Core constructor
    private MagicLink() { }

    public static MagicLink CreateLoginLink(string email, DateTimeOffset now, TimeSpan expiresIn)
    {
        return new MagicLink
        {
            Id = Guid.NewGuid(),
            Token = GenerateToken(),
            Email = email.Trim().ToLowerInvariant(),
            Type = MagicLinkType.Login,
            BusinessId = null,
            CreatedAt = now,
            ExpiresAt = now.Add(expiresIn)
        };
    }

    public static MagicLink CreateInviteLink(string email, Guid businessId, DateTimeOffset now, TimeSpan expiresIn)
    {
        return new MagicLink
        {
            Id = Guid.NewGuid(),
            Token = GenerateToken(),
            Email = email.Trim().ToLowerInvariant(),
            Type = MagicLinkType.Invite,
            BusinessId = businessId,
            CreatedAt = now,
            ExpiresAt = now.Add(expiresIn)
        };
    }

    public bool IsExpired(DateTimeOffset now) => now >= ExpiresAt;

    public void MarkUsed(DateTimeOffset usedAt)
    {
        if (UsedAt.HasValue)
            throw new InvalidOperationException("Magic link has already been used");

        UsedAt = usedAt;
    }

    private static string GenerateToken()
    {
        return Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
    }
}
```

**Step 5: Run test to verify it passes**

Run: `dotnet test src/QueueDrop.Domain.Tests --filter "FullyQualifiedName~MagicLinkTests" --verbosity minimal`
Expected: All 7 tests pass

**Step 6: Commit**

```bash
git add src/QueueDrop.Domain/Enums/MagicLinkType.cs src/QueueDrop.Domain/Entities/MagicLink.cs src/QueueDrop.Domain.Tests/MagicLinkTests.cs
git commit -m "Add MagicLink entity for passwordless auth"
```

---

## Task 4: EF Core Configuration for Auth Entities

**Files:**
- Modify: `src/QueueDrop.Infrastructure/Persistence/AppDbContext.cs`
- Create: `src/QueueDrop.Infrastructure/Persistence/Configurations/UserConfiguration.cs`
- Create: `src/QueueDrop.Infrastructure/Persistence/Configurations/BusinessMemberConfiguration.cs`
- Create: `src/QueueDrop.Infrastructure/Persistence/Configurations/MagicLinkConfiguration.cs`

**Step 1: Add DbSets to AppDbContext**

In `src/QueueDrop.Infrastructure/Persistence/AppDbContext.cs`, add after line 15:

```csharp
public DbSet<User> Users => Set<User>();
public DbSet<BusinessMember> BusinessMembers => Set<BusinessMember>();
public DbSet<MagicLink> MagicLinks => Set<MagicLink>();
```

Also add the using statement at the top if not already present:
```csharp
using QueueDrop.Domain.Entities;
```

**Step 2: Create UserConfiguration**

Create `src/QueueDrop.Infrastructure/Persistence/Configurations/UserConfiguration.cs`:

```csharp
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using QueueDrop.Domain.Entities;

namespace QueueDrop.Infrastructure.Persistence.Configurations;

public sealed class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.ToTable("users");

        builder.HasKey(u => u.Id);

        builder.Property(u => u.Email)
            .HasMaxLength(255)
            .IsRequired();

        builder.HasIndex(u => u.Email)
            .IsUnique();

        builder.Property(u => u.CreatedAt)
            .IsRequired();
    }
}
```

**Step 3: Create BusinessMemberConfiguration**

Create `src/QueueDrop.Infrastructure/Persistence/Configurations/BusinessMemberConfiguration.cs`:

```csharp
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using QueueDrop.Domain.Entities;

namespace QueueDrop.Infrastructure.Persistence.Configurations;

public sealed class BusinessMemberConfiguration : IEntityTypeConfiguration<BusinessMember>
{
    public void Configure(EntityTypeBuilder<BusinessMember> builder)
    {
        builder.ToTable("business_members");

        builder.HasKey(bm => bm.Id);

        builder.Property(bm => bm.Role)
            .HasConversion<string>()
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(bm => bm.InvitedAt)
            .IsRequired();

        builder.HasIndex(bm => new { bm.UserId, bm.BusinessId })
            .IsUnique();

        builder.HasIndex(bm => bm.UserId);
        builder.HasIndex(bm => bm.BusinessId);

        builder.HasOne(bm => bm.User)
            .WithMany()
            .HasForeignKey(bm => bm.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(bm => bm.Business)
            .WithMany()
            .HasForeignKey(bm => bm.BusinessId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
```

**Step 4: Create MagicLinkConfiguration**

Create `src/QueueDrop.Infrastructure/Persistence/Configurations/MagicLinkConfiguration.cs`:

```csharp
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using QueueDrop.Domain.Entities;

namespace QueueDrop.Infrastructure.Persistence.Configurations;

public sealed class MagicLinkConfiguration : IEntityTypeConfiguration<MagicLink>
{
    public void Configure(EntityTypeBuilder<MagicLink> builder)
    {
        builder.ToTable("magic_links");

        builder.HasKey(ml => ml.Id);

        builder.Property(ml => ml.Token)
            .HasMaxLength(64)
            .IsRequired();

        builder.HasIndex(ml => ml.Token)
            .IsUnique();

        builder.Property(ml => ml.Email)
            .HasMaxLength(255)
            .IsRequired();

        builder.HasIndex(ml => ml.Email);

        builder.Property(ml => ml.Type)
            .HasConversion<string>()
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(ml => ml.CreatedAt)
            .IsRequired();

        builder.Property(ml => ml.ExpiresAt)
            .IsRequired();
    }
}
```

**Step 5: Run build to verify configurations compile**

Run: `dotnet build src/QueueDrop.Infrastructure`
Expected: Build succeeds

**Step 6: Commit**

```bash
git add src/QueueDrop.Infrastructure/Persistence/AppDbContext.cs src/QueueDrop.Infrastructure/Persistence/Configurations/UserConfiguration.cs src/QueueDrop.Infrastructure/Persistence/Configurations/BusinessMemberConfiguration.cs src/QueueDrop.Infrastructure/Persistence/Configurations/MagicLinkConfiguration.cs
git commit -m "Add EF Core configurations for auth entities"
```

---

## Task 5: Database Migration

**Files:**
- Create: EF Core migration (auto-generated)

**Step 1: Generate migration**

Run from project root:
```bash
cd src/QueueDrop.Api && dotnet ef migrations add AddAuthEntities --project ../QueueDrop.Infrastructure
```

Expected: New migration file created in `src/QueueDrop.Infrastructure/Persistence/Migrations/`

**Step 2: Review migration**

Read the generated migration file to verify it creates:
- `users` table with unique email index
- `business_members` table with composite unique index
- `magic_links` table with unique token index

**Step 3: Commit**

```bash
git add src/QueueDrop.Infrastructure/Persistence/Migrations/
git commit -m "Add migration for auth entities"
```

---

## Task 6: JWT Configuration

**Files:**
- Create: `src/QueueDrop.Api/Auth/JwtOptions.cs`
- Create: `src/QueueDrop.Api/Auth/JwtTokenService.cs`
- Test: `src/QueueDrop.Api.Tests/JwtTokenServiceTests.cs`

**Step 1: Create JwtOptions**

Create `src/QueueDrop.Api/Auth/JwtOptions.cs`:

```csharp
namespace QueueDrop.Api.Auth;

public sealed class JwtOptions
{
    public const string SectionName = "Jwt";

    public string SecretKey { get; init; } = null!;
    public string Issuer { get; init; } = "QueueDrop";
    public string Audience { get; init; } = "QueueDrop";
    public int ExpirationMinutes { get; init; } = 60;
}
```

**Step 2: Write failing test**

Create `src/QueueDrop.Api.Tests/JwtTokenServiceTests.cs`:

```csharp
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
```

**Step 3: Run test to verify it fails**

Run: `dotnet test src/QueueDrop.Api.Tests --filter "FullyQualifiedName~JwtTokenServiceTests" --verbosity minimal`
Expected: Build failure - `JwtTokenService` does not exist

**Step 4: Write implementation**

Create `src/QueueDrop.Api/Auth/JwtTokenService.cs`:

```csharp
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace QueueDrop.Api.Auth;

public interface IJwtTokenService
{
    string GenerateToken(Guid userId, string email);
}

public sealed class JwtTokenService : IJwtTokenService
{
    private readonly JwtOptions _options;

    public JwtTokenService(IOptions<JwtOptions> options)
    {
        _options = options.Value;
    }

    public string GenerateToken(Guid userId, string email)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_options.SecretKey));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
            new Claim(ClaimTypes.Email, email),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        var token = new JwtSecurityToken(
            issuer: _options.Issuer,
            audience: _options.Audience,
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(_options.ExpirationMinutes),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
```

**Step 5: Add required NuGet package**

Run: `dotnet add src/QueueDrop.Api package Microsoft.AspNetCore.Authentication.JwtBearer`

**Step 6: Run test to verify it passes**

Run: `dotnet test src/QueueDrop.Api.Tests --filter "FullyQualifiedName~JwtTokenServiceTests" --verbosity minimal`
Expected: Both tests pass

**Step 7: Commit**

```bash
git add src/QueueDrop.Api/Auth/ src/QueueDrop.Api.Tests/JwtTokenServiceTests.cs src/QueueDrop.Api/QueueDrop.Api.csproj
git commit -m "Add JWT token service"
```

---

## Task 7: Send Magic Link Endpoint

**Files:**
- Create: `src/QueueDrop.Api/Features/Auth/SendMagicLink.cs`
- Test: `src/QueueDrop.Api.Tests/SendMagicLinkTests.cs`

**Step 1: Write failing test**

Create `src/QueueDrop.Api.Tests/SendMagicLinkTests.cs`:

```csharp
using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using QueueDrop.Api.Tests;
using QueueDrop.Infrastructure.Persistence;

namespace QueueDrop.Api.Tests;

public class SendMagicLinkTests : IntegrationTestBase
{
    [Fact]
    public async Task SendMagicLink_WithValidEmail_ShouldReturn200()
    {
        // Act
        var response = await Client.PostAsJsonAsync("/api/auth/send-magic-link", new { email = "newuser@example.com" });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task SendMagicLink_ShouldCreateMagicLinkInDatabase()
    {
        // Arrange
        var email = "test@example.com";

        // Act
        await Client.PostAsJsonAsync("/api/auth/send-magic-link", new { email });

        // Assert
        await using var scope = ServiceProvider.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<TestAppDbContext>();
        var link = db.MagicLinks.FirstOrDefault(l => l.Email == email);

        link.Should().NotBeNull();
        link!.Token.Should().HaveLength(64);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("invalid-email")]
    public async Task SendMagicLink_WithInvalidEmail_ShouldReturn400(string? email)
    {
        // Act
        var response = await Client.PostAsJsonAsync("/api/auth/send-magic-link", new { email });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }
}
```

**Step 2: Run test to verify it fails**

Run: `dotnet test src/QueueDrop.Api.Tests --filter "FullyQualifiedName~SendMagicLinkTests" --verbosity minimal`
Expected: 404 Not Found (endpoint doesn't exist)

**Step 3: Write implementation**

Create `src/QueueDrop.Api/Features/Auth/SendMagicLink.cs`:

```csharp
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Mvc;
using QueueDrop.Domain.Entities;
using QueueDrop.Infrastructure.Persistence;

namespace QueueDrop.Api.Features.Auth;

/// <summary>
/// Vertical slice: Send a magic link for login/signup.
/// POST /api/auth/send-magic-link
/// </summary>
public static partial class SendMagicLink
{
    public sealed record Request(string Email);

    public static void MapEndpoint(IEndpointRouteBuilder app)
    {
        app.MapPost("/api/auth/send-magic-link", Handler)
            .WithName("SendMagicLink")
            .WithTags("Auth")
            .Produces(StatusCodes.Status200OK)
            .Produces<ProblemDetails>(StatusCodes.Status400BadRequest);
    }

    private static async Task<IResult> Handler(
        Request request,
        AppDbContext db,
        TimeProvider timeProvider,
        ILogger<Program> logger,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || !EmailRegex().IsMatch(request.Email))
        {
            return Results.Problem(
                title: "Invalid email",
                detail: "Please provide a valid email address.",
                statusCode: StatusCodes.Status400BadRequest);
        }

        var now = timeProvider.GetUtcNow();
        var magicLink = MagicLink.CreateLoginLink(
            request.Email,
            now,
            TimeSpan.FromMinutes(15));

        db.MagicLinks.Add(magicLink);
        await db.SaveChangesAsync(cancellationToken);

        // TODO: Send email - for now, log to console
        var verifyUrl = $"/auth/verify?token={magicLink.Token}";
        logger.LogInformation("Magic link created for {Email}: {Url}", request.Email, verifyUrl);

        return Results.Ok(new { message = "If an account exists, a login link has been sent." });
    }

    [GeneratedRegex(@"^[^@\s]+@[^@\s]+\.[^@\s]+$", RegexOptions.Compiled)]
    private static partial Regex EmailRegex();
}
```

**Step 4: Register endpoint in Program.cs**

In `src/QueueDrop.Api/Program.cs`, add the using statement:
```csharp
using QueueDrop.Api.Features.Auth;
```

And add after line 83 (after GetVapidPublicKey.MapEndpoint):
```csharp
// Auth endpoints
SendMagicLink.MapEndpoint(app);
```

**Step 5: Update TestAppDbContext**

We need to add the MagicLinks DbSet to the test context. In `src/QueueDrop.Api.Tests/TestAppDbContext.cs`, add:

```csharp
public DbSet<MagicLink> MagicLinks => Set<MagicLink>();
```

And add the using if needed:
```csharp
using QueueDrop.Domain.Entities;
```

**Step 6: Run test to verify it passes**

Run: `dotnet test src/QueueDrop.Api.Tests --filter "FullyQualifiedName~SendMagicLinkTests" --verbosity minimal`
Expected: All 3 tests pass

**Step 7: Commit**

```bash
git add src/QueueDrop.Api/Features/Auth/SendMagicLink.cs src/QueueDrop.Api/Program.cs src/QueueDrop.Api.Tests/SendMagicLinkTests.cs src/QueueDrop.Api.Tests/TestAppDbContext.cs
git commit -m "Add send magic link endpoint"
```

---

## Task 8: Verify Magic Link Endpoint

**Files:**
- Create: `src/QueueDrop.Api/Features/Auth/VerifyMagicLink.cs`
- Test: `src/QueueDrop.Api.Tests/VerifyMagicLinkTests.cs`

**Step 1: Write failing test**

Create `src/QueueDrop.Api.Tests/VerifyMagicLinkTests.cs`:

```csharp
using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using QueueDrop.Api.Tests;
using QueueDrop.Domain.Entities;
using QueueDrop.Infrastructure.Persistence;

namespace QueueDrop.Api.Tests;

public class VerifyMagicLinkTests : IntegrationTestBase
{
    [Fact]
    public async Task VerifyMagicLink_WithValidToken_ShouldReturnJwt()
    {
        // Arrange
        var email = "newuser@example.com";
        await Client.PostAsJsonAsync("/api/auth/send-magic-link", new { email });

        await using var scope = ServiceProvider.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<TestAppDbContext>();
        var magicLink = db.MagicLinks.First(l => l.Email == email);

        // Act
        var response = await Client.GetAsync($"/api/auth/verify?token={magicLink.Token}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var result = await response.Content.ReadFromJsonAsync<VerifyResponse>();
        result.Should().NotBeNull();
        result!.Token.Should().NotBeNullOrEmpty();
        result.Email.Should().Be(email);
        result.IsNewUser.Should().BeTrue();
    }

    [Fact]
    public async Task VerifyMagicLink_ShouldCreateUserIfNotExists()
    {
        // Arrange
        var email = "brand-new@example.com";
        await Client.PostAsJsonAsync("/api/auth/send-magic-link", new { email });

        await using var scope = ServiceProvider.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<TestAppDbContext>();
        var magicLink = db.MagicLinks.First(l => l.Email == email);

        // Act
        await Client.GetAsync($"/api/auth/verify?token={magicLink.Token}");

        // Assert
        db.ChangeTracker.Clear();
        var user = db.Users.FirstOrDefault(u => u.Email == email);
        user.Should().NotBeNull();
    }

    [Fact]
    public async Task VerifyMagicLink_WithInvalidToken_ShouldReturn400()
    {
        // Act
        var response = await Client.GetAsync("/api/auth/verify?token=invalid-token");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task VerifyMagicLink_WithUsedToken_ShouldReturn400()
    {
        // Arrange
        var email = "test@example.com";
        await Client.PostAsJsonAsync("/api/auth/send-magic-link", new { email });

        await using var scope = ServiceProvider.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<TestAppDbContext>();
        var magicLink = db.MagicLinks.First(l => l.Email == email);

        // Use it once
        await Client.GetAsync($"/api/auth/verify?token={magicLink.Token}");

        // Act - try to use it again
        var response = await Client.GetAsync($"/api/auth/verify?token={magicLink.Token}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    private record VerifyResponse(string Token, Guid UserId, string Email, bool IsNewUser);
}
```

**Step 2: Run test to verify it fails**

Run: `dotnet test src/QueueDrop.Api.Tests --filter "FullyQualifiedName~VerifyMagicLinkTests" --verbosity minimal`
Expected: 404 Not Found (endpoint doesn't exist)

**Step 3: Write implementation**

Create `src/QueueDrop.Api/Features/Auth/VerifyMagicLink.cs`:

```csharp
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QueueDrop.Api.Auth;
using QueueDrop.Domain.Entities;
using QueueDrop.Infrastructure.Persistence;

namespace QueueDrop.Api.Features.Auth;

/// <summary>
/// Vertical slice: Verify a magic link and return JWT.
/// GET /api/auth/verify?token=xxx
/// </summary>
public static class VerifyMagicLink
{
    public sealed record Response(string Token, Guid UserId, string Email, bool IsNewUser);

    public static void MapEndpoint(IEndpointRouteBuilder app)
    {
        app.MapGet("/api/auth/verify", Handler)
            .WithName("VerifyMagicLink")
            .WithTags("Auth")
            .Produces<Response>(StatusCodes.Status200OK)
            .Produces<ProblemDetails>(StatusCodes.Status400BadRequest);
    }

    private static async Task<IResult> Handler(
        [FromQuery] string token,
        AppDbContext db,
        IJwtTokenService jwtService,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        var magicLink = await db.MagicLinks
            .FirstOrDefaultAsync(ml => ml.Token == token, cancellationToken);

        if (magicLink is null)
        {
            return Results.Problem(
                title: "Invalid token",
                detail: "This link is invalid or has expired.",
                statusCode: StatusCodes.Status400BadRequest);
        }

        var now = timeProvider.GetUtcNow();

        if (magicLink.UsedAt.HasValue)
        {
            return Results.Problem(
                title: "Link already used",
                detail: "This link has already been used. Please request a new one.",
                statusCode: StatusCodes.Status400BadRequest);
        }

        if (magicLink.IsExpired(now))
        {
            return Results.Problem(
                title: "Link expired",
                detail: "This link has expired. Please request a new one.",
                statusCode: StatusCodes.Status400BadRequest);
        }

        // Mark as used
        magicLink.MarkUsed(now);

        // Find or create user
        var user = await db.Users
            .FirstOrDefaultAsync(u => u.Email == magicLink.Email, cancellationToken);

        var isNewUser = user is null;

        if (isNewUser)
        {
            user = User.Create(magicLink.Email, now);
            db.Users.Add(user);
        }

        await db.SaveChangesAsync(cancellationToken);

        // Generate JWT
        var jwt = jwtService.GenerateToken(user!.Id, user.Email);

        return Results.Ok(new Response(jwt, user.Id, user.Email, isNewUser));
    }
}
```

**Step 4: Register endpoint and services in Program.cs**

In `src/QueueDrop.Api/Program.cs`:

Add the using statement:
```csharp
using QueueDrop.Api.Auth;
```

Add JWT configuration after line 34 (after TimeProvider registration):
```csharp
// JWT Authentication
builder.Services.Configure<JwtOptions>(builder.Configuration.GetSection(JwtOptions.SectionName));
builder.Services.AddSingleton<IJwtTokenService, JwtTokenService>();
```

Add the endpoint after SendMagicLink.MapEndpoint:
```csharp
VerifyMagicLink.MapEndpoint(app);
```

**Step 5: Add JWT config to appsettings**

In `src/QueueDrop.Api/appsettings.json`, add:
```json
"Jwt": {
  "SecretKey": "your-super-secret-key-that-should-be-at-least-32-characters",
  "Issuer": "QueueDrop",
  "Audience": "QueueDrop",
  "ExpirationMinutes": 60
}
```

**Step 6: Update test setup**

In `src/QueueDrop.Api.Tests/IntegrationTestFactory.cs`, add JWT service mock. Inside the `builder.ConfigureServices` block, add:

```csharp
// JWT service for auth tests
services.Configure<JwtOptions>(options =>
{
    options.SecretKey = "test-secret-key-that-is-at-least-32-characters-long";
    options.Issuer = "TestIssuer";
    options.Audience = "TestAudience";
    options.ExpirationMinutes = 60;
});
services.AddSingleton<IJwtTokenService, JwtTokenService>();
```

Add the using:
```csharp
using QueueDrop.Api.Auth;
```

Also need to add Users DbSet to TestAppDbContext:
```csharp
public DbSet<User> Users => Set<User>();
```

**Step 7: Run test to verify it passes**

Run: `dotnet test src/QueueDrop.Api.Tests --filter "FullyQualifiedName~VerifyMagicLinkTests" --verbosity minimal`
Expected: All 4 tests pass

**Step 8: Commit**

```bash
git add src/QueueDrop.Api/Features/Auth/VerifyMagicLink.cs src/QueueDrop.Api/Program.cs src/QueueDrop.Api/appsettings.json src/QueueDrop.Api.Tests/VerifyMagicLinkTests.cs src/QueueDrop.Api.Tests/IntegrationTestFactory.cs src/QueueDrop.Api.Tests/TestAppDbContext.cs
git commit -m "Add verify magic link endpoint with JWT generation"
```

---

## Task 9: Get Current User Endpoint

**Files:**
- Create: `src/QueueDrop.Api/Features/Auth/GetMe.cs`
- Test: `src/QueueDrop.Api.Tests/GetMeTests.cs`

**Step 1: Configure JWT Bearer authentication in Program.cs**

In `src/QueueDrop.Api/Program.cs`, add after JWT configuration:

```csharp
// JWT Bearer Authentication
builder.Services.AddAuthentication("Bearer")
    .AddJwtBearer("Bearer", options =>
    {
        var jwtOptions = builder.Configuration.GetSection(JwtOptions.SectionName).Get<JwtOptions>()!;
        options.TokenValidationParameters = new Microsoft.IdentityModel.Tokens.TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtOptions.Issuer,
            ValidAudience = jwtOptions.Audience,
            IssuerSigningKey = new Microsoft.IdentityModel.Tokens.SymmetricSecurityKey(
                System.Text.Encoding.UTF8.GetBytes(jwtOptions.SecretKey))
        };
    });
builder.Services.AddAuthorization();
```

And after `app.UseCors("Frontend");`:
```csharp
app.UseAuthentication();
app.UseAuthorization();
```

**Step 2: Write failing test**

Create `src/QueueDrop.Api.Tests/GetMeTests.cs`:

```csharp
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using QueueDrop.Api.Auth;
using QueueDrop.Api.Tests;

namespace QueueDrop.Api.Tests;

public class GetMeTests : IntegrationTestBase
{
    [Fact]
    public async Task GetMe_WithValidToken_ShouldReturnUserInfo()
    {
        // Arrange - create user via magic link flow
        var email = "authuser@example.com";
        await Client.PostAsJsonAsync("/api/auth/send-magic-link", new { email });

        await using var scope = ServiceProvider.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<TestAppDbContext>();
        var magicLink = db.MagicLinks.First(l => l.Email == email);

        var verifyResponse = await Client.GetFromJsonAsync<VerifyResponse>($"/api/auth/verify?token={magicLink.Token}");

        // Act
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", verifyResponse!.Token);
        var response = await Client.GetAsync("/api/auth/me");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var result = await response.Content.ReadFromJsonAsync<MeResponse>();
        result.Should().NotBeNull();
        result!.Email.Should().Be(email);
        result.UserId.Should().Be(verifyResponse.UserId);
    }

    [Fact]
    public async Task GetMe_WithoutToken_ShouldReturn401()
    {
        // Act
        Client.DefaultRequestHeaders.Authorization = null;
        var response = await Client.GetAsync("/api/auth/me");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetMe_WithInvalidToken_ShouldReturn401()
    {
        // Act
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", "invalid-token");
        var response = await Client.GetAsync("/api/auth/me");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    private record VerifyResponse(string Token, Guid UserId, string Email, bool IsNewUser);
    private record MeResponse(Guid UserId, string Email, BusinessInfo? Business);
    private record BusinessInfo(Guid Id, string Name, string Slug, string Role);
}
```

**Step 3: Run test to verify it fails**

Run: `dotnet test src/QueueDrop.Api.Tests --filter "FullyQualifiedName~GetMeTests" --verbosity minimal`
Expected: 404 Not Found (endpoint doesn't exist)

**Step 4: Write implementation**

Create `src/QueueDrop.Api/Features/Auth/GetMe.cs`:

```csharp
using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QueueDrop.Infrastructure.Persistence;

namespace QueueDrop.Api.Features.Auth;

/// <summary>
/// Vertical slice: Get current authenticated user info.
/// GET /api/auth/me
/// </summary>
public static class GetMe
{
    public sealed record BusinessInfo(Guid Id, string Name, string Slug, string Role);
    public sealed record Response(Guid UserId, string Email, BusinessInfo? Business);

    public static void MapEndpoint(IEndpointRouteBuilder app)
    {
        app.MapGet("/api/auth/me", Handler)
            .WithName("GetMe")
            .WithTags("Auth")
            .RequireAuthorization()
            .Produces<Response>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status401Unauthorized);
    }

    private static async Task<IResult> Handler(
        ClaimsPrincipal user,
        AppDbContext db,
        CancellationToken cancellationToken)
    {
        var userIdClaim = user.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userIdClaim is null || !Guid.TryParse(userIdClaim, out var userId))
        {
            return Results.Unauthorized();
        }

        var dbUser = await db.Users
            .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);

        if (dbUser is null)
        {
            return Results.Unauthorized();
        }

        // Get user's business membership (if any)
        var membership = await db.BusinessMembers
            .Include(bm => bm.Business)
            .FirstOrDefaultAsync(bm => bm.UserId == userId && bm.JoinedAt != null, cancellationToken);

        BusinessInfo? businessInfo = null;
        if (membership is not null)
        {
            businessInfo = new BusinessInfo(
                membership.Business.Id,
                membership.Business.Name,
                membership.Business.Slug,
                membership.Role.ToString());
        }

        return Results.Ok(new Response(dbUser.Id, dbUser.Email, businessInfo));
    }
}
```

**Step 5: Register endpoint in Program.cs**

Add after VerifyMagicLink.MapEndpoint:
```csharp
GetMe.MapEndpoint(app);
```

**Step 6: Update TestAppDbContext**

Add BusinessMembers DbSet:
```csharp
public DbSet<BusinessMember> BusinessMembers => Set<BusinessMember>();
```

**Step 7: Run test to verify it passes**

Run: `dotnet test src/QueueDrop.Api.Tests --filter "FullyQualifiedName~GetMeTests" --verbosity minimal`
Expected: All 3 tests pass

**Step 8: Commit**

```bash
git add src/QueueDrop.Api/Features/Auth/GetMe.cs src/QueueDrop.Api/Program.cs src/QueueDrop.Api.Tests/GetMeTests.cs src/QueueDrop.Api.Tests/TestAppDbContext.cs
git commit -m "Add authenticated /me endpoint"
```

---

## Task 10: Create Business Endpoint

**Files:**
- Create: `src/QueueDrop.Api/Features/Business/CreateBusiness.cs`
- Test: `src/QueueDrop.Api.Tests/CreateBusinessTests.cs`

**Step 1: Write failing test**

Create `src/QueueDrop.Api.Tests/CreateBusinessTests.cs`:

```csharp
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using QueueDrop.Api.Tests;
using QueueDrop.Domain.Enums;

namespace QueueDrop.Api.Tests;

public class CreateBusinessTests : IntegrationTestBase
{
    [Fact]
    public async Task CreateBusiness_WithValidData_ShouldReturn201()
    {
        // Arrange
        var token = await GetAuthToken("owner@example.com");
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        // Act
        var response = await Client.PostAsJsonAsync("/api/business", new
        {
            name = "My Coffee Shop",
            slug = "my-coffee-shop"
        });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);

        var result = await response.Content.ReadFromJsonAsync<CreateBusinessResponse>();
        result.Should().NotBeNull();
        result!.Name.Should().Be("My Coffee Shop");
        result.Slug.Should().Be("my-coffee-shop");
    }

    [Fact]
    public async Task CreateBusiness_ShouldMakeUserOwner()
    {
        // Arrange
        var email = "newowner@example.com";
        var token = await GetAuthToken(email);
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        // Act
        await Client.PostAsJsonAsync("/api/business", new { name = "Test Shop", slug = "test-shop" });

        // Assert
        await using var scope = ServiceProvider.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<TestAppDbContext>();
        var user = db.Users.First(u => u.Email == email);
        var membership = db.BusinessMembers.First(bm => bm.UserId == user.Id);

        membership.Role.Should().Be(BusinessRole.Owner);
        membership.JoinedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task CreateBusiness_WithDuplicateSlug_ShouldReturn409()
    {
        // Arrange - create first business
        var token = await GetAuthToken("first@example.com");
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        await Client.PostAsJsonAsync("/api/business", new { name = "First Shop", slug = "unique-slug" });

        // Create second user and try same slug
        var token2 = await GetAuthToken("second@example.com");
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token2);

        // Act
        var response = await Client.PostAsJsonAsync("/api/business", new { name = "Second Shop", slug = "unique-slug" });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task CreateBusiness_WithoutAuth_ShouldReturn401()
    {
        // Act
        Client.DefaultRequestHeaders.Authorization = null;
        var response = await Client.PostAsJsonAsync("/api/business", new { name = "Shop", slug = "shop" });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    private async Task<string> GetAuthToken(string email)
    {
        await Client.PostAsJsonAsync("/api/auth/send-magic-link", new { email });

        await using var scope = ServiceProvider.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<TestAppDbContext>();
        var magicLink = db.MagicLinks.OrderByDescending(l => l.CreatedAt).First(l => l.Email == email);

        var verifyResponse = await Client.GetFromJsonAsync<VerifyResponse>($"/api/auth/verify?token={magicLink.Token}");
        return verifyResponse!.Token;
    }

    private record VerifyResponse(string Token, Guid UserId, string Email, bool IsNewUser);
    private record CreateBusinessResponse(Guid Id, string Name, string Slug);
}
```

**Step 2: Run test to verify it fails**

Run: `dotnet test src/QueueDrop.Api.Tests --filter "FullyQualifiedName~CreateBusinessTests" --verbosity minimal`
Expected: 404 Not Found (endpoint doesn't exist)

**Step 3: Write implementation**

Create `src/QueueDrop.Api/Features/Business/CreateBusiness.cs`:

```csharp
using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QueueDrop.Domain.Entities;
using QueueDrop.Infrastructure.Persistence;

namespace QueueDrop.Api.Features.Business;

/// <summary>
/// Vertical slice: Create a new business.
/// POST /api/business
/// </summary>
public static class CreateBusiness
{
    public sealed record Request(string Name, string? Slug);
    public sealed record Response(Guid Id, string Name, string Slug);

    public static void MapEndpoint(IEndpointRouteBuilder app)
    {
        app.MapPost("/api/business", Handler)
            .WithName("CreateBusiness")
            .WithTags("Business")
            .RequireAuthorization()
            .Produces<Response>(StatusCodes.Status201Created)
            .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
            .Produces<ProblemDetails>(StatusCodes.Status409Conflict);
    }

    private static async Task<IResult> Handler(
        Request request,
        ClaimsPrincipal user,
        AppDbContext db,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        var userIdClaim = user.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
        {
            return Results.Unauthorized();
        }

        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return Results.Problem(
                title: "Invalid name",
                detail: "Business name is required.",
                statusCode: StatusCodes.Status400BadRequest);
        }

        // Generate slug from name if not provided
        var slug = string.IsNullOrWhiteSpace(request.Slug)
            ? GenerateSlug(request.Name)
            : GenerateSlug(request.Slug);

        // Check for duplicate slug
        var existingBusiness = await db.Businesses
            .FirstOrDefaultAsync(b => b.Slug == slug, cancellationToken);

        if (existingBusiness is not null)
        {
            return Results.Problem(
                title: "Slug already taken",
                detail: $"A business with slug '{slug}' already exists.",
                statusCode: StatusCodes.Status409Conflict);
        }

        var now = timeProvider.GetUtcNow();
        var business = Domain.Entities.Business.Create(request.Name, slug, now);

        db.Businesses.Add(business);

        // Make the current user the owner
        var membership = BusinessMember.CreateOwner(userId, business.Id, now);
        db.BusinessMembers.Add(membership);

        await db.SaveChangesAsync(cancellationToken);

        return Results.Created(
            $"/api/business/{business.Slug}",
            new Response(business.Id, business.Name, business.Slug));
    }

    private static string GenerateSlug(string input)
    {
        return input
            .ToLowerInvariant()
            .Trim()
            .Replace(" ", "-")
            .Replace("'", "")
            .Replace("\"", "");
    }
}
```

**Step 4: Register endpoint in Program.cs**

Add the using:
```csharp
using QueueDrop.Api.Features.Business;
```

Add after auth endpoints:
```csharp
// Business endpoints
CreateBusiness.MapEndpoint(app);
```

**Step 5: Run test to verify it passes**

Run: `dotnet test src/QueueDrop.Api.Tests --filter "FullyQualifiedName~CreateBusinessTests" --verbosity minimal`
Expected: All 4 tests pass

**Step 6: Commit**

```bash
git add src/QueueDrop.Api/Features/Business/CreateBusiness.cs src/QueueDrop.Api/Program.cs src/QueueDrop.Api.Tests/CreateBusinessTests.cs
git commit -m "Add create business endpoint with owner assignment"
```

---

## Task 11: Run All Tests and Final Verification

**Step 1: Run full test suite**

Run: `dotnet test src/QueueDrop.sln --verbosity minimal`
Expected: All tests pass (existing 121 + new auth tests)

**Step 2: Verify migration applies cleanly**

Run:
```bash
cd src/QueueDrop.Api
dotnet ef database update --project ../QueueDrop.Infrastructure
```

Expected: Migration applies successfully

**Step 3: Manual smoke test (optional)**

```bash
# Start the API
cd src/QueueDrop.Api && dotnet run

# In another terminal, test the flow:
# 1. Send magic link
curl -X POST http://localhost:5000/api/auth/send-magic-link \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# 2. Check API logs for magic link token, then verify
curl "http://localhost:5000/api/auth/verify?token=<token-from-logs>"

# 3. Use returned JWT to create business
curl -X POST http://localhost:5000/api/business \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <jwt-token>" \
  -d '{"name":"My Shop","slug":"my-shop"}'

# 4. Check /me
curl http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer <jwt-token>"
```

**Step 4: Final commit**

```bash
git add -A
git commit -m "Complete auth foundation phase 1"
```

---

## Summary

This plan implements:
1. **User entity** - email validation, normalization
2. **BusinessMember entity** - links users to businesses with roles
3. **MagicLink entity** - secure one-time tokens for passwordless auth
4. **EF Core configurations** - proper indexes and relationships
5. **Database migration** - new tables
6. **JWT token service** - generates tokens for authenticated sessions
7. **Send magic link endpoint** - creates login links (logs to console for now)
8. **Verify magic link endpoint** - validates token, creates user if needed, returns JWT
9. **Get me endpoint** - returns current user info (protected)
10. **Create business endpoint** - creates business with user as owner (protected)

**What's NOT in this phase:**
- Email sending (magic links logged to console)
- Staff invites
- Queue CRUD
- Frontend auth pages

These will be covered in subsequent phases.
