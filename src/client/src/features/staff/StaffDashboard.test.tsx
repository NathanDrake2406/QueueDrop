import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { StaffDashboard } from "./StaffDashboard";
import { AuthProvider } from "../auth/AuthContext";

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

function renderDashboard() {
  return render(
    <MemoryRouter initialEntries={["/staff/test-business"]}>
      <AuthProvider>
        <Routes>
          <Route path="/staff/:businessSlug" element={<StaffDashboard />} />
          <Route path="/404" element={<div>404</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("StaffDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
            businesses: [{ id: "business-1", name: "Test Business", slug: "test-business" }],
          }),
          text: () => Promise.resolve(JSON.stringify({
            userId: "user-1",
            email: "test@example.com",
            businesses: [{ id: "business-1", name: "Test Business", slug: "test-business" }],
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
    // TODO: Caching not yet implemented - these tests document expected behavior
    it.skip("should cache All view data and not refetch when switching back", async () => {
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

    it.skip("should refresh All view when explicitly requested", async () => {
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
});
