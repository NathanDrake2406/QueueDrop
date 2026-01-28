# Queue Management & Staff Invites Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add queue CRUD endpoints for owners and staff invite system so businesses can manage their queues and team.

**Architecture:** Owner-only endpoints for queue management and staff invites. Authorization checks via BusinessMember lookup. Staff invites use existing MagicLink with type=Invite.

**Tech Stack:** .NET 8, EF Core, JWT auth, existing vertical slice patterns.

---

## Task 1: Authorization Helper Service

**Files:**
- Create: `src/QueueDrop.Api/Auth/BusinessAuthorizationService.cs`
- Test: `src/QueueDrop.Api.Tests/BusinessAuthorizationServiceTests.cs`

**Step 1: Write the failing test**

Create `src/QueueDrop.Api.Tests/BusinessAuthorizationServiceTests.cs`:

```csharp
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using QueueDrop.Api.Auth;
using QueueDrop.Domain.Entities;
using QueueDrop.Domain.Enums;

namespace QueueDrop.Api.Tests;

public class BusinessAuthorizationServiceTests : IntegrationTestBase
{
    [Fact]
    public async Task GetMembership_WhenUserIsOwner_ShouldReturnOwnerMembership()
    {
        // Arrange
        var (userId, businessSlug) = await CreateUserWithBusiness("owner@test.com", "test-biz");

        await using var scope = ServiceProvider.CreateAsyncScope();
        var service = scope.ServiceProvider.GetRequiredService<IBusinessAuthorizationService>();

        // Act
        var result = await service.GetMembershipAsync(userId, businessSlug, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result!.Role.Should().Be(BusinessRole.Owner);
    }

    [Fact]
    public async Task GetMembership_WhenUserIsNotMember_ShouldReturnNull()
    {
        // Arrange
        await CreateUserWithBusiness("owner@test.com", "test-biz");
        var otherUserId = await CreateUser("other@test.com");

        await using var scope = ServiceProvider.CreateAsyncScope();
        var service = scope.ServiceProvider.GetRequiredService<IBusinessAuthorizationService>();

        // Act
        var result = await service.GetMembershipAsync(otherUserId, "test-biz", CancellationToken.None);

        // Assert
        result.Should().BeNull();
    }

    [Fact]
    public async Task IsOwner_WhenUserIsOwner_ShouldReturnTrue()
    {
        // Arrange
        var (userId, businessSlug) = await CreateUserWithBusiness("owner@test.com", "my-shop");

        await using var scope = ServiceProvider.CreateAsyncScope();
        var service = scope.ServiceProvider.GetRequiredService<IBusinessAuthorizationService>();

        // Act
        var result = await service.IsOwnerAsync(userId, businessSlug, CancellationToken.None);

        // Assert
        result.Should().BeTrue();
    }

    [Fact]
    public async Task IsOwner_WhenUserIsStaff_ShouldReturnFalse()
    {
        // Arrange
        var (_, businessSlug) = await CreateUserWithBusiness("owner@test.com", "my-shop");
        var staffUserId = await CreateStaffMember("staff@test.com", businessSlug);

        await using var scope = ServiceProvider.CreateAsyncScope();
        var service = scope.ServiceProvider.GetRequiredService<IBusinessAuthorizationService>();

        // Act
        var result = await service.IsOwnerAsync(staffUserId, businessSlug, CancellationToken.None);

        // Assert
        result.Should().BeFalse();
    }

    private async Task<(Guid UserId, string BusinessSlug)> CreateUserWithBusiness(string email, string slug)
    {
        var token = await GetAuthToken(email);
        Client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
        await Client.PostAsJsonAsync("/api/business", new { name = slug, slug });

        await using var scope = ServiceProvider.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<TestAppDbContext>();
        var user = await db.Users.FirstAsync(u => u.Email == email);
        return (user.Id, slug);
    }

    private async Task<Guid> CreateUser(string email)
    {
        await GetAuthToken(email);
        await using var scope = ServiceProvider.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<TestAppDbContext>();
        var user = await db.Users.FirstAsync(u => u.Email == email);
        return user.Id;
    }

    private async Task<Guid> CreateStaffMember(string email, string businessSlug)
    {
        var userId = await CreateUser(email);

        await using var scope = ServiceProvider.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<TestAppDbContext>();
        var business = await db.Businesses.FirstAsync(b => b.Slug == businessSlug);

        var membership = BusinessMember.CreateStaffInvite(userId, business.Id, DateTimeOffset.UtcNow);
        membership.AcceptInvite(DateTimeOffset.UtcNow);
        db.BusinessMembers.Add(membership);
        await db.SaveChangesAsync();

        return userId;
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
}
```

**Step 2:** Run test to verify it fails

**Step 3: Write implementation**

Create `src/QueueDrop.Api/Auth/BusinessAuthorizationService.cs`:

```csharp
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

    public async Task<BusinessMember?> GetMembershipAsync(Guid userId, string businessSlug, CancellationToken cancellationToken)
    {
        return await _db.BusinessMembers
            .Include(bm => bm.Business)
            .FirstOrDefaultAsync(bm =>
                bm.UserId == userId &&
                bm.Business.Slug == businessSlug.ToLowerInvariant() &&
                bm.JoinedAt != null,
                cancellationToken);
    }

    public async Task<bool> IsOwnerAsync(Guid userId, string businessSlug, CancellationToken cancellationToken)
    {
        var membership = await GetMembershipAsync(userId, businessSlug, cancellationToken);
        return membership?.Role == BusinessRole.Owner;
    }

    public async Task<bool> IsMemberAsync(Guid userId, string businessSlug, CancellationToken cancellationToken)
    {
        var membership = await GetMembershipAsync(userId, businessSlug, cancellationToken);
        return membership != null;
    }
}
```

**Step 4: Register service in Program.cs**

Add after JWT configuration:
```csharp
builder.Services.AddScoped<IBusinessAuthorizationService, BusinessAuthorizationService>();
```

**Step 5:** Run tests, commit

```bash
git add src/QueueDrop.Api/Auth/BusinessAuthorizationService.cs src/QueueDrop.Api/Program.cs src/QueueDrop.Api.Tests/BusinessAuthorizationServiceTests.cs
git commit -m "Add business authorization service"
```

---

## Task 2: Create Queue Endpoint

**Files:**
- Create: `src/QueueDrop.Api/Features/Queues/CreateQueue.cs`
- Test: `src/QueueDrop.Api.Tests/CreateQueueTests.cs`

**Step 1: Write the failing test**

Create `src/QueueDrop.Api.Tests/CreateQueueTests.cs`:

```csharp
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;

namespace QueueDrop.Api.Tests;

public class CreateQueueTests : IntegrationTestBase
{
    [Fact]
    public async Task CreateQueue_AsOwner_ShouldReturn201()
    {
        // Arrange
        var (token, businessSlug) = await SetupOwnerWithBusiness("owner@test.com", "my-shop");
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        // Act
        var response = await Client.PostAsJsonAsync($"/api/business/{businessSlug}/queues", new
        {
            name = "Main Queue",
            slug = "main-queue"
        });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var result = await response.Content.ReadFromJsonAsync<CreateQueueResponse>();
        result!.Name.Should().Be("Main Queue");
        result.Slug.Should().Be("main-queue");
    }

    [Fact]
    public async Task CreateQueue_WithAdvancedSettings_ShouldSaveSettings()
    {
        // Arrange
        var (token, businessSlug) = await SetupOwnerWithBusiness("owner@test.com", "my-shop");
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        // Act
        var response = await Client.PostAsJsonAsync($"/api/business/{businessSlug}/queues", new
        {
            name = "VIP Queue",
            slug = "vip",
            maxQueueSize = 20,
            estimatedServiceTimeMinutes = 10
        });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);

        await using var scope = ServiceProvider.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<TestAppDbContext>();
        var queue = db.Queues.First(q => q.Slug == "vip");
        queue.Settings.MaxQueueSize.Should().Be(20);
        queue.Settings.EstimatedServiceTimeMinutes.Should().Be(10);
    }

    [Fact]
    public async Task CreateQueue_AsNonOwner_ShouldReturn403()
    {
        // Arrange
        var (_, businessSlug) = await SetupOwnerWithBusiness("owner@test.com", "my-shop");
        var staffToken = await GetAuthToken("staff@test.com");
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", staffToken);

        // Act
        var response = await Client.PostAsJsonAsync($"/api/business/{businessSlug}/queues", new
        {
            name = "New Queue"
        });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task CreateQueue_WithDuplicateSlug_ShouldReturn409()
    {
        // Arrange
        var (token, businessSlug) = await SetupOwnerWithBusiness("owner@test.com", "my-shop");
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        await Client.PostAsJsonAsync($"/api/business/{businessSlug}/queues", new { name = "First", slug = "same-slug" });

        // Act
        var response = await Client.PostAsJsonAsync($"/api/business/{businessSlug}/queues", new { name = "Second", slug = "same-slug" });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    private async Task<(string Token, string BusinessSlug)> SetupOwnerWithBusiness(string email, string slug)
    {
        var token = await GetAuthToken(email);
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        await Client.PostAsJsonAsync("/api/business", new { name = slug, slug });
        return (token, slug);
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
    private record CreateQueueResponse(Guid Id, string Name, string Slug);
}
```

**Step 2: Write implementation**

Create `src/QueueDrop.Api/Features/Queues/CreateQueue.cs`:

```csharp
using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QueueDrop.Api.Auth;
using QueueDrop.Domain.Entities;
using QueueDrop.Infrastructure.Persistence;

namespace QueueDrop.Api.Features.Queues;

public static class CreateQueue
{
    public sealed record Request(
        string Name,
        string? Slug,
        int? MaxQueueSize = null,
        int? EstimatedServiceTimeMinutes = null,
        string? WelcomeMessage = null);

    public sealed record Response(Guid Id, string Name, string Slug);

    public static void MapEndpoint(IEndpointRouteBuilder app)
    {
        app.MapPost("/api/business/{businessSlug}/queues", Handler)
            .WithName("CreateQueue")
            .WithTags("Queues")
            .RequireAuthorization()
            .Produces<Response>(StatusCodes.Status201Created)
            .Produces<ProblemDetails>(StatusCodes.Status403Forbidden)
            .Produces<ProblemDetails>(StatusCodes.Status409Conflict);
    }

    private static async Task<IResult> Handler(
        string businessSlug,
        Request request,
        ClaimsPrincipal user,
        AppDbContext db,
        IBusinessAuthorizationService authService,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        var userIdClaim = user.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
            return Results.Unauthorized();

        // Check owner permission
        if (!await authService.IsOwnerAsync(userId, businessSlug, cancellationToken))
        {
            return Results.Problem(
                title: "Forbidden",
                detail: "Only business owners can create queues.",
                statusCode: StatusCodes.Status403Forbidden);
        }

        var business = await db.Businesses
            .Include(b => b.Queues)
            .FirstOrDefaultAsync(b => b.Slug == businessSlug.ToLowerInvariant(), cancellationToken);

        if (business is null)
            return Results.NotFound();

        // Generate slug from name if not provided
        var slug = string.IsNullOrWhiteSpace(request.Slug)
            ? GenerateSlug(request.Name)
            : GenerateSlug(request.Slug);

        // Check for duplicate slug within business
        if (business.Queues.Any(q => q.Slug == slug))
        {
            return Results.Problem(
                title: "Slug already exists",
                detail: $"A queue with slug '{slug}' already exists in this business.",
                statusCode: StatusCodes.Status409Conflict);
        }

        var now = timeProvider.GetUtcNow();
        var queue = Queue.Create(business.Id, request.Name, slug, now);

        // Apply optional settings
        if (request.MaxQueueSize.HasValue)
            queue.Settings.UpdateMaxQueueSize(request.MaxQueueSize.Value);
        if (request.EstimatedServiceTimeMinutes.HasValue)
            queue.Settings.UpdateEstimatedServiceTime(request.EstimatedServiceTimeMinutes.Value);
        if (!string.IsNullOrWhiteSpace(request.WelcomeMessage))
            queue.Settings.UpdateWelcomeMessage(request.WelcomeMessage);

        db.Queues.Add(queue);
        await db.SaveChangesAsync(cancellationToken);

        return Results.Created(
            $"/api/business/{businessSlug}/queues/{queue.Slug}",
            new Response(queue.Id, queue.Name, queue.Slug));
    }

    private static string GenerateSlug(string input) => input
        .ToLowerInvariant()
        .Trim()
        .Replace(" ", "-")
        .Replace("'", "")
        .Replace("\"", "");
}
```

**Step 3: Register endpoint in Program.cs**

After CreateBusiness.MapEndpoint:
```csharp
CreateQueue.MapEndpoint(app);
```

**Step 4:** Run tests, commit

```bash
git add src/QueueDrop.Api/Features/Queues/CreateQueue.cs src/QueueDrop.Api/Program.cs src/QueueDrop.Api.Tests/CreateQueueTests.cs
git commit -m "Add create queue endpoint (owner only)"
```

---

## Task 3: Update Queue Endpoint

**Files:**
- Create: `src/QueueDrop.Api/Features/Queues/UpdateQueue.cs`
- Test: `src/QueueDrop.Api.Tests/UpdateQueueTests.cs`

**Step 1: Write the failing test**

Create `src/QueueDrop.Api.Tests/UpdateQueueTests.cs`:

```csharp
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;

namespace QueueDrop.Api.Tests;

public class UpdateQueueTests : IntegrationTestBase
{
    [Fact]
    public async Task UpdateQueue_AsOwner_ShouldReturn200()
    {
        // Arrange
        var (token, businessSlug, queueSlug) = await SetupOwnerWithQueue("owner@test.com", "my-shop", "main");
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        // Act
        var response = await Client.PutAsJsonAsync($"/api/business/{businessSlug}/queues/{queueSlug}", new
        {
            name = "Updated Queue Name",
            maxQueueSize = 50
        });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        await using var scope = ServiceProvider.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<TestAppDbContext>();
        var queue = db.Queues.First(q => q.Slug == queueSlug);
        queue.Name.Should().Be("Updated Queue Name");
        queue.Settings.MaxQueueSize.Should().Be(50);
    }

    [Fact]
    public async Task UpdateQueue_AsNonOwner_ShouldReturn403()
    {
        // Arrange
        var (_, businessSlug, queueSlug) = await SetupOwnerWithQueue("owner@test.com", "my-shop", "main");
        var staffToken = await GetAuthToken("other@test.com");
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", staffToken);

        // Act
        var response = await Client.PutAsJsonAsync($"/api/business/{businessSlug}/queues/{queueSlug}", new
        {
            name = "Hacked Name"
        });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    private async Task<(string Token, string BusinessSlug, string QueueSlug)> SetupOwnerWithQueue(string email, string bizSlug, string queueSlug)
    {
        var token = await GetAuthToken(email);
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        await Client.PostAsJsonAsync("/api/business", new { name = bizSlug, slug = bizSlug });
        await Client.PostAsJsonAsync($"/api/business/{bizSlug}/queues", new { name = queueSlug, slug = queueSlug });
        return (token, bizSlug, queueSlug);
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
}
```

**Step 2: Write implementation**

Create `src/QueueDrop.Api/Features/Queues/UpdateQueue.cs`:

```csharp
using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QueueDrop.Api.Auth;
using QueueDrop.Infrastructure.Persistence;

namespace QueueDrop.Api.Features.Queues;

public static class UpdateQueue
{
    public sealed record Request(
        string? Name,
        int? MaxQueueSize,
        int? EstimatedServiceTimeMinutes,
        string? WelcomeMessage,
        string? CalledMessage);

    public static void MapEndpoint(IEndpointRouteBuilder app)
    {
        app.MapPut("/api/business/{businessSlug}/queues/{queueSlug}", Handler)
            .WithName("UpdateQueue")
            .WithTags("Queues")
            .RequireAuthorization()
            .Produces(StatusCodes.Status200OK)
            .Produces<ProblemDetails>(StatusCodes.Status403Forbidden)
            .Produces<ProblemDetails>(StatusCodes.Status404NotFound);
    }

    private static async Task<IResult> Handler(
        string businessSlug,
        string queueSlug,
        Request request,
        ClaimsPrincipal user,
        AppDbContext db,
        IBusinessAuthorizationService authService,
        CancellationToken cancellationToken)
    {
        var userIdClaim = user.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
            return Results.Unauthorized();

        if (!await authService.IsOwnerAsync(userId, businessSlug, cancellationToken))
        {
            return Results.Problem(
                title: "Forbidden",
                detail: "Only business owners can update queues.",
                statusCode: StatusCodes.Status403Forbidden);
        }

        var queue = await db.Queues
            .Include(q => q.Business)
            .FirstOrDefaultAsync(q =>
                q.Business.Slug == businessSlug.ToLowerInvariant() &&
                q.Slug == queueSlug.ToLowerInvariant(),
                cancellationToken);

        if (queue is null)
            return Results.NotFound();

        // Update name if provided
        if (!string.IsNullOrWhiteSpace(request.Name))
            queue.UpdateName(request.Name);

        // Update settings
        if (request.MaxQueueSize.HasValue)
            queue.Settings.UpdateMaxQueueSize(request.MaxQueueSize.Value);
        if (request.EstimatedServiceTimeMinutes.HasValue)
            queue.Settings.UpdateEstimatedServiceTime(request.EstimatedServiceTimeMinutes.Value);
        if (request.WelcomeMessage is not null)
            queue.Settings.UpdateWelcomeMessage(request.WelcomeMessage);
        if (request.CalledMessage is not null)
            queue.Settings.UpdateCalledMessage(request.CalledMessage);

        await db.SaveChangesAsync(cancellationToken);

        return Results.Ok(new { queue.Id, queue.Name, queue.Slug });
    }
}
```

**Step 3:** Add `UpdateName` method to Queue entity if not exists.

In `src/QueueDrop.Domain/Entities/Queue.cs`, add:
```csharp
public void UpdateName(string name)
{
    if (string.IsNullOrWhiteSpace(name))
        throw new ArgumentException("Queue name is required", nameof(name));
    Name = name;
}
```

**Step 4: Register endpoint, run tests, commit**

```bash
git add src/QueueDrop.Api/Features/Queues/UpdateQueue.cs src/QueueDrop.Api/Program.cs src/QueueDrop.Api.Tests/UpdateQueueTests.cs src/QueueDrop.Domain/Entities/Queue.cs
git commit -m "Add update queue endpoint (owner only)"
```

---

## Task 4: Delete Queue Endpoint

**Files:**
- Create: `src/QueueDrop.Api/Features/Queues/DeleteQueue.cs`
- Test: `src/QueueDrop.Api.Tests/DeleteQueueTests.cs`

**Step 1: Write the failing test**

Create `src/QueueDrop.Api.Tests/DeleteQueueTests.cs`:

```csharp
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;

namespace QueueDrop.Api.Tests;

public class DeleteQueueTests : IntegrationTestBase
{
    [Fact]
    public async Task DeleteQueue_AsOwner_ShouldReturn204()
    {
        // Arrange
        var (token, businessSlug, queueSlug) = await SetupOwnerWithQueue("owner@test.com", "my-shop", "to-delete");
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        // Act
        var response = await Client.DeleteAsync($"/api/business/{businessSlug}/queues/{queueSlug}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);

        await using var scope = ServiceProvider.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<TestAppDbContext>();
        db.Queues.Any(q => q.Slug == queueSlug).Should().BeFalse();
    }

    [Fact]
    public async Task DeleteQueue_AsNonOwner_ShouldReturn403()
    {
        // Arrange
        var (_, businessSlug, queueSlug) = await SetupOwnerWithQueue("owner@test.com", "my-shop", "main");
        var otherToken = await GetAuthToken("other@test.com");
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", otherToken);

        // Act
        var response = await Client.DeleteAsync($"/api/business/{businessSlug}/queues/{queueSlug}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    private async Task<(string Token, string BusinessSlug, string QueueSlug)> SetupOwnerWithQueue(string email, string bizSlug, string queueSlug)
    {
        var token = await GetAuthToken(email);
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        await Client.PostAsJsonAsync("/api/business", new { name = bizSlug, slug = bizSlug });
        await Client.PostAsJsonAsync($"/api/business/{bizSlug}/queues", new { name = queueSlug, slug = queueSlug });
        return (token, bizSlug, queueSlug);
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
}
```

**Step 2: Write implementation**

Create `src/QueueDrop.Api/Features/Queues/DeleteQueue.cs`:

```csharp
using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QueueDrop.Api.Auth;
using QueueDrop.Infrastructure.Persistence;

namespace QueueDrop.Api.Features.Queues;

public static class DeleteQueue
{
    public static void MapEndpoint(IEndpointRouteBuilder app)
    {
        app.MapDelete("/api/business/{businessSlug}/queues/{queueSlug}", Handler)
            .WithName("DeleteQueue")
            .WithTags("Queues")
            .RequireAuthorization()
            .Produces(StatusCodes.Status204NoContent)
            .Produces<ProblemDetails>(StatusCodes.Status403Forbidden)
            .Produces<ProblemDetails>(StatusCodes.Status404NotFound);
    }

    private static async Task<IResult> Handler(
        string businessSlug,
        string queueSlug,
        ClaimsPrincipal user,
        AppDbContext db,
        IBusinessAuthorizationService authService,
        CancellationToken cancellationToken)
    {
        var userIdClaim = user.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
            return Results.Unauthorized();

        if (!await authService.IsOwnerAsync(userId, businessSlug, cancellationToken))
        {
            return Results.Problem(
                title: "Forbidden",
                detail: "Only business owners can delete queues.",
                statusCode: StatusCodes.Status403Forbidden);
        }

        var queue = await db.Queues
            .Include(q => q.Business)
            .FirstOrDefaultAsync(q =>
                q.Business.Slug == businessSlug.ToLowerInvariant() &&
                q.Slug == queueSlug.ToLowerInvariant(),
                cancellationToken);

        if (queue is null)
            return Results.NotFound();

        db.Queues.Remove(queue);
        await db.SaveChangesAsync(cancellationToken);

        return Results.NoContent();
    }
}
```

**Step 3: Register endpoint, run tests, commit**

```bash
git add src/QueueDrop.Api/Features/Queues/DeleteQueue.cs src/QueueDrop.Api/Program.cs src/QueueDrop.Api.Tests/DeleteQueueTests.cs
git commit -m "Add delete queue endpoint (owner only)"
```

---

## Task 5: Staff Invite Endpoint

**Files:**
- Create: `src/QueueDrop.Api/Features/Staff/InviteStaff.cs`
- Test: `src/QueueDrop.Api.Tests/InviteStaffTests.cs`

**Step 1: Write the failing test**

Create `src/QueueDrop.Api.Tests/InviteStaffTests.cs`:

```csharp
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using QueueDrop.Domain.Enums;

namespace QueueDrop.Api.Tests;

public class InviteStaffTests : IntegrationTestBase
{
    [Fact]
    public async Task InviteStaff_AsOwner_ShouldReturn201()
    {
        // Arrange
        var (token, businessSlug) = await SetupOwnerWithBusiness("owner@test.com", "my-shop");
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        // Act
        var response = await Client.PostAsJsonAsync($"/api/business/{businessSlug}/staff/invite", new
        {
            email = "staff@test.com"
        });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
    }

    [Fact]
    public async Task InviteStaff_ShouldCreateMagicLinkWithInviteType()
    {
        // Arrange
        var (token, businessSlug) = await SetupOwnerWithBusiness("owner@test.com", "my-shop");
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        // Act
        await Client.PostAsJsonAsync($"/api/business/{businessSlug}/staff/invite", new
        {
            email = "newstaff@test.com"
        });

        // Assert
        await using var scope = ServiceProvider.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<TestAppDbContext>();
        var link = db.MagicLinks.First(l => l.Email == "newstaff@test.com");
        link.Type.Should().Be(MagicLinkType.Invite);
        link.BusinessId.Should().NotBeNull();
    }

    [Fact]
    public async Task InviteStaff_AsNonOwner_ShouldReturn403()
    {
        // Arrange
        var (_, businessSlug) = await SetupOwnerWithBusiness("owner@test.com", "my-shop");
        var otherToken = await GetAuthToken("other@test.com");
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", otherToken);

        // Act
        var response = await Client.PostAsJsonAsync($"/api/business/{businessSlug}/staff/invite", new
        {
            email = "staff@test.com"
        });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    private async Task<(string Token, string BusinessSlug)> SetupOwnerWithBusiness(string email, string slug)
    {
        var token = await GetAuthToken(email);
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        await Client.PostAsJsonAsync("/api/business", new { name = slug, slug });
        return (token, slug);
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
}
```

**Step 2: Write implementation**

Create `src/QueueDrop.Api/Features/Staff/InviteStaff.cs`:

```csharp
using System.Security.Claims;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QueueDrop.Api.Auth;
using QueueDrop.Domain.Entities;
using QueueDrop.Infrastructure.Persistence;

namespace QueueDrop.Api.Features.Staff;

public static partial class InviteStaff
{
    public sealed record Request(string Email);

    public static void MapEndpoint(IEndpointRouteBuilder app)
    {
        app.MapPost("/api/business/{businessSlug}/staff/invite", Handler)
            .WithName("InviteStaff")
            .WithTags("Staff")
            .RequireAuthorization()
            .Produces(StatusCodes.Status201Created)
            .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
            .Produces<ProblemDetails>(StatusCodes.Status403Forbidden);
    }

    private static async Task<IResult> Handler(
        string businessSlug,
        Request request,
        ClaimsPrincipal user,
        AppDbContext db,
        IBusinessAuthorizationService authService,
        TimeProvider timeProvider,
        ILogger<Program> logger,
        CancellationToken cancellationToken)
    {
        var userIdClaim = user.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
            return Results.Unauthorized();

        if (!await authService.IsOwnerAsync(userId, businessSlug, cancellationToken))
        {
            return Results.Problem(
                title: "Forbidden",
                detail: "Only business owners can invite staff.",
                statusCode: StatusCodes.Status403Forbidden);
        }

        if (string.IsNullOrWhiteSpace(request.Email) || !EmailRegex().IsMatch(request.Email))
        {
            return Results.Problem(
                title: "Invalid email",
                detail: "Please provide a valid email address.",
                statusCode: StatusCodes.Status400BadRequest);
        }

        var business = await db.Businesses
            .FirstOrDefaultAsync(b => b.Slug == businessSlug.ToLowerInvariant(), cancellationToken);

        if (business is null)
            return Results.NotFound();

        var now = timeProvider.GetUtcNow();
        var magicLink = MagicLink.CreateInviteLink(
            request.Email,
            business.Id,
            now,
            TimeSpan.FromDays(7)); // Invite links last 7 days

        db.MagicLinks.Add(magicLink);
        await db.SaveChangesAsync(cancellationToken);

        // TODO: Send email - for now, log to console
        var inviteUrl = $"/auth/verify?token={magicLink.Token}";
        logger.LogInformation("Staff invite created for {Email} to join {Business}: {Url}",
            request.Email, business.Name, inviteUrl);

        return Results.Created(inviteUrl, new { message = "Invite sent" });
    }

    [GeneratedRegex(@"^[^@\s]+@[^@\s]+\.[^@\s]+$", RegexOptions.Compiled)]
    private static partial Regex EmailRegex();
}
```

**Step 3: Register endpoint, run tests, commit**

```bash
git add src/QueueDrop.Api/Features/Staff/InviteStaff.cs src/QueueDrop.Api/Program.cs src/QueueDrop.Api.Tests/InviteStaffTests.cs
git commit -m "Add staff invite endpoint (owner only)"
```

---

## Task 6: Accept Staff Invite (Update VerifyMagicLink)

**Files:**
- Modify: `src/QueueDrop.Api/Features/Auth/VerifyMagicLink.cs`
- Test: `src/QueueDrop.Api.Tests/AcceptStaffInviteTests.cs`

**Step 1: Write the failing test**

Create `src/QueueDrop.Api.Tests/AcceptStaffInviteTests.cs`:

```csharp
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using QueueDrop.Domain.Enums;

namespace QueueDrop.Api.Tests;

public class AcceptStaffInviteTests : IntegrationTestBase
{
    [Fact]
    public async Task AcceptInvite_ShouldCreateStaffMembership()
    {
        // Arrange - owner creates business and invites staff
        var (ownerToken, businessSlug) = await SetupOwnerWithBusiness("owner@test.com", "my-shop");
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", ownerToken);
        await Client.PostAsJsonAsync($"/api/business/{businessSlug}/staff/invite", new { email = "newstaff@test.com" });

        // Get the invite token
        await using var scope = ServiceProvider.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<TestAppDbContext>();
        var inviteLink = db.MagicLinks.First(l => l.Email == "newstaff@test.com" && l.Type == MagicLinkType.Invite);

        // Act - staff accepts invite
        Client.DefaultRequestHeaders.Authorization = null;
        var response = await Client.GetAsync($"/api/auth/verify?token={inviteLink.Token}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        db.ChangeTracker.Clear();
        var staff = db.Users.First(u => u.Email == "newstaff@test.com");
        var membership = db.BusinessMembers.First(bm => bm.UserId == staff.Id);
        membership.Role.Should().Be(BusinessRole.Staff);
        membership.JoinedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task AcceptInvite_ShouldReturnBusinessInfoInResponse()
    {
        // Arrange
        var (ownerToken, businessSlug) = await SetupOwnerWithBusiness("owner@test.com", "my-shop");
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", ownerToken);
        await Client.PostAsJsonAsync($"/api/business/{businessSlug}/staff/invite", new { email = "staff2@test.com" });

        await using var scope = ServiceProvider.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<TestAppDbContext>();
        var inviteLink = db.MagicLinks.First(l => l.Email == "staff2@test.com");

        // Act
        Client.DefaultRequestHeaders.Authorization = null;
        var result = await Client.GetFromJsonAsync<VerifyResponse>($"/api/auth/verify?token={inviteLink.Token}");

        // Assert
        result!.Email.Should().Be("staff2@test.com");
        result.Token.Should().NotBeNullOrEmpty();
    }

    private async Task<(string Token, string BusinessSlug)> SetupOwnerWithBusiness(string email, string slug)
    {
        var token = await GetAuthToken(email);
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        await Client.PostAsJsonAsync("/api/business", new { name = slug, slug });
        return (token, slug);
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
}
```

**Step 2: Update VerifyMagicLink to handle invites**

In `src/QueueDrop.Api/Features/Auth/VerifyMagicLink.cs`, update the Handler after creating/finding user:

```csharp
// After: await db.SaveChangesAsync(cancellationToken);
// Add this section to handle invite links:

// If this is an invite link, create staff membership
if (magicLink.Type == MagicLinkType.Invite && magicLink.BusinessId.HasValue)
{
    var existingMembership = await db.BusinessMembers
        .FirstOrDefaultAsync(bm => bm.UserId == user.Id && bm.BusinessId == magicLink.BusinessId.Value,
            cancellationToken);

    if (existingMembership is null)
    {
        var membership = BusinessMember.CreateStaffInvite(user.Id, magicLink.BusinessId.Value, magicLink.CreatedAt);
        membership.AcceptInvite(now);
        db.BusinessMembers.Add(membership);
        await db.SaveChangesAsync(cancellationToken);
    }
}
```

Add the required using:
```csharp
using QueueDrop.Domain.Enums;
```

**Step 3:** Run tests, commit

```bash
git add src/QueueDrop.Api/Features/Auth/VerifyMagicLink.cs src/QueueDrop.Api.Tests/AcceptStaffInviteTests.cs
git commit -m "Handle staff invite acceptance in verify endpoint"
```

---

## Task 7: List Staff Endpoint

**Files:**
- Create: `src/QueueDrop.Api/Features/Staff/ListStaff.cs`
- Test: `src/QueueDrop.Api.Tests/ListStaffTests.cs`

**Step 1: Write the failing test**

Create `src/QueueDrop.Api.Tests/ListStaffTests.cs`:

```csharp
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using QueueDrop.Domain.Enums;

namespace QueueDrop.Api.Tests;

public class ListStaffTests : IntegrationTestBase
{
    [Fact]
    public async Task ListStaff_AsOwner_ShouldReturnAllMembers()
    {
        // Arrange
        var (token, businessSlug) = await SetupOwnerWithBusiness("owner@test.com", "my-shop");
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        // Act
        var response = await Client.GetAsync($"/api/business/{businessSlug}/staff");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<StaffListResponse>();
        result!.Staff.Should().HaveCount(1); // Just the owner
        result.Staff[0].Role.Should().Be("Owner");
    }

    [Fact]
    public async Task ListStaff_AsNonOwner_ShouldReturn403()
    {
        // Arrange
        var (_, businessSlug) = await SetupOwnerWithBusiness("owner@test.com", "my-shop");
        var otherToken = await GetAuthToken("other@test.com");
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", otherToken);

        // Act
        var response = await Client.GetAsync($"/api/business/{businessSlug}/staff");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    private async Task<(string Token, string BusinessSlug)> SetupOwnerWithBusiness(string email, string slug)
    {
        var token = await GetAuthToken(email);
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        await Client.PostAsJsonAsync("/api/business", new { name = slug, slug });
        return (token, slug);
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
    private record StaffListResponse(List<StaffMember> Staff);
    private record StaffMember(Guid UserId, string Email, string Role, DateTimeOffset JoinedAt);
}
```

**Step 2: Write implementation**

Create `src/QueueDrop.Api/Features/Staff/ListStaff.cs`:

```csharp
using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using QueueDrop.Api.Auth;
using QueueDrop.Infrastructure.Persistence;

namespace QueueDrop.Api.Features.Staff;

public static class ListStaff
{
    public sealed record StaffMember(Guid UserId, string Email, string Role, DateTimeOffset JoinedAt);
    public sealed record Response(List<StaffMember> Staff);

    public static void MapEndpoint(IEndpointRouteBuilder app)
    {
        app.MapGet("/api/business/{businessSlug}/staff", Handler)
            .WithName("ListStaff")
            .WithTags("Staff")
            .RequireAuthorization()
            .Produces<Response>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status403Forbidden);
    }

    private static async Task<IResult> Handler(
        string businessSlug,
        ClaimsPrincipal user,
        AppDbContext db,
        IBusinessAuthorizationService authService,
        CancellationToken cancellationToken)
    {
        var userIdClaim = user.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
            return Results.Unauthorized();

        if (!await authService.IsOwnerAsync(userId, businessSlug, cancellationToken))
        {
            return Results.Problem(
                title: "Forbidden",
                detail: "Only business owners can view staff list.",
                statusCode: StatusCodes.Status403Forbidden);
        }

        var staff = await db.BusinessMembers
            .Include(bm => bm.User)
            .Include(bm => bm.Business)
            .Where(bm => bm.Business.Slug == businessSlug.ToLowerInvariant() && bm.JoinedAt != null)
            .Select(bm => new StaffMember(
                bm.UserId,
                bm.User.Email,
                bm.Role.ToString(),
                bm.JoinedAt!.Value))
            .ToListAsync(cancellationToken);

        return Results.Ok(new Response(staff));
    }
}
```

**Step 3: Register endpoint, run tests, commit**

```bash
git add src/QueueDrop.Api/Features/Staff/ListStaff.cs src/QueueDrop.Api/Program.cs src/QueueDrop.Api.Tests/ListStaffTests.cs
git commit -m "Add list staff endpoint (owner only)"
```

---

## Task 8: Remove Staff Endpoint

**Files:**
- Create: `src/QueueDrop.Api/Features/Staff/RemoveStaff.cs`
- Test: `src/QueueDrop.Api.Tests/RemoveStaffTests.cs`

**Step 1: Write the failing test**

Create `src/QueueDrop.Api.Tests/RemoveStaffTests.cs`:

```csharp
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using QueueDrop.Domain.Entities;
using QueueDrop.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace QueueDrop.Api.Tests;

public class RemoveStaffTests : IntegrationTestBase
{
    [Fact]
    public async Task RemoveStaff_AsOwner_ShouldReturn204()
    {
        // Arrange
        var (ownerToken, businessSlug, staffUserId) = await SetupOwnerWithStaff("owner@test.com", "my-shop", "staff@test.com");
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", ownerToken);

        // Act
        var response = await Client.DeleteAsync($"/api/business/{businessSlug}/staff/{staffUserId}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);

        await using var scope = ServiceProvider.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<TestAppDbContext>();
        db.BusinessMembers.Any(bm => bm.UserId == staffUserId).Should().BeFalse();
    }

    [Fact]
    public async Task RemoveStaff_CannotRemoveOwner_ShouldReturn400()
    {
        // Arrange
        var (ownerToken, businessSlug) = await SetupOwnerWithBusiness("owner@test.com", "my-shop");
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", ownerToken);

        await using var scope = ServiceProvider.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<TestAppDbContext>();
        var owner = await db.Users.FirstAsync(u => u.Email == "owner@test.com");

        // Act - try to remove self (owner)
        var response = await Client.DeleteAsync($"/api/business/{businessSlug}/staff/{owner.Id}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    private async Task<(string Token, string BusinessSlug, Guid StaffUserId)> SetupOwnerWithStaff(string ownerEmail, string slug, string staffEmail)
    {
        var (ownerToken, businessSlug) = await SetupOwnerWithBusiness(ownerEmail, slug);

        // Create staff via invite flow
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", ownerToken);
        await Client.PostAsJsonAsync($"/api/business/{businessSlug}/staff/invite", new { email = staffEmail });

        await using var scope = ServiceProvider.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<TestAppDbContext>();
        var inviteLink = db.MagicLinks.First(l => l.Email == staffEmail && l.Type == MagicLinkType.Invite);

        // Accept invite
        Client.DefaultRequestHeaders.Authorization = null;
        await Client.GetAsync($"/api/auth/verify?token={inviteLink.Token}");

        db.ChangeTracker.Clear();
        var staff = await db.Users.FirstAsync(u => u.Email == staffEmail);
        return (ownerToken, businessSlug, staff.Id);
    }

    private async Task<(string Token, string BusinessSlug)> SetupOwnerWithBusiness(string email, string slug)
    {
        var token = await GetAuthToken(email);
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        await Client.PostAsJsonAsync("/api/business", new { name = slug, slug });
        return (token, slug);
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
}
```

**Step 2: Write implementation**

Create `src/QueueDrop.Api/Features/Staff/RemoveStaff.cs`:

```csharp
using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QueueDrop.Api.Auth;
using QueueDrop.Domain.Enums;
using QueueDrop.Infrastructure.Persistence;

namespace QueueDrop.Api.Features.Staff;

public static class RemoveStaff
{
    public static void MapEndpoint(IEndpointRouteBuilder app)
    {
        app.MapDelete("/api/business/{businessSlug}/staff/{userId:guid}", Handler)
            .WithName("RemoveStaff")
            .WithTags("Staff")
            .RequireAuthorization()
            .Produces(StatusCodes.Status204NoContent)
            .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
            .Produces<ProblemDetails>(StatusCodes.Status403Forbidden)
            .Produces<ProblemDetails>(StatusCodes.Status404NotFound);
    }

    private static async Task<IResult> Handler(
        string businessSlug,
        Guid userId,
        ClaimsPrincipal user,
        AppDbContext db,
        IBusinessAuthorizationService authService,
        CancellationToken cancellationToken)
    {
        var currentUserIdClaim = user.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(currentUserIdClaim, out var currentUserId))
            return Results.Unauthorized();

        if (!await authService.IsOwnerAsync(currentUserId, businessSlug, cancellationToken))
        {
            return Results.Problem(
                title: "Forbidden",
                detail: "Only business owners can remove staff.",
                statusCode: StatusCodes.Status403Forbidden);
        }

        var membership = await db.BusinessMembers
            .Include(bm => bm.Business)
            .FirstOrDefaultAsync(bm =>
                bm.UserId == userId &&
                bm.Business.Slug == businessSlug.ToLowerInvariant(),
                cancellationToken);

        if (membership is null)
            return Results.NotFound();

        // Cannot remove owners
        if (membership.Role == BusinessRole.Owner)
        {
            return Results.Problem(
                title: "Cannot remove owner",
                detail: "Business owners cannot be removed from their own business.",
                statusCode: StatusCodes.Status400BadRequest);
        }

        db.BusinessMembers.Remove(membership);
        await db.SaveChangesAsync(cancellationToken);

        return Results.NoContent();
    }
}
```

**Step 3: Register endpoint, run tests, commit**

```bash
git add src/QueueDrop.Api/Features/Staff/RemoveStaff.cs src/QueueDrop.Api/Program.cs src/QueueDrop.Api.Tests/RemoveStaffTests.cs
git commit -m "Add remove staff endpoint (owner only)"
```

---

## Task 9: Final Verification

**Step 1:** Run full test suite:
`dotnet test src/QueueDrop.sln --verbosity minimal`

**Step 2:** Verify all new endpoints work together (optional smoke test)

**Step 3:** Commit any remaining changes:
```bash
git add -A
git commit -m "Complete queue management and staff invites phase 2"
```

---

## Summary

This plan implements:
1. **Authorization service** - checks business membership and role
2. **Create queue** - POST /api/business/{slug}/queues (owner only)
3. **Update queue** - PUT /api/business/{slug}/queues/{queueSlug} (owner only)
4. **Delete queue** - DELETE /api/business/{slug}/queues/{queueSlug} (owner only)
5. **Invite staff** - POST /api/business/{slug}/staff/invite (owner only)
6. **Accept invite** - handled by existing verify endpoint
7. **List staff** - GET /api/business/{slug}/staff (owner only)
8. **Remove staff** - DELETE /api/business/{slug}/staff/{userId} (owner only)
