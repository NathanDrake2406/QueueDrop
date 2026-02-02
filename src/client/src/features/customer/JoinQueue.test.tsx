import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { JoinQueue } from "./JoinQueue";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  notFound: vi.fn(),
}));

// Mock localStorage
const localStorageMock = {
  store: {} as Record<string, string>,
  getItem: vi.fn((key: string) => localStorageMock.store[key] || null),
  setItem: vi.fn((key: string, value: string) => {
    localStorageMock.store[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete localStorageMock.store[key];
  }),
  clear: vi.fn(() => {
    localStorageMock.store = {};
  }),
};

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
});

// Mock fetch with proper Response object
const mockFetch = vi.fn();
global.fetch = mockFetch;

function createMockResponse(data: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  };
}

const mockServerData = {
  businessId: "b-1",
  businessName: "Test Shop",
  queues: [
    {
      queueId: "q-1",
      name: "Main Queue",
      slug: "main-queue",
      waitingCount: 3,
      estimatedWaitMinutes: 10,
    },
  ],
};

describe("JoinQueue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    mockFetch.mockResolvedValue(createMockResponse(mockServerData));
  });

  describe("without serverData (client-side fetch)", () => {
    it("should show loading state initially", () => {
      render(<JoinQueue businessSlug="test-shop" />);
      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });

    it("should fetch data from API when serverData is not provided", async () => {
      render(<JoinQueue businessSlug="test-shop" />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith("/api/business/test-shop/queues");
      });
    });

    it("should show business name after fetch completes", async () => {
      render(<JoinQueue businessSlug="test-shop" />);

      await waitFor(() => {
        expect(screen.getByText("Test Shop")).toBeInTheDocument();
      });
    });
  });

  describe("with serverData (server-side fetch)", () => {
    it("should render immediately with serverData (no loading spinner)", () => {
      render(
        <JoinQueue
          businessSlug="test-shop"
          queueSlug="main-queue"
          serverData={mockServerData}
        />
      );

      // Should NOT show loading state
      expect(screen.queryByText("Loading...")).not.toBeInTheDocument();

      // Should show business name immediately
      expect(screen.getByText("Test Shop")).toBeInTheDocument();
    });

    it("should NOT fetch when serverData is provided", () => {
      render(
        <JoinQueue
          businessSlug="test-shop"
          queueSlug="main-queue"
          serverData={mockServerData}
        />
      );

      // Fetch should NOT be called for business data
      expect(mockFetch).not.toHaveBeenCalledWith(
        expect.stringContaining("/api/business/")
      );
    });

    it("should show queue name from serverData", () => {
      render(
        <JoinQueue
          businessSlug="test-shop"
          queueSlug="main-queue"
          serverData={mockServerData}
        />
      );

      expect(screen.getByText("Join Main Queue")).toBeInTheDocument();
    });

    it("should show join form when queue is specified in URL", () => {
      render(
        <JoinQueue
          businessSlug="test-shop"
          queueSlug="main-queue"
          serverData={mockServerData}
        />
      );

      expect(screen.getByLabelText("Your name")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Join Queue" })).toBeInTheDocument();
    });
  });

  describe("with multiple queues", () => {
    const multiQueueData = {
      businessId: "b-1",
      businessName: "Test Shop",
      queues: [
        {
          queueId: "q-1",
          name: "Main Queue",
          slug: "main-queue",
          waitingCount: 3,
          estimatedWaitMinutes: 10,
        },
        {
          queueId: "q-2",
          name: "Express Queue",
          slug: "express-queue",
          waitingCount: 1,
          estimatedWaitMinutes: 5,
        },
      ],
    };

    it("should show queue selector when no queue is specified in URL", () => {
      render(
        <JoinQueue businessSlug="test-shop" serverData={multiQueueData} />
      );

      expect(screen.getByRole("heading", { name: "Choose a queue" })).toBeInTheDocument();
    });

    it("should show both queue options", () => {
      render(
        <JoinQueue businessSlug="test-shop" serverData={multiQueueData} />
      );

      expect(screen.getByRole("button", { name: /Main Queue/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Express Queue/i })).toBeInTheDocument();
    });
  });

  describe("error handling", () => {
    it("should fall back to client fetch when serverData is undefined", async () => {
      render(<JoinQueue businessSlug="test-shop" />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });
    });
  });
});
