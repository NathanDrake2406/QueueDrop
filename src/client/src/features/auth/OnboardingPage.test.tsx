import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useRouter } from "next/navigation";
import { OnboardingPage } from "./OnboardingPage";
import { AuthProvider } from "./AuthContext";

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

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

function renderOnboardingPage(authenticated: boolean = true) {
  // Set up localStorage for authenticated state
  if (authenticated) {
    localStorage.setItem("auth_token", "test-token");
  }

  return render(
    <AuthProvider>
      <OnboardingPage />
    </AuthProvider>
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
      expect(mockReplace).toHaveBeenCalledWith("/login");
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
      expect(mockReplace).toHaveBeenCalledWith("/staff/existing-shop");
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
      expect(mockReplace).toHaveBeenCalledWith("/staff/new-shop");
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
