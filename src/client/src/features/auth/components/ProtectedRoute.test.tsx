import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useRouter, usePathname } from "next/navigation";
import { ProtectedRoute } from "./ProtectedRoute";
import { AuthProvider } from "../AuthContext";

// Get mock router
const mockReplace = vi.fn();

vi.mocked(useRouter).mockReturnValue({
  push: vi.fn(),
  replace: mockReplace,
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
});

// Mock usePathname to return /protected for returnUrl calculation
vi.mocked(usePathname).mockReturnValue("/protected");

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

function renderProtectedRoute(options: {
  authenticated?: boolean;
  businesses?: Array<{ id: string; name: string; slug: string }>;
  requireBusiness?: string;
}) {
  const { authenticated = false, businesses = [], requireBusiness } = options;

  if (authenticated) {
    localStorage.setItem("auth_token", "test-token");
  }

  mockFetch.mockImplementation((url: string) => {
    if (url.includes("/api/auth/me")) {
      if (authenticated) {
        const data = {
          userId: "user-1",
          email: "test@example.com",
          businesses,
        };
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(data),
          text: () => Promise.resolve(JSON.stringify(data)),
        });
      }
      return Promise.resolve({ ok: false, status: 401, text: () => Promise.resolve("") });
    }
    return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve("") });
  });

  return render(
    <AuthProvider>
      <ProtectedRoute requireBusiness={requireBusiness}>
        <div>Protected Content</div>
      </ProtectedRoute>
    </AuthProvider>
  );
}

describe("ProtectedRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("shows loading state while auth is loading", async () => {
    // Set token so AuthProvider will make a fetch call
    localStorage.setItem("auth_token", "test-token");
    // Make fetch hang to keep loading state
    mockFetch.mockImplementation(() => new Promise(() => {}));

    render(
      <AuthProvider>
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      </AuthProvider>
    );

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("redirects to /login when not authenticated", async () => {
    renderProtectedRoute({ authenticated: false });

    await waitFor(() => {
      // Includes returnUrl for redirect after login
      expect(mockReplace).toHaveBeenCalledWith("/login?returnUrl=%2Fprotected");
    });
  });

  it("renders children when authenticated", async () => {
    renderProtectedRoute({ authenticated: true });

    await waitFor(() => {
      expect(screen.getByText("Protected Content")).toBeInTheDocument();
    });
  });

  it("redirects to /404 when requireBusiness does not match user businesses", async () => {
    renderProtectedRoute({
      authenticated: true,
      businesses: [{ id: "biz-1", name: "My Shop", slug: "my-shop" }],
      requireBusiness: "other-shop",
    });

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/404");
    });
  });

  it("renders children when requireBusiness matches user business", async () => {
    renderProtectedRoute({
      authenticated: true,
      businesses: [{ id: "biz-1", name: "My Shop", slug: "my-shop" }],
      requireBusiness: "my-shop",
    });

    await waitFor(() => {
      expect(screen.getByText("Protected Content")).toBeInTheDocument();
    });
  });

  it("renders children when requireBusiness is not specified", async () => {
    renderProtectedRoute({
      authenticated: true,
      businesses: [], // No businesses but should still render
    });

    await waitFor(() => {
      expect(screen.getByText("Protected Content")).toBeInTheDocument();
    });
  });
});
