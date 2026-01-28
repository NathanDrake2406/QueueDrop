import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { LoginPage } from "./LoginPage";
import { AuthProvider } from "./AuthContext";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

function renderLoginPage() {
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    </MemoryRouter>
  );
}

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    // Default: auth/me returns not authenticated
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/auth/me")) {
        return Promise.resolve({ ok: false, status: 401, text: () => Promise.resolve("") });
      }
      return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve("") });
    });
  });

  it("renders email form", async () => {
    renderLoginPage();

    // Wait for auth state to settle
    await waitFor(() => {
      expect(screen.getByPlaceholderText("you@example.com")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /continue with email/i })).toBeInTheDocument();
    expect(screen.getByText(/sign in to queuedrop/i)).toBeInTheDocument();
  });

  it("submits email and shows success message", async () => {
    const user = userEvent.setup();

    mockFetch.mockImplementation((url: string, options?: RequestInit) => {
      if (url.includes("/api/auth/me")) {
        return Promise.resolve({ ok: false, status: 401, text: () => Promise.resolve("") });
      }
      if (url.includes("/api/auth/send-magic-link") && options?.method === "POST") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}), text: () => Promise.resolve("{}") });
      }
      return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve("") });
    });

    renderLoginPage();

    await waitFor(() => {
      expect(screen.getByPlaceholderText("you@example.com")).toBeInTheDocument();
    });

    const emailInput = screen.getByPlaceholderText("you@example.com");
    const submitButton = screen.getByRole("button", { name: /continue with email/i });

    await user.type(emailInput, "test@example.com");
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/check your email/i)).toBeInTheDocument();
    });
    // After sending, it shows the email in a message
    expect(screen.getByText(/test@example.com/)).toBeInTheDocument();
  });

  it("shows error on failed submission", async () => {
    const user = userEvent.setup();

    mockFetch.mockImplementation((url: string, options?: RequestInit) => {
      if (url.includes("/api/auth/me")) {
        return Promise.resolve({ ok: false, status: 401, text: () => Promise.resolve("") });
      }
      if (url.includes("/api/auth/send-magic-link") && options?.method === "POST") {
        return Promise.resolve({
          ok: false,
          status: 400,
          json: () => Promise.resolve({ detail: "Invalid email format" }),
          text: () => Promise.resolve(JSON.stringify({ detail: "Invalid email format" })),
        });
      }
      return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve("") });
    });

    renderLoginPage();

    await waitFor(() => {
      expect(screen.getByPlaceholderText("you@example.com")).toBeInTheDocument();
    });

    const emailInput = screen.getByPlaceholderText("you@example.com");
    const submitButton = screen.getByRole("button", { name: /continue with email/i });

    // Use a valid email format that the API will reject
    await user.type(emailInput, "bad@example.com");
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/invalid email format/i)).toBeInTheDocument();
    });
  });

  it("disables button while submitting", async () => {
    const user = userEvent.setup();

    // Make the request hang
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/auth/me")) {
        return Promise.resolve({ ok: false, status: 401, text: () => Promise.resolve("") });
      }
      if (url.includes("/api/auth/send-magic-link")) {
        return new Promise(() => {}); // Never resolves
      }
      return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve("") });
    });

    renderLoginPage();

    await waitFor(() => {
      expect(screen.getByPlaceholderText("you@example.com")).toBeInTheDocument();
    });

    const emailInput = screen.getByPlaceholderText("you@example.com");
    const submitButton = screen.getByRole("button", { name: /continue with email/i });

    await user.type(emailInput, "test@example.com");
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /sending/i })).toBeDisabled();
    });
  });
});
