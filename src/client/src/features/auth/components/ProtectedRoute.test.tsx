import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "./ProtectedRoute";
import { AuthProvider } from "../AuthContext";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

function renderProtectedRoute(options: {
  authenticated?: boolean;
  businesses?: Array<{ id: string; name: string; slug: string }>;
  requireBusiness?: string;
  initialPath?: string;
}) {
  const { authenticated = false, businesses = [], requireBusiness, initialPath = "/protected" } = options;

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
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <Routes>
          <Route
            path="/protected"
            element={
              <ProtectedRoute requireBusiness={requireBusiness}>
                <div>Protected Content</div>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<div>Login Page</div>} />
          <Route path="/404" element={<div>Not Found</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
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
      <MemoryRouter initialEntries={["/protected"]}>
        <AuthProvider>
          <Routes>
            <Route
              path="/protected"
              element={
                <ProtectedRoute>
                  <div>Protected Content</div>
                </ProtectedRoute>
              }
            />
            <Route path="/login" element={<div>Login Page</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("redirects to /login when not authenticated", async () => {
    renderProtectedRoute({ authenticated: false });

    await waitFor(() => {
      expect(screen.getByText("Login Page")).toBeInTheDocument();
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
      expect(screen.getByText("Not Found")).toBeInTheDocument();
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
