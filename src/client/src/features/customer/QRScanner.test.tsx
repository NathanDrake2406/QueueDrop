import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QRScanner } from "./QRScanner";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock state for html5-qrcode - must be declared before vi.mock
let mockIsScanning = false;
let mockStartFn: ReturnType<typeof vi.fn> = vi.fn();
let mockStopFn: ReturnType<typeof vi.fn> = vi.fn();

// Mock html5-qrcode module - factory must be self-contained
vi.mock("html5-qrcode", async () => {
  return {
    Html5Qrcode: class {
      start(...args: unknown[]) {
        return mockStartFn(...args);
      }
      stop() {
        return mockStopFn();
      }
      get isScanning() {
        return mockIsScanning;
      }
    },
  };
});

describe("QRScanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsScanning = false;
    mockStartFn = vi.fn().mockImplementation(() => {
      mockIsScanning = true;
      return Promise.resolve();
    });
    mockStopFn = vi.fn().mockImplementation(() => {
      mockIsScanning = false;
      return Promise.resolve();
    });
  });

  it("should render Start Camera button", () => {
    render(<QRScanner />);
    expect(
      screen.getByRole("button", { name: /start camera/i })
    ).toBeInTheDocument();
  });

  it("should render scanner area placeholder when not scanning", () => {
    render(<QRScanner />);
    expect(screen.getByText(/point your camera/i)).toBeInTheDocument();
  });

  it("should show Stop Scanning button when scanning starts", async () => {
    const user = userEvent.setup();
    render(<QRScanner />);

    await user.click(screen.getByRole("button", { name: /start camera/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /stop scanning/i })
      ).toBeInTheDocument();
    });
  });

  it("should start scanner when Start Camera clicked", async () => {
    const user = userEvent.setup();
    render(<QRScanner />);

    await user.click(screen.getByRole("button", { name: /start camera/i }));

    await waitFor(() => {
      expect(mockStartFn).toHaveBeenCalledWith(
        { facingMode: "environment" },
        expect.any(Object),
        expect.any(Function),
        expect.any(Function)
      );
    });
  });

  it("should handle camera permission denial gracefully", async () => {
    mockStartFn = vi.fn().mockRejectedValue(new Error("Permission denied"));
    const user = userEvent.setup();
    render(<QRScanner />);

    await user.click(screen.getByRole("button", { name: /start camera/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/camera permission denied/i)
      ).toBeInTheDocument();
    });
  });

  it("should handle generic camera errors gracefully", async () => {
    mockStartFn = vi.fn().mockRejectedValue(new Error("NotReadableError"));
    const user = userEvent.setup();
    render(<QRScanner />);

    await user.click(screen.getByRole("button", { name: /start camera/i }));

    await waitFor(() => {
      expect(screen.getByText(/could not start camera/i)).toBeInTheDocument();
    });
  });

  it("should stop scanner when Stop Scanning is clicked", async () => {
    const user = userEvent.setup();
    render(<QRScanner />);

    await user.click(screen.getByRole("button", { name: /start camera/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /stop scanning/i })
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /stop scanning/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /start camera/i })
      ).toBeInTheDocument();
    });
  });

  it("should navigate home when back button is clicked", async () => {
    const user = userEvent.setup();
    render(<QRScanner />);

    // Click the back button (first button in header)
    const backButton = screen.getAllByRole("button")[0];
    await user.click(backButton);

    expect(mockPush).toHaveBeenCalledWith("/");
  });

  it("should show manual entry option", () => {
    render(<QRScanner />);
    expect(
      screen.getByText(/or enter the queue code manually/i)
    ).toBeInTheDocument();
  });
});
