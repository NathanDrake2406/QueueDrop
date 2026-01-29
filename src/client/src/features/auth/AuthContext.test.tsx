import { render, screen, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthProvider } from "./AuthContext";
import { useAuth } from "./hooks/useAuth";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Test component that exposes auth state
function AuthStateDisplay() {
  const auth = useAuth();
  return (
    <div>
      <span data-testid="isLoading">{String(auth.isLoading)}</span>
      <span data-testid="isAuthenticated">{String(auth.isAuthenticated)}</span>
      <span data-testid="user">{auth.user ? auth.user.email : "null"}</span>
      <span data-testid="businesses">{auth.businesses.length}</span>
      <span data-testid="isOwner-test-shop">{String(auth.isOwner("test-shop"))}</span>
      <span data-testid="isOwner-other-shop">{String(auth.isOwner("other-shop"))}</span>
      <span data-testid="businessRoles">
        {auth.businesses.map(b => `${b.slug}:${b.role}`).join(",")}
      </span>
      <button onClick={auth.logout}>Logout</button>
      <button onClick={() => auth.login("new-token", { id: "u2", email: "new@example.com" })}>
        Login
      </button>
      <button onClick={() => auth.addBusiness({ id: "b2", name: "New Biz", slug: "new-biz", role: "owner" })}>
        Add Business
      </button>
    </div>
  );
}

describe("AuthContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("transitions to not authenticated when no token in localStorage", async () => {
    // No token in localStorage, no fetch will be made
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve(""),
    });

    render(
      <AuthProvider>
        <AuthStateDisplay />
      </AuthProvider>
    );

    // Should quickly transition to not loading and not authenticated
    // (no fetch is made when there's no token)
    await waitFor(() => {
      expect(screen.getByTestId("isLoading").textContent).toBe("false");
    });
    expect(screen.getByTestId("isAuthenticated").textContent).toBe("false");
    expect(screen.getByTestId("user").textContent).toBe("null");
    // Verify no fetch was made
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("fetches user data when token exists in localStorage", async () => {
    localStorage.setItem("auth_token", "valid-token");

    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/auth/me")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              userId: "user-1",
              email: "test@example.com",
              businesses: [{ id: "biz-1", name: "Test Shop", slug: "test-shop" }],
            }),
        });
      }
      return Promise.resolve({ ok: false, status: 404 });
    });

    render(
      <AuthProvider>
        <AuthStateDisplay />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("isAuthenticated").textContent).toBe("true");
    });
    expect(screen.getByTestId("user").textContent).toBe("test@example.com");
    expect(screen.getByTestId("businesses").textContent).toBe("1");
  });

  it("clears token and sets not authenticated on 401 response", async () => {
    localStorage.setItem("auth_token", "expired-token");

    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve(""),
    });

    render(
      <AuthProvider>
        <AuthStateDisplay />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("isLoading").textContent).toBe("false");
    });

    expect(screen.getByTestId("isAuthenticated").textContent).toBe("false");
    expect(localStorage.getItem("auth_token")).toBeNull();
  });

  it("clears token on fetch error", async () => {
    localStorage.setItem("auth_token", "some-token");

    mockFetch.mockRejectedValue(new Error("Network error"));

    render(
      <AuthProvider>
        <AuthStateDisplay />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("isLoading").textContent).toBe("false");
    });

    expect(screen.getByTestId("isAuthenticated").textContent).toBe("false");
    expect(localStorage.getItem("auth_token")).toBeNull();
  });

  it("login function stores token and updates state", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve(""),
    });

    render(
      <AuthProvider>
        <AuthStateDisplay />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("isLoading").textContent).toBe("false");
    });

    // Click login button
    await act(async () => {
      screen.getByText("Login").click();
    });

    expect(localStorage.getItem("auth_token")).toBe("new-token");
    expect(screen.getByTestId("isAuthenticated").textContent).toBe("true");
    expect(screen.getByTestId("user").textContent).toBe("new@example.com");
  });

  it("logout function clears token and resets state", async () => {
    localStorage.setItem("auth_token", "valid-token");

    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/auth/me")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              userId: "user-1",
              email: "test@example.com",
              businesses: [],
            }),
        });
      }
      return Promise.resolve({ ok: false, status: 404 });
    });

    render(
      <AuthProvider>
        <AuthStateDisplay />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("isAuthenticated").textContent).toBe("true");
    });

    // Click logout button
    await act(async () => {
      screen.getByText("Logout").click();
    });

    expect(localStorage.getItem("auth_token")).toBeNull();
    expect(screen.getByTestId("isAuthenticated").textContent).toBe("false");
    expect(screen.getByTestId("user").textContent).toBe("null");
  });

  it("addBusiness function adds to businesses array", async () => {
    localStorage.setItem("auth_token", "valid-token");

    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/auth/me")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              userId: "user-1",
              email: "test@example.com",
              businesses: [{ id: "biz-1", name: "Original Biz", slug: "original", role: "owner" }],
            }),
        });
      }
      return Promise.resolve({ ok: false, status: 404 });
    });

    render(
      <AuthProvider>
        <AuthStateDisplay />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("businesses").textContent).toBe("1");
    });

    // Click add business button
    await act(async () => {
      screen.getByText("Add Business").click();
    });

    expect(screen.getByTestId("businesses").textContent).toBe("2");
  });

  it("fetches user data with role in businesses", async () => {
    localStorage.setItem("auth_token", "valid-token");

    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/auth/me")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              userId: "user-1",
              email: "test@example.com",
              businesses: [
                { id: "biz-1", name: "Test Shop", slug: "test-shop", role: "owner" },
                { id: "biz-2", name: "Other Shop", slug: "other-shop", role: "staff" },
              ],
            }),
        });
      }
      return Promise.resolve({ ok: false, status: 404 });
    });

    render(
      <AuthProvider>
        <AuthStateDisplay />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("isAuthenticated").textContent).toBe("true");
    });

    expect(screen.getByTestId("businessRoles").textContent).toBe("test-shop:owner,other-shop:staff");
  });

  it("isOwner returns true for owner role", async () => {
    localStorage.setItem("auth_token", "valid-token");

    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/auth/me")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              userId: "user-1",
              email: "test@example.com",
              businesses: [
                { id: "biz-1", name: "Test Shop", slug: "test-shop", role: "owner" },
              ],
            }),
        });
      }
      return Promise.resolve({ ok: false, status: 404 });
    });

    render(
      <AuthProvider>
        <AuthStateDisplay />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("isAuthenticated").textContent).toBe("true");
    });

    expect(screen.getByTestId("isOwner-test-shop").textContent).toBe("true");
  });

  it("isOwner returns false for staff role", async () => {
    localStorage.setItem("auth_token", "valid-token");

    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/auth/me")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              userId: "user-1",
              email: "test@example.com",
              businesses: [
                { id: "biz-1", name: "Test Shop", slug: "test-shop", role: "staff" },
              ],
            }),
        });
      }
      return Promise.resolve({ ok: false, status: 404 });
    });

    render(
      <AuthProvider>
        <AuthStateDisplay />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("isAuthenticated").textContent).toBe("true");
    });

    expect(screen.getByTestId("isOwner-test-shop").textContent).toBe("false");
  });

  it("isOwner returns false for unknown business", async () => {
    localStorage.setItem("auth_token", "valid-token");

    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/auth/me")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              userId: "user-1",
              email: "test@example.com",
              businesses: [
                { id: "biz-1", name: "Test Shop", slug: "test-shop", role: "owner" },
              ],
            }),
        });
      }
      return Promise.resolve({ ok: false, status: 404 });
    });

    render(
      <AuthProvider>
        <AuthStateDisplay />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("isAuthenticated").textContent).toBe("true");
    });

    expect(screen.getByTestId("isOwner-other-shop").textContent).toBe("false");
  });
});
