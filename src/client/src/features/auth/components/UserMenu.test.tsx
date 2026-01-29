import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useRouter } from "next/navigation";
import { UserMenu } from "./UserMenu";
import { AuthProvider } from "../AuthContext";

// Get mock router
const mockPush = vi.fn();
const mockReplace = vi.fn();

vi.mocked(useRouter).mockReturnValue({
  push: mockPush,
  replace: mockReplace,
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
});

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

function renderUserMenu(options: {
  authenticated?: boolean;
  businesses?: Array<{ id: string; name: string; slug: string }>;
} = {}) {
  const { authenticated = true, businesses = [] } = options;

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
      <UserMenu />
    </AuthProvider>
  );
}

describe("UserMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("returns null when no user is authenticated", async () => {
    const { container } = renderUserMenu({ authenticated: false });

    await waitFor(() => {
      // After auth check completes, menu should not render anything
      // We need to wait for the loading state to resolve
    });

    // Give time for auth state to settle
    await new Promise((r) => setTimeout(r, 100));

    // The UserMenu returns null when no user, so container should be mostly empty
    expect(container.querySelector("button")).toBeNull();
  });

  it("renders avatar with first letter of email", async () => {
    renderUserMenu({ authenticated: true });

    await waitFor(() => {
      expect(screen.getByText("T")).toBeInTheDocument(); // First letter of "test@example.com"
    });
  });

  it("opens dropdown on click", async () => {
    const user = userEvent.setup();
    renderUserMenu({ authenticated: true });

    await waitFor(() => {
      expect(screen.getByText("T")).toBeInTheDocument();
    });

    // Click the menu button
    const menuButton = screen.getByRole("button", { expanded: false });
    await user.click(menuButton);

    // Dropdown should now be visible
    expect(screen.getByText("Signed in as")).toBeInTheDocument();
    // Email appears twice (in button and dropdown), so use getAllByText
    expect(screen.getAllByText("test@example.com")).toHaveLength(2);
    expect(screen.getByText("Sign out")).toBeInTheDocument();
  });

  it("closes dropdown when clicking outside", async () => {
    const user = userEvent.setup();
    renderUserMenu({ authenticated: true });

    await waitFor(() => {
      expect(screen.getByText("T")).toBeInTheDocument();
    });

    // Open menu
    const menuButton = screen.getByRole("button", { expanded: false });
    await user.click(menuButton);

    expect(screen.getByText("Sign out")).toBeInTheDocument();

    // Click outside (simulate mousedown on document body)
    fireEvent.mouseDown(document.body);

    await waitFor(() => {
      expect(screen.queryByText("Sign out")).not.toBeInTheDocument();
    });
  });

  it("logs out and navigates to /login on sign out click", async () => {
    const user = userEvent.setup();
    renderUserMenu({ authenticated: true });

    await waitFor(() => {
      expect(screen.getByText("T")).toBeInTheDocument();
    });

    // Open menu
    await user.click(screen.getByRole("button", { expanded: false }));

    // Click sign out
    await user.click(screen.getByText("Sign out"));

    await waitFor(() => {
      // UserMenu uses router.push (adds to history) for logout
      expect(mockPush).toHaveBeenCalledWith("/login");
    });

    expect(localStorage.getItem("auth_token")).toBeNull();
  });

  it("shows business switcher when multiple businesses", async () => {
    const user = userEvent.setup();
    renderUserMenu({
      authenticated: true,
      businesses: [
        { id: "biz-1", name: "Shop One", slug: "shop-one" },
        { id: "biz-2", name: "Shop Two", slug: "shop-two" },
      ],
    });

    await waitFor(() => {
      expect(screen.getByText("T")).toBeInTheDocument();
    });

    // Open menu
    await user.click(screen.getByRole("button", { expanded: false }));

    expect(screen.getByText("Switch business")).toBeInTheDocument();
    expect(screen.getByText("Shop One")).toBeInTheDocument();
    expect(screen.getByText("Shop Two")).toBeInTheDocument();
  });

  it("shows single business link when only one business", async () => {
    const user = userEvent.setup();
    renderUserMenu({
      authenticated: true,
      businesses: [{ id: "biz-1", name: "My Only Shop", slug: "my-only-shop" }],
    });

    await waitFor(() => {
      expect(screen.getByText("T")).toBeInTheDocument();
    });

    // Open menu
    await user.click(screen.getByRole("button", { expanded: false }));

    expect(screen.getByText("My Only Shop")).toBeInTheDocument();
    expect(screen.queryByText("Switch business")).not.toBeInTheDocument();
  });

  it("navigates to business dashboard on business click", async () => {
    const user = userEvent.setup();
    renderUserMenu({
      authenticated: true,
      businesses: [{ id: "biz-1", name: "Test Shop", slug: "test-shop" }],
    });

    await waitFor(() => {
      expect(screen.getByText("T")).toBeInTheDocument();
    });

    // Open menu
    await user.click(screen.getByRole("button", { expanded: false }));

    // Click the business
    await user.click(screen.getByText("Test Shop"));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/staff/test-shop");
    });
  });

  it("does not show business section when no businesses", async () => {
    const user = userEvent.setup();
    renderUserMenu({
      authenticated: true,
      businesses: [],
    });

    await waitFor(() => {
      expect(screen.getByText("T")).toBeInTheDocument();
    });

    // Open menu
    await user.click(screen.getByRole("button", { expanded: false }));

    expect(screen.queryByText("Switch business")).not.toBeInTheDocument();
    expect(screen.getByText("Sign out")).toBeInTheDocument();
  });
});
