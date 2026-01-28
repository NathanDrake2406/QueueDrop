import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { VerifyPage } from "./VerifyPage";
import { AuthProvider } from "./AuthContext";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

function renderVerifyPage(token: string = "valid-token") {
  return render(
    <MemoryRouter initialEntries={[`/auth/verify?token=${token}`]}>
      <AuthProvider>
        <Routes>
          <Route path="/auth/verify" element={<VerifyPage />} />
          <Route path="/login" element={<div>Login Page</div>} />
          <Route path="/onboarding" element={<div>Onboarding Page</div>} />
          <Route path="/staff/:businessSlug" element={<div>Staff Dashboard</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe("VerifyPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("shows loading state while verifying", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/auth/me")) {
        return Promise.resolve({ ok: false, status: 401, text: () => Promise.resolve("") });
      }
      if (url.includes("/api/auth/verify")) {
        return new Promise(() => {}); // Never resolves
      }
      return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve("") });
    });

    renderVerifyPage();

    expect(screen.getByText(/verifying your link/i)).toBeInTheDocument();
    expect(screen.getByText(/please wait/i)).toBeInTheDocument();
  });

  it("redirects to onboarding for new user without businesses", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/auth/verify")) {
        const data = {
          token: "jwt-token",
          userId: "user-1",
          email: "new@example.com",
          isNewUser: true,
        };
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(data),
          text: () => Promise.resolve(JSON.stringify(data)),
        });
      }
      if (url.includes("/api/auth/me")) {
        const data = {
          userId: "user-1",
          email: "new@example.com",
          businesses: [],
        };
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(data),
          text: () => Promise.resolve(JSON.stringify(data)),
        });
      }
      return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve("") });
    });

    renderVerifyPage();

    await waitFor(() => {
      expect(screen.getByText("Onboarding Page")).toBeInTheDocument();
    });
  });

  it("redirects to staff dashboard for user with businesses", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/auth/verify")) {
        const data = {
          token: "jwt-token",
          userId: "user-1",
          email: "owner@example.com",
          isNewUser: false,
        };
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(data),
          text: () => Promise.resolve(JSON.stringify(data)),
        });
      }
      if (url.includes("/api/auth/me")) {
        const data = {
          userId: "user-1",
          email: "owner@example.com",
          businesses: [{ id: "biz-1", name: "My Shop", slug: "my-shop" }],
        };
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(data),
          text: () => Promise.resolve(JSON.stringify(data)),
        });
      }
      return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve("") });
    });

    renderVerifyPage();

    await waitFor(() => {
      expect(screen.getByText("Staff Dashboard")).toBeInTheDocument();
    });
  });

  it("shows error for invalid token", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/auth/me")) {
        return Promise.resolve({ ok: false, status: 401, text: () => Promise.resolve("") });
      }
      if (url.includes("/api/auth/verify")) {
        const errorData = { detail: "Invalid or expired link" };
        return Promise.resolve({
          ok: false,
          status: 400,
          json: () => Promise.resolve(errorData),
          text: () => Promise.resolve(JSON.stringify(errorData)),
        });
      }
      return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve("") });
    });

    renderVerifyPage("invalid-token");

    await waitFor(() => {
      expect(screen.getByText(/verification failed/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/invalid or expired link/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /try again/i })).toBeInTheDocument();
  });

  it("shows error when no token provided", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/auth/me")) {
        return Promise.resolve({ ok: false, status: 401, text: () => Promise.resolve("") });
      }
      return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve("") });
    });

    render(
      <MemoryRouter initialEntries={["/auth/verify"]}>
        <AuthProvider>
          <Routes>
            <Route path="/auth/verify" element={<VerifyPage />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/verification failed/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/no token provided/i)).toBeInTheDocument();
  });

  it("stores token in localStorage on successful verification", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/auth/verify")) {
        const data = {
          token: "jwt-token-123",
          userId: "user-1",
          email: "test@example.com",
          isNewUser: false,
        };
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(data),
          text: () => Promise.resolve(JSON.stringify(data)),
        });
      }
      if (url.includes("/api/auth/me")) {
        const data = {
          userId: "user-1",
          email: "test@example.com",
          businesses: [{ id: "biz-1", name: "Shop", slug: "shop" }],
        };
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(data),
          text: () => Promise.resolve(JSON.stringify(data)),
        });
      }
      return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve("") });
    });

    renderVerifyPage();

    await waitFor(() => {
      expect(localStorage.getItem("auth_token")).toBe("jwt-token-123");
    });
  });
});
