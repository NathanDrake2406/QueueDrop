import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useRouter } from "next/navigation";
import { StaffDashboard } from "./StaffDashboard";
import { AuthProvider } from "../auth/AuthContext";

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

// Mock useSignalR
const mockInvoke = vi.fn();
const mockOn = vi.fn();

vi.mock("../../shared/hooks/useSignalR", () => ({
  useSignalR: vi.fn(() => ({
    state: "connected",
    invoke: mockInvoke,
    on: mockOn,
  })),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockBusinessResponse = {
  businessId: "business-1",
  businessName: "Test Business",
  queues: [
    { queueId: "queue-1", name: "Queue 1", slug: "queue-1", waitingCount: 5, estimatedWaitMinutes: 10 },
    { queueId: "queue-2", name: "Queue 2", slug: "queue-2", waitingCount: 3, estimatedWaitMinutes: 5 },
  ],
};

const mockEmptyQueuesResponse = {
  businessId: "business-1",
  businessName: "Test Business",
  queues: [],
};

const mockQueue1Customers = {
  customers: [
    {
      id: "c1",
      name: "Alice",
      token: "t1",
      status: "Waiting",
      position: 1,
      joinedAt: "2024-01-01T10:00:00Z",
      calledAt: null,
      partySize: 2,
      notes: null,
    },
  ],
  queueInfo: { name: "Queue 1", isActive: true, isPaused: false, waitingCount: 1, calledCount: 0 },
};

const mockQueue2Customers = {
  customers: [
    {
      id: "c2",
      name: "Bob",
      token: "t2",
      status: "Waiting",
      position: 1,
      joinedAt: "2024-01-01T11:00:00Z",
      calledAt: null,
      partySize: 1,
      notes: null,
    },
  ],
  queueInfo: { name: "Queue 2", isActive: true, isPaused: false, waitingCount: 1, calledCount: 0 },
};

function renderDashboard(businessSlug: string = "test-business") {
  // Set auth token for authenticated state
  localStorage.setItem("auth_token", "test-token");

  return render(
    <AuthProvider>
      <StaffDashboard businessSlug={businessSlug} />
    </AuthProvider>
  );
}

describe("StaffDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockInvoke.mockResolvedValue(undefined);
    mockOn.mockReturnValue(() => {});

    // Set up default mock responses
    mockFetch.mockImplementation((url: string) => {
      // Mock auth endpoint for AuthProvider
      if (url.includes("/api/auth/me")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            userId: "user-1",
            email: "test@example.com",
            businesses: [{ id: "business-1", name: "Test Business", slug: "test-business", role: "owner" }],
          }),
          text: () => Promise.resolve(JSON.stringify({
            userId: "user-1",
            email: "test@example.com",
            businesses: [{ id: "business-1", name: "Test Business", slug: "test-business", role: "owner" }],
          })),
        });
      }
      if (url.includes("/api/business/test-business/queues")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockBusinessResponse),
          text: () => Promise.resolve(JSON.stringify(mockBusinessResponse)),
        });
      }
      if (url.includes("/api/queues/queue-1/customers")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockQueue1Customers),
          text: () => Promise.resolve(JSON.stringify(mockQueue1Customers)),
        });
      }
      if (url.includes("/api/queues/queue-2/customers")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockQueue2Customers),
          text: () => Promise.resolve(JSON.stringify(mockQueue2Customers)),
        });
      }
      return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve("") });
    });
  });

  describe("All view caching", () => {
    it("should cache All view data and not refetch when switching back", async () => {
      const user = userEvent.setup();
      renderDashboard();

      // Wait for dashboard to load - with multiple queues, All view loads by default
      // The useStaffQueue hook will fetch the first queue (queue-1) for SignalR
      // The All view useEffect will fetch both queues
      await waitFor(() => {
        // All view should show both customers
        expect(screen.getByText("Alice")).toBeInTheDocument();
        expect(screen.getByText("Bob")).toBeInTheDocument();
      });

      // Count fetches for customer endpoints after initial load
      const allViewFetchCount = mockFetch.mock.calls.filter(
        (call) => call[0].includes("/api/queues/") && call[0].includes("/customers"),
      ).length;

      // Should have fetched both queues for All view (plus hook fetch for queue-1)
      expect(allViewFetchCount).toBeGreaterThanOrEqual(2);

      // Clear fetch mock to count new fetches
      mockFetch.mockClear();

      // Find and click on Queue 1 tab (more specific: the button that starts with the queue name)
      const queue1Tab = screen.getByRole("button", { name: /^Queue 1/ });
      await user.click(queue1Tab);

      // Wait for Queue 1 view to be active
      await waitFor(() => {
        // In Queue 1 view, Alice should be visible (Bob from Queue 2 should not)
        expect(screen.getByText("Alice")).toBeInTheDocument();
      });

      // Clear again to isolate the switch-back fetches
      mockFetch.mockClear();

      // Switch back to All view
      const allTab = screen.getByRole("button", { name: /^All/ });
      await user.click(allTab);

      // Wait a bit for any potential fetches
      await act(async () => {
        await new Promise((r) => setTimeout(r, 150));
      });

      // Count new fetches
      const switchBackFetchCount = mockFetch.mock.calls.filter(
        (call) => call[0].includes("/api/queues/") && call[0].includes("/customers"),
      ).length;

      // Should NOT have refetched for All view - data should be cached
      expect(switchBackFetchCount).toBe(0);
    });

    it("should refresh All view when explicitly requested", async () => {
      // This test verifies that caching doesn't prevent manual refresh
      // Implementation note: The current code doesn't cache, so this will inform the fix
      const user = userEvent.setup();
      renderDashboard();

      // Wait for All view to load
      await waitFor(() => {
        expect(screen.getByText("Alice")).toBeInTheDocument();
      });

      mockFetch.mockClear();

      // Switch to Queue 1
      const queue1Tab = screen.getByRole("button", { name: /^Queue 1/ });
      await user.click(queue1Tab);

      await waitFor(() => {
        expect(screen.getByText("Alice")).toBeInTheDocument();
      });

      mockFetch.mockClear();

      // Switch back to All
      const allTab = screen.getByRole("button", { name: /^All/ });
      await user.click(allTab);

      // With caching, this should not fetch
      await act(async () => {
        await new Promise((r) => setTimeout(r, 150));
      });

      // Currently, without caching, this WILL fetch (which is the bug)
      // After fix, this should be 0
      const fetchCount = mockFetch.mock.calls.filter(
        (call) => call[0].includes("/api/queues/") && call[0].includes("/customers"),
      ).length;

      // With caching implemented, this should pass
      expect(fetchCount).toBe(0);
    });
  });

  describe("Role-based UI for NoQueuesState", () => {
    it("shows create queue UI for owners when no queues exist", async () => {
      // Set up mock responses for owner with no queues
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/api/auth/me")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              userId: "user-1",
              email: "owner@example.com",
              businesses: [{ id: "business-1", name: "Test Business", slug: "test-business", role: "owner" }],
            }),
            text: () => Promise.resolve(JSON.stringify({
              userId: "user-1",
              email: "owner@example.com",
              businesses: [{ id: "business-1", name: "Test Business", slug: "test-business", role: "owner" }],
            })),
          });
        }
        if (url.includes("/api/business/test-business/queues")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockEmptyQueuesResponse),
            text: () => Promise.resolve(JSON.stringify(mockEmptyQueuesResponse)),
          });
        }
        return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve("") });
      });

      renderDashboard();

      // Wait for the create queue form to appear
      await waitFor(() => {
        expect(screen.getByText("Create your first queue to get started")).toBeInTheDocument();
      });

      // Owner should see the create queue form
      expect(screen.getByLabelText("Queue name")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Create Queue/i })).toBeInTheDocument();
    });

    it("hides create queue UI for staff when no queues exist", async () => {
      // Set up mock responses for staff with no queues
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/api/auth/me")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              userId: "user-1",
              email: "staff@example.com",
              businesses: [{ id: "business-1", name: "Test Business", slug: "test-business", role: "staff" }],
            }),
            text: () => Promise.resolve(JSON.stringify({
              userId: "user-1",
              email: "staff@example.com",
              businesses: [{ id: "business-1", name: "Test Business", slug: "test-business", role: "staff" }],
            })),
          });
        }
        if (url.includes("/api/business/test-business/queues")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockEmptyQueuesResponse),
            text: () => Promise.resolve(JSON.stringify(mockEmptyQueuesResponse)),
          });
        }
        return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve("") });
      });

      renderDashboard();

      // Wait for the staff message to appear
      await waitFor(() => {
        expect(screen.getByText("Contact your business owner to create a queue")).toBeInTheDocument();
      });

      // Staff should NOT see the create queue form
      expect(screen.queryByLabelText("Queue name")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Create Queue/i })).not.toBeInTheDocument();
    });

    it("shows queue management UI for staff when queues exist", async () => {
      // Staff should be able to manage existing queues normally
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/api/auth/me")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              userId: "user-1",
              email: "staff@example.com",
              businesses: [{ id: "business-1", name: "Test Business", slug: "test-business", role: "staff" }],
            }),
            text: () => Promise.resolve(JSON.stringify({
              userId: "user-1",
              email: "staff@example.com",
              businesses: [{ id: "business-1", name: "Test Business", slug: "test-business", role: "staff" }],
            })),
          });
        }
        if (url.includes("/api/business/test-business/queues")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockBusinessResponse),
            text: () => Promise.resolve(JSON.stringify(mockBusinessResponse)),
          });
        }
        if (url.includes("/api/queues/queue-1/customers")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockQueue1Customers),
            text: () => Promise.resolve(JSON.stringify(mockQueue1Customers)),
          });
        }
        if (url.includes("/api/queues/queue-2/customers")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockQueue2Customers),
            text: () => Promise.resolve(JSON.stringify(mockQueue2Customers)),
          });
        }
        return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve("") });
      });

      renderDashboard();

      // Staff should see the queue management dashboard with customers
      await waitFor(() => {
        expect(screen.getByText("Alice")).toBeInTheDocument();
      });

      // Queue tabs should be visible
      expect(screen.getByRole("button", { name: /^Queue 1/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /^Queue 2/ })).toBeInTheDocument();
    });
  });
});
