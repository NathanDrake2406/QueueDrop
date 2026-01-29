import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { LandingPage } from "./LandingPage";
import { AuthProvider } from "@/features/auth/AuthContext";

// Mock fetch for auth context
const mockFetch = vi.fn();
global.fetch = mockFetch;

function renderLandingPage() {
  return render(
    <AuthProvider>
      <LandingPage />
    </AuthProvider>
  );
}

describe("LandingPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    // Default: not authenticated
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/auth/me")) {
        return Promise.resolve({ ok: false, status: 401, text: () => Promise.resolve("") });
      }
      return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve("") });
    });
  });

  it("renders the hero section", async () => {
    renderLandingPage();

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1, name: /queue management/i })).toBeInTheDocument();
    });
    expect(screen.getByText(/that just works/i)).toBeInTheDocument();
  });

  it("renders feature cards", async () => {
    renderLandingPage();

    await waitFor(() => {
      expect(screen.getByText("Real-time Updates")).toBeInTheDocument();
    });
    expect(screen.getByText("Push Notifications")).toBeInTheDocument();
    expect(screen.getByText("QR Code Generation")).toBeInTheDocument();
    expect(screen.getByText("Auto No-Show")).toBeInTheDocument();
    // "Staff Dashboard" appears multiple times - check for feature card heading
    expect(screen.getByRole("heading", { level: 3, name: "Staff Dashboard" })).toBeInTheDocument();
    expect(screen.getByText("No App Required")).toBeInTheDocument();
  });

  it("shows 'Get Started' link when not authenticated", async () => {
    renderLandingPage();

    await waitFor(() => {
      expect(screen.getByRole("link", { name: /get started/i })).toBeInTheDocument();
    });
  });

  it("has link to demo page", async () => {
    renderLandingPage();

    await waitFor(() => {
      expect(screen.getByRole("link", { name: /try the demo/i })).toBeInTheDocument();
    });

    const demoLink = screen.getByRole("link", { name: /try the demo/i });
    expect(demoLink).toHaveAttribute("href", "/demo");
  });

  it("has link to staff dashboard", async () => {
    renderLandingPage();

    await waitFor(() => {
      // There are multiple "Staff Dashboard" links - get the one in hero section
      const staffLinks = screen.getAllByRole("link", { name: /staff dashboard/i });
      expect(staffLinks.length).toBeGreaterThan(0);
    });

    const staffLinks = screen.getAllByRole("link", { name: /staff dashboard/i });
    expect(staffLinks[0]).toHaveAttribute("href", "/staff/demo-shop");
  });

  it("toggles dark mode when clicking the toggle button", async () => {
    const user = userEvent.setup();
    renderLandingPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/toggle dark mode/i)).toBeInTheDocument();
    });

    const toggleButton = screen.getByLabelText(/toggle dark mode/i);
    await user.click(toggleButton);

    // After clicking, dark mode should be toggled
    expect(localStorage.getItem("theme")).toBe("dark");
  });

  it("renders CTA section with demo links", async () => {
    renderLandingPage();

    await waitFor(() => {
      expect(screen.getByText(/ready to try it/i)).toBeInTheDocument();
    });

    // CTA links
    expect(screen.getByRole("link", { name: /join as customer/i })).toBeInTheDocument();
  });

  it("renders tech stack footer", async () => {
    renderLandingPage();

    await waitFor(() => {
      expect(screen.getByText("React 19")).toBeInTheDocument();
    });
    expect(screen.getByText(".NET 8")).toBeInTheDocument();
    expect(screen.getByText("SignalR")).toBeInTheDocument();
    expect(screen.getByText("PostgreSQL")).toBeInTheDocument();
  });
});
