# Business Onboarding & Multi-Queue Management

**Date:** 2026-01-28
**Status:** Draft
**Goal:** Transform QueueDrop from a demo into a real product where businesses can self-serve.

## Problem Statement

Currently QueueDrop is a demo:
- Businesses can't sign up - queues are hardcoded via seed data
- Queue names and configuration require developer intervention
- No authentication - anyone with the staff dashboard URL can operate queues
- No way for a store to actually start using the product

## Solution Overview

Build a complete self-service flow:
1. Business owner signs up with magic link authentication
2. Creates their business (name, slug)
3. Creates and configures queues through the UI
4. Invites staff members who can operate queues
5. Generates QR codes for customers to scan

## User Roles

| Role | Can Do | Cannot Do |
|------|--------|-----------|
| **Owner** | Create/edit/delete queues, configure settings, invite/remove staff, operate queues, view QR codes | - |
| **Staff** | Operate queues (call next, mark served/no-show), view QR codes | Create/delete queues, change settings, manage staff |
| **Customer** | Join queues, view position, leave queue | No account needed |

## Authentication

### Magic Link Flow

**Why magic link:**
- Simpler than password flows (no reset, no validation rules)
- Modern UX pattern
- Email itself is the verification

**Sign-up/Login flow:**
1. User enters email at `/login` or `/signup`
2. System creates `MagicLink` record (token, email, expires in 15 min)
3. Sends email with link: `{baseUrl}/auth/verify?token=xxx`
4. User clicks link → system validates token, creates/finds `User`, issues JWT
5. JWT stored in httpOnly cookie (preferred) or localStorage
6. Redirect to `/dashboard`

**Staff invite flow:**
1. Owner enters staff email in Settings → Staff → Invite
2. System creates `MagicLink` with type=invite, linked to business
3. Sends email: "You've been invited to join {Business} on QueueDrop"
4. Staff clicks link → account created, `BusinessMember` created with role=Staff
5. Lands on dashboard

## Domain Model Changes

### New Entities

```csharp
// User - authentication identity
public class User
{
    public Guid Id { get; init; }
    public string Email { get; private set; }
    public DateTime CreatedAt { get; init; }

    // Navigation
    public IReadOnlyList<BusinessMember> BusinessMemberships { get; }
}

// BusinessMember - links users to businesses with roles
public class BusinessMember
{
    public Guid Id { get; init; }
    public Guid UserId { get; init; }
    public Guid BusinessId { get; init; }
    public BusinessRole Role { get; private set; }
    public DateTime InvitedAt { get; init; }
    public DateTime? JoinedAt { get; private set; }

    // Navigation
    public User User { get; }
    public Business Business { get; }
}

public enum BusinessRole
{
    Owner,
    Staff
}

// MagicLink - for authentication and invites
public class MagicLink
{
    public Guid Id { get; init; }
    public string Token { get; init; }  // URL-safe random string
    public string Email { get; init; }
    public MagicLinkType Type { get; init; }
    public Guid? BusinessId { get; init; }  // For invite links
    public DateTime ExpiresAt { get; init; }
    public DateTime? UsedAt { get; private set; }
    public DateTime CreatedAt { get; init; }
}

public enum MagicLinkType
{
    Login,
    Invite
}
```

### Changes to Existing Entities

**Business:**
- Add navigation to `BusinessMembers`
- No other changes needed (already has queues collection)

## API Endpoints

### Authentication

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/send-magic-link` | No | Send login/signup email |
| GET | `/api/auth/verify` | No | Verify token, return JWT |
| GET | `/api/auth/me` | Yes | Current user, business, role |
| POST | `/api/auth/logout` | Yes | Invalidate session |

### Business Management

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/business` | User | Create business (user becomes owner) |
| GET | `/api/business/{slug}` | Member | Get business details |
| PUT | `/api/business/{slug}` | Owner | Update business settings |
| DELETE | `/api/business/{slug}` | Owner | Delete business |

### Queue Management

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/business/{slug}/queues` | Public* | List queues (public for customers) |
| POST | `/api/business/{slug}/queues` | Owner | Create queue |
| PUT | `/api/business/{slug}/queues/{queueSlug}` | Owner | Update queue |
| DELETE | `/api/business/{slug}/queues/{queueSlug}` | Owner | Delete queue |
| POST | `/api/business/{slug}/queues/{queueSlug}/pause` | Owner | Pause queue |
| POST | `/api/business/{slug}/queues/{queueSlug}/resume` | Owner | Resume queue |

*Public endpoint returns limited info (name, slug, status, wait estimate)

### Staff Management

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/business/{slug}/staff` | Owner | List staff members |
| POST | `/api/business/{slug}/staff/invite` | Owner | Send staff invite |
| DELETE | `/api/business/{slug}/staff/{userId}` | Owner | Remove staff member |

### Queue Operations (Existing, Now Auth-Protected)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/queues/{queueId}/customers` | Member | List customers |
| POST | `/api/queues/{queueId}/call-next` | Member | Call next customer |
| POST | `/api/queues/{queueId}/customers/{customerId}/serve` | Member | Mark served |
| POST | `/api/queues/{queueId}/customers/{customerId}/no-show` | Member | Mark no-show |
| DELETE | `/api/queues/{queueId}/customers/{customerId}` | Member | Remove customer |

## Database Schema

### New Tables

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE business_members (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL,  -- 'Owner' or 'Staff'
    invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    joined_at TIMESTAMPTZ,
    UNIQUE(user_id, business_id)
);

CREATE TABLE magic_links (
    id UUID PRIMARY KEY,
    token VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,  -- 'Login' or 'Invite'
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_magic_links_token ON magic_links(token);
CREATE INDEX idx_magic_links_email ON magic_links(email);
CREATE INDEX idx_business_members_user ON business_members(user_id);
CREATE INDEX idx_business_members_business ON business_members(business_id);
```

## Frontend Routes

| Route | Auth | Description |
|-------|------|-------------|
| `/login` | No | Magic link request form |
| `/signup` | No | Same form, different copy |
| `/auth/verify` | No | Magic link landing, redirects to dashboard |
| `/dashboard` | Yes | Queue operations (staff + owner) |
| `/dashboard/settings` | Owner | Business settings, staff management |
| `/dashboard/settings/queues` | Owner | Queue CRUD |
| `/dashboard/settings/staff` | Owner | Staff management |
| `/join/{businessSlug}` | No | Customer join flow (existing) |
| `/q/{token}` | No | Customer position page (existing) |

## UI Components

### New Components

**Auth:**
- `LoginForm` - email input, submit button, success message
- `AuthVerify` - loading state while verifying token

**Dashboard:**
- `DashboardLayout` - header with business name, nav, user menu
- `DashboardNav` - tabs for Queues, Settings (owner only)
- `EmptyState` - "No queues yet" with CTA

**Settings:**
- `BusinessSettingsForm` - name, slug editor
- `QueueList` - list of queues with edit/delete actions
- `QueueForm` - create/edit queue with advanced settings toggle
- `StaffList` - list of staff with remove action
- `InviteStaffForm` - email input to send invite

### Modified Components

**Staff Dashboard (existing):**
- Add auth check - redirect to `/login` if not authenticated
- Scope to user's business (remove hardcoded demo-shop)
- Hide settings nav for staff role

## Queue Settings UI

**Default view (collapsed):**
- Queue name (required)
- Slug (auto-generated, editable)

**Advanced settings (expandable):**
- Max queue size (number, optional)
- Estimated service time in minutes (number, optional)
- Allow join when paused (checkbox)
- No-show timeout in minutes (number, optional)
- Welcome message (textarea, optional)
- Called message (textarea, optional)

## Customer Experience Polish

No new features, focus on UX improvements:

### Loading States
- Skeleton loaders instead of spinners
- Optimistic updates where safe

### Error Handling
- Clear error messages: "This queue is full", "Queue is paused", "Business not found"
- Recovery actions where possible: "Try another queue"

### Queue Selection (Multi-Queue)
- Show wait estimate per queue
- Visual indicator for paused/full queues
- Brief description if configured

### Position Page
- Large, clear position number
- Estimated wait time
- Smooth status transitions
- Celebration moment when called
- Leave queue with confirmation

### Edge Cases
- Token not found → "Your spot is no longer valid" with re-join option
- Queue deleted → graceful message
- Already served → "You've been served" confirmation

## Email Templates

### Magic Link (Login/Signup)

**Subject:** Sign in to QueueDrop

**Body:**
```
Click the link below to sign in to QueueDrop:

[Sign In →]

This link expires in 15 minutes.

If you didn't request this, you can ignore this email.
```

### Staff Invite

**Subject:** You're invited to join {BusinessName} on QueueDrop

**Body:**
```
{OwnerEmail} has invited you to help manage queues at {BusinessName}.

Click below to accept the invitation:

[Accept Invitation →]

This link expires in 7 days.
```

## Email Infrastructure

**Options (pick one):**
- **Resend** - Developer-friendly, generous free tier (3k/month)
- **Postmark** - Excellent deliverability, 100 free/month
- **SendGrid** - 100 free/day, well-known

**Local development:**
- Log emails to console
- Or use Mailpit (local SMTP server with web UI)

**Configuration:**
```
Email__Provider=Resend
Email__ApiKey=re_xxx
Email__FromAddress=noreply@queuedrop.app
Email__FromName=QueueDrop
```

## Security Considerations

- Magic link tokens: cryptographically random, 32+ bytes, URL-safe
- Token expiry: 15 minutes for login, 7 days for invites
- One-time use: mark as used immediately on verification
- Rate limiting: max 5 magic link requests per email per hour
- JWT: short expiry (1 hour), refresh via new magic link or sliding window
- Authorization: check business membership on every protected endpoint

## Scope Exclusions

Explicitly NOT building:
- Email verification (magic link is verification)
- Password authentication
- Social login (Google, GitHub, etc.)
- SMS notifications
- Party size on join form
- Multiple businesses per user
- Business deletion (can add later)
- Queue reordering/priority
- Moving customers between queues

## Implementation Phases

### Phase 1: Auth Foundation
- User, BusinessMember, MagicLink entities
- Magic link send/verify endpoints
- JWT generation and validation
- Auth middleware

### Phase 2: Business & Queue Management
- Create business endpoint
- Queue CRUD endpoints
- Owner authorization checks

### Phase 3: Staff Invites
- Invite endpoint
- Invite email
- Staff role assignment

### Phase 4: Frontend Auth
- Login/signup pages
- Auth state management
- Protected routes

### Phase 5: Dashboard Updates
- Scope to user's business
- Settings pages for owner
- Queue CRUD UI
- Staff management UI

### Phase 6: Customer Polish
- Loading states
- Error handling
- Position page improvements

## Success Criteria

A store owner can:
1. Sign up with their email
2. Create their business
3. Add one or more queues
4. Generate and print QR codes
5. Invite staff members
6. Staff can log in and call customers

A customer can:
1. Scan QR code
2. Choose queue (if multiple)
3. Join with their name
4. See their position update in real-time
5. Get notified when called
