import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { OnboardingPage } from "./OnboardingPage";
import { AuthProvider } from "./AuthContext";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

function renderOnboardingPage(authenticated: boolean = true) {
  // Set up localStorage for authenticated state
  if (authenticated) {
    localStorage.setItem("auth_token", "test-token");
  }

  return render(
    <MemoryRouter initialEntries={["/onboarding"]}>
      <AuthProvider>
        <Routes>
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/login" element={<div>Login Page</div>} />
          <Route path="/staff/:businessSlug" element={<div>Staff Dashboard: {window.location.pathname}</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe("OnboardingPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("redirects to login if not authenticated", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/auth/me")) {
        return Promise.resolve({ ok: false, status: 401, text: () => Promise.resolve("") });
      }
      return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve("") });
    });

    renderOnboardingPage(false);

    await waitFor(() => {
      expect(screen.getByText("Login Page")).toBeInTheDocument();
    });
  });

  it("redirects to dashboard if user already has businesses", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/auth/me")) {
        const data = {
          userId: "user-1",
          email: "test@example.com",
          businesses: [{ id: "biz-1", name: "Existing Shop", slug: "existing-shop" }],
        };
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(data),
          text: () => Promise.resolve(JSON.stringify(data)),
        });
      }
      return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve("") });
    });

    renderOnboardingPage();

    await waitFor(() => {
      expect(screen.getByText(/staff dashboard/i)).toBeInTheDocument();
    });
  });

  it("renders onboarding form for authenticated user without businesses", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/auth/me")) {
        const data = {
          userId: "user-1",
          email: "test@example.com",
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

    renderOnboardingPage();

    await waitFor(() => {
      expect(screen.getByText(/create your business/i)).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/business name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/url slug/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create business/i })).toBeInTheDocument();
  });

  it("auto-generates slug from business name", async () => {
    const user = userEvent.setup();

    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/auth/me")) {
        const data = {
          userId: "user-1",
          email: "test@example.com",
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

    renderOnboardingPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/business name/i)).toBeInTheDocument();
    });

    const nameInput = screen.getByLabelText(/business name/i);
    await user.type(nameInput, "My Coffee Shop");

    await waitFor(() => {
      const slugInput = screen.getByLabelText(/url slug/i);
      expect(slugInput).toHaveValue("my-coffee-shop");
    });
  });

  it("creates business and redirects to dashboard on success", async () => {
    const user = userEvent.setup();

    mockFetch.mockImplementation((url: string, options?: RequestInit) => {
      if (url.includes("/api/auth/me")) {
        const data = {
          userId: "user-1",
          email: "test@example.com",
          businesses: [],
        };
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(data),
          text: () => Promise.resolve(JSON.stringify(data)),
        });
      }
      if (url.includes("/api/business") && options?.method === "POST") {
        const data = {
          id: "new-biz-id",
          name: "New Shop",
          slug: "new-shop",
        };
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(data),
          text: () => Promise.resolve(JSON.stringify(data)),
        });
      }
      return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve("") });
    });

    renderOnboardingPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/business name/i)).toBeInTheDocument();
    });

    const nameInput = screen.getByLabelText(/business name/i);
    const submitButton = screen.getByRole("button", { name: /create business/i });

    await user.type(nameInput, "New Shop");
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/staff dashboard/i)).toBeInTheDocument();
    });
  });

  it("shows error message on failed business creation", async () => {
    const user = userEvent.setup();

    mockFetch.mockImplementation((url: string, options?: RequestInit) => {
      if (url.includes("/api/auth/me")) {
        const data = {
          userId: "user-1",
          email: "test@example.com",
          businesses: [],
        };
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(data),
          text: () => Promise.resolve(JSON.stringify(data)),
        });
      }
      if (url.includes("/api/business") && options?.method === "POST") {
        const errorData = { detail: "Slug already exists" };
        return Promise.resolve({
          ok: false,
          status: 409,
          json: () => Promise.resolve(errorData),
          text: () => Promise.resolve(JSON.stringify(errorData)),
        });
      }
      return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve("") });
    });

    renderOnboardingPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/business name/i)).toBeInTheDocument();
    });

    const nameInput = screen.getByLabelText(/business name/i);
    const submitButton = screen.getByRole("button", { name: /create business/i });

    await user.type(nameInput, "Existing Shop");
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/slug already exists/i)).toBeInTheDocument();
    });
  });

  it("disables submit button while creating", async () => {
    const user = userEvent.setup();

    mockFetch.mockImplementation((url: string, options?: RequestInit) => {
      if (url.includes("/api/auth/me")) {
        const data = {
          userId: "user-1",
          email: "test@example.com",
          businesses: [],
        };
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(data),
          text: () => Promise.resolve(JSON.stringify(data)),
        });
      }
      if (url.includes("/api/business") && options?.method === "POST") {
        return new Promise(() => {}); // Never resolves
      }
      return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve("") });
    });

    renderOnboardingPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/business name/i)).toBeInTheDocument();
    });

    const nameInput = screen.getByLabelText(/business name/i);
    const submitButton = screen.getByRole("button", { name: /create business/i });

    await user.type(nameInput, "Test Shop");
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /creating/i })).toBeDisabled();
    });
  });
});
