# Frontend Auth & Onboarding Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add authentication flow, protected routes, and business onboarding to the React frontend.

**Architecture:** Auth context stores JWT + user state. Protected routes redirect to login. Magic link verification handles login/signup/invite flows. Onboarding creates first business.

**Tech Stack:** React 19, React Router 6, TypeScript, Tailwind CSS, existing fetch patterns.

---

## Task 1: Auth Context & Provider

**Files:**
- Create: `src/client/src/features/auth/AuthContext.tsx`
- Create: `src/client/src/features/auth/hooks/useAuth.ts`

**Step 1: Create auth context with types**

Create `src/client/src/features/auth/AuthContext.tsx`:

```typescript
import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

interface User {
  id: string;
  email: string;
}

interface Business {
  id: string;
  name: string;
  slug: string;
}

interface AuthState {
  user: User | null;
  businesses: Business[];
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextValue extends AuthState {
  login: (token: string, user: User) => void;
  logout: () => void;
  addBusiness: (business: Business) => void;
  fetchMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = 'auth_token';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    businesses: [],
    token: localStorage.getItem(TOKEN_KEY),
    isLoading: true,
    isAuthenticated: false,
  });

  const fetchMe = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setState(s => ({ ...s, isLoading: false, isAuthenticated: false }));
      return;
    }

    try {
      const response = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        localStorage.removeItem(TOKEN_KEY);
        setState({ user: null, businesses: [], token: null, isLoading: false, isAuthenticated: false });
        return;
      }

      const data = await response.json();
      setState({
        user: { id: data.userId, email: data.email },
        businesses: data.businesses || [],
        token,
        isLoading: false,
        isAuthenticated: true,
      });
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      setState({ user: null, businesses: [], token: null, isLoading: false, isAuthenticated: false });
    }
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  const login = useCallback((token: string, user: User) => {
    localStorage.setItem(TOKEN_KEY, token);
    setState(s => ({ ...s, token, user, isAuthenticated: true, isLoading: false }));
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setState({ user: null, businesses: [], token: null, isLoading: false, isAuthenticated: false });
  }, []);

  const addBusiness = useCallback((business: Business) => {
    setState(s => ({ ...s, businesses: [...s.businesses, business] }));
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout, addBusiness, fetchMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

**Step 2: Create convenience hook**

Create `src/client/src/features/auth/hooks/useAuth.ts`:

```typescript
export { useAuth } from '../AuthContext';
```

**Step 3: Wrap App with AuthProvider**

In `src/client/src/App.tsx`, wrap routes with AuthProvider:

```typescript
import { AuthProvider } from './features/auth/AuthContext';

// Wrap BrowserRouter content with AuthProvider
```

**Step 4:** Commit

```bash
git add src/client/src/features/auth/
git commit -m "Add auth context and provider"
```

---

## Task 2: Protected Route Component

**Files:**
- Create: `src/client/src/features/auth/components/ProtectedRoute.tsx`

**Step 1: Create protected route wrapper**

```typescript
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';

interface Props {
  children: React.ReactNode;
  requireBusiness?: string; // Optional: require membership in specific business
}

export function ProtectedRoute({ children, requireBusiness }: Props) {
  const { isAuthenticated, isLoading, businesses } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-400">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireBusiness && !businesses.some(b => b.slug === requireBusiness)) {
    return <Navigate to="/404" replace />;
  }

  return <>{children}</>;
}
```

**Step 2:** Commit

```bash
git add src/client/src/features/auth/components/ProtectedRoute.tsx
git commit -m "Add protected route component"
```

---

## Task 3: Login Page

**Files:**
- Create: `src/client/src/features/auth/LoginPage.tsx`

**Step 1: Create login page with email form**

```typescript
import { useState, FormEvent } from 'react';
import { useLocation, Link } from 'react-router-dom';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/send-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || 'Failed to send login link');
      }

      setIsSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  }

  if (isSent) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-2xl mx-auto mb-6 flex items-center justify-center">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Check your email</h1>
          <p className="text-zinc-400 mb-6">
            We sent a login link to <span className="text-white">{email}</span>
          </p>
          <p className="text-zinc-500 text-sm">
            Click the link in the email to sign in. The link expires in 15 minutes.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <Link to="/" className="block mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-xl mx-auto" />
        </Link>

        <h1 className="text-2xl font-bold text-white text-center mb-2">Welcome to QueueDrop</h1>
        <p className="text-zinc-400 text-center mb-8">Enter your email to sign in or create an account</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-zinc-300 mb-2">
              Email address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
              className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              placeholder="you@example.com"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-medium rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isLoading ? 'Sending...' : 'Continue with Email'}
          </button>
        </form>

        <p className="text-zinc-500 text-sm text-center mt-6">
          We'll send you a magic link to sign in instantly. No password needed.
        </p>
      </div>
    </div>
  );
}
```

**Step 2: Add route to App.tsx**

```typescript
import { LoginPage } from './features/auth/LoginPage';

// Add route: <Route path="/login" element={<LoginPage />} />
```

**Step 3:** Commit

```bash
git add src/client/src/features/auth/LoginPage.tsx src/client/src/App.tsx
git commit -m "Add login page with magic link flow"
```

---

## Task 4: Auth Verify Page

**Files:**
- Create: `src/client/src/features/auth/VerifyPage.tsx`

**Step 1: Create verify page that handles magic link callback**

```typescript
import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

export function VerifyPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login, fetchMe } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setError('Invalid link');
      return;
    }

    async function verify() {
      try {
        const response = await fetch(`/api/auth/verify?token=${token}`);

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.detail || 'Invalid or expired link');
        }

        const data = await response.json();
        login(data.token, { id: data.userId, email: data.email });

        // Fetch full user data to get businesses
        await fetchMe();

        // Redirect based on user state
        // fetchMe updates the context, but we need to check the response
        const meResponse = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${data.token}` },
        });
        const meData = await meResponse.json();

        if (meData.businesses && meData.businesses.length > 0) {
          // User has businesses - go to first one
          navigate(`/staff/${meData.businesses[0].slug}`, { replace: true });
        } else {
          // New user - go to onboarding
          navigate('/onboarding', { replace: true });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Verification failed');
      }
    }

    verify();
  }, [searchParams, login, fetchMe, navigate]);

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-500/10 rounded-2xl mx-auto mb-6 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Verification failed</h1>
          <p className="text-zinc-400 mb-6">{error}</p>
          <a
            href="/login"
            className="inline-block px-6 py-3 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-medium rounded-xl hover:opacity-90 transition-opacity"
          >
            Try again
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-zinc-400">Verifying your link...</p>
      </div>
    </div>
  );
}
```

**Step 2: Add route to App.tsx**

```typescript
import { VerifyPage } from './features/auth/VerifyPage';

// Add route: <Route path="/auth/verify" element={<VerifyPage />} />
```

**Step 3:** Commit

```bash
git add src/client/src/features/auth/VerifyPage.tsx src/client/src/App.tsx
git commit -m "Add magic link verification page"
```

---

## Task 5: Onboarding Page

**Files:**
- Create: `src/client/src/features/auth/OnboardingPage.tsx`

**Step 1: Create onboarding page for new users to create their first business**

```typescript
import { useState, FormEvent, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

export function OnboardingPage() {
  const { isAuthenticated, isLoading, businesses, token, addBusiness } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-generate slug from name
  useEffect(() => {
    const generated = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
    setSlug(generated);
  }, [name]);

  // Redirect if already has business
  useEffect(() => {
    if (!isLoading && businesses.length > 0) {
      navigate(`/staff/${businesses[0].slug}`, { replace: true });
    }
  }, [isLoading, businesses, navigate]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/login', { replace: true });
    }
  }, [isLoading, isAuthenticated, navigate]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/business', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, slug }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || 'Failed to create business');
      }

      const data = await response.json();
      addBusiness({ id: data.id, name: data.name, slug: data.slug });
      navigate(`/staff/${data.slug}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-xl mx-auto mb-8" />

        <h1 className="text-2xl font-bold text-white text-center mb-2">Create your business</h1>
        <p className="text-zinc-400 text-center mb-8">Set up your queue management in seconds</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-zinc-300 mb-2">
              Business name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              autoFocus
              className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              placeholder="My Coffee Shop"
            />
          </div>

          <div>
            <label htmlFor="slug" className="block text-sm font-medium text-zinc-300 mb-2">
              URL slug
            </label>
            <div className="flex items-center">
              <span className="text-zinc-500 mr-2">queuedrop.com/</span>
              <input
                id="slug"
                type="text"
                value={slug}
                onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                required
                className="flex-1 px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                placeholder="my-coffee-shop"
              />
            </div>
            <p className="text-zinc-500 text-sm mt-1">This will be your unique business URL</p>
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || !name || !slug}
            className="w-full py-3 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-medium rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isSubmitting ? 'Creating...' : 'Create Business'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

**Step 2: Add route to App.tsx**

```typescript
import { OnboardingPage } from './features/auth/OnboardingPage';

// Add route: <Route path="/onboarding" element={<OnboardingPage />} />
```

**Step 3:** Commit

```bash
git add src/client/src/features/auth/OnboardingPage.tsx src/client/src/App.tsx
git commit -m "Add business onboarding page"
```

---

## Task 6: Protect Staff Dashboard Route

**Files:**
- Modify: `src/client/src/App.tsx`

**Step 1: Wrap staff dashboard with ProtectedRoute**

Update the staff dashboard route:

```typescript
import { ProtectedRoute } from './features/auth/components/ProtectedRoute';

// Change:
// <Route path="/staff/:businessSlug" element={<StaffDashboard />} />
// To:
<Route
  path="/staff/:businessSlug"
  element={
    <ProtectedRoute>
      <StaffDashboard />
    </ProtectedRoute>
  }
/>
```

**Step 2:** Commit

```bash
git add src/client/src/App.tsx
git commit -m "Protect staff dashboard route with auth"
```

---

## Task 7: Add User Menu to Staff Dashboard

**Files:**
- Create: `src/client/src/features/auth/components/UserMenu.tsx`
- Modify: `src/client/src/features/staff/StaffDashboard.tsx`

**Step 1: Create user menu dropdown**

```typescript
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

export function UserMenu() {
  const { user, logout, businesses } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  if (!user) return null;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-800/50 hover:bg-zinc-800 transition-colors"
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white text-sm font-medium">
          {user.email[0].toUpperCase()}
        </div>
        <span className="text-zinc-300 text-sm hidden sm:block">{user.email}</span>
        <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl py-2 z-50">
          <div className="px-4 py-2 border-b border-zinc-800">
            <p className="text-sm text-zinc-400">Signed in as</p>
            <p className="text-white font-medium truncate">{user.email}</p>
          </div>

          {businesses.length > 1 && (
            <div className="py-2 border-b border-zinc-800">
              <p className="px-4 py-1 text-xs text-zinc-500 uppercase tracking-wider">Businesses</p>
              {businesses.map(b => (
                <button
                  key={b.id}
                  onClick={() => {
                    navigate(`/staff/${b.slug}`);
                    setIsOpen(false);
                  }}
                  className="w-full px-4 py-2 text-left text-zinc-300 hover:bg-zinc-800 transition-colors"
                >
                  {b.name}
                </button>
              ))}
            </div>
          )}

          <button
            onClick={handleLogout}
            className="w-full px-4 py-2 text-left text-red-400 hover:bg-zinc-800 transition-colors"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Add UserMenu to StaffDashboard header**

In `StaffDashboard.tsx`, import and add the UserMenu to the header section.

**Step 3:** Commit

```bash
git add src/client/src/features/auth/components/UserMenu.tsx src/client/src/features/staff/StaffDashboard.tsx
git commit -m "Add user menu to staff dashboard"
```

---

## Task 8: Update Landing Page with Auth Links

**Files:**
- Modify: `src/client/src/features/landing/LandingPage.tsx` (or wherever landing page is)

**Step 1: Add sign in / get started buttons**

Update the landing page header/hero to include:

```typescript
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

// In component:
const { isAuthenticated, businesses } = useAuth();

// In header:
{isAuthenticated ? (
  <Link
    to={businesses.length > 0 ? `/staff/${businesses[0].slug}` : '/onboarding'}
    className="px-4 py-2 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-medium rounded-xl hover:opacity-90 transition-opacity"
  >
    Dashboard
  </Link>
) : (
  <Link
    to="/login"
    className="px-4 py-2 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-medium rounded-xl hover:opacity-90 transition-opacity"
  >
    Get Started
  </Link>
)}
```

**Step 2:** Commit

```bash
git add src/client/src/features/landing/LandingPage.tsx
git commit -m "Add auth links to landing page"
```

---

## Task 9: Update Backend /me Endpoint to Return Businesses

**Files:**
- Modify: `src/QueueDrop.Api/Features/Auth/GetMe.cs`

**Step 1: Update GetMe to return user's businesses**

The current `/api/auth/me` endpoint needs to return the user's businesses so the frontend knows where to redirect.

Update the response to include:
```csharp
public sealed record Response(
    Guid UserId,
    string Email,
    List<BusinessDto> Businesses);

public sealed record BusinessDto(Guid Id, string Name, string Slug);
```

Query for businesses where user is a member:
```csharp
var businesses = await db.BusinessMembers
    .Include(bm => bm.Business)
    .Where(bm => bm.UserId == userId && bm.JoinedAt != null)
    .Select(bm => new BusinessDto(bm.Business.Id, bm.Business.Name, bm.Business.Slug))
    .ToListAsync(cancellationToken);
```

**Step 2:** Update tests if needed

**Step 3:** Commit

```bash
git add src/QueueDrop.Api/Features/Auth/GetMe.cs
git commit -m "Return user's businesses from /me endpoint"
```

---

## Task 10: Final Integration & Testing

**Step 1:** Run all backend tests:
```bash
dotnet test src/QueueDrop.sln --verbosity minimal
```

**Step 2:** Run frontend tests:
```bash
cd src/client && npm test -- --run
```

**Step 3:** Manual testing checklist:
- [ ] Login flow works (email → magic link → verify → redirect)
- [ ] New user goes to onboarding
- [ ] Returning user goes to dashboard
- [ ] Staff invite flow works (invite → verify → redirect to business)
- [ ] Protected routes redirect to login
- [ ] Logout works
- [ ] User menu shows correctly

**Step 4:** Commit any fixes

```bash
git add -A
git commit -m "Complete frontend auth integration"
```

---

## Summary

This plan implements:
1. **Auth Context** - Stores JWT, user, businesses in React context
2. **Protected Routes** - Wrapper that redirects unauthenticated users
3. **Login Page** - Email form → magic link flow
4. **Verify Page** - Handles magic link callback, redirects appropriately
5. **Onboarding Page** - First-time users create their business
6. **User Menu** - Dropdown with logout, business switching
7. **Landing Page** - Updated with auth links
8. **Backend Update** - /me endpoint returns user's businesses
