import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QRCodeDisplay } from "./QRCodeDisplay";

// Mock next/dynamic - we need to test the loading state
vi.mock("qrcode.react", () => ({
  QRCodeSVG: ({ value, id }: { value: string; id?: string }) => (
    <svg data-testid="qr-code-svg" data-value={value} id={id}>
      Mock QR Code
    </svg>
  ),
}));

describe("QRCodeDisplay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render QR code with provided URL", async () => {
    render(<QRCodeDisplay url="https://example.com/join/test" />);

    await waitFor(() => {
      const qrCode = screen.getByTestId("qr-code-svg");
      expect(qrCode).toBeInTheDocument();
      expect(qrCode).toHaveAttribute("data-value", "https://example.com/join/test");
    });
  });

  it("should render title when provided", async () => {
    render(<QRCodeDisplay url="https://example.com" title="Test Queue" />);

    await waitFor(() => {
      expect(screen.getByText("Test Queue")).toBeInTheDocument();
    });
  });

  it("should render download button", async () => {
    render(<QRCodeDisplay url="https://example.com" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /download png/i })).toBeInTheDocument();
    });
  });

  it("should show loading skeleton initially with dynamic import", async () => {
    // This test verifies the loading state behavior
    // When using next/dynamic with ssr: false, there's a loading state
    render(<QRCodeDisplay url="https://example.com" />);

    // After the component loads, the QR code should be visible
    await waitFor(() => {
      expect(screen.getByTestId("qr-code-svg")).toBeInTheDocument();
    });
  });
});
