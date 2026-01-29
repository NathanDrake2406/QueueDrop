import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useDarkMode } from "./useDarkMode";

describe("useDarkMode", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  it("returns false by default (SSR-safe initial value)", () => {
    const { result } = renderHook(() => useDarkMode());
    expect(result.current[0]).toBe(false);
  });

  it("reads dark mode preference from localStorage on mount", async () => {
    localStorage.setItem("theme", "dark");

    const { result } = renderHook(() => useDarkMode());

    // After mount, should read from localStorage and be true (dark mode)
    await waitFor(() => {
      expect(result.current[0]).toBe(true);
    });
  });

  it("reads light mode preference from localStorage on mount", async () => {
    localStorage.setItem("theme", "light");

    const { result } = renderHook(() => useDarkMode());

    await waitFor(() => {
      // Should stay false since light theme is stored
      expect(result.current[0]).toBe(false);
    });
  });

  it("toggles dark mode and saves to localStorage", async () => {
    const { result } = renderHook(() => useDarkMode());

    // Wait for initial mount
    await waitFor(() => {
      expect(result.current[0]).toBe(false);
    });

    // Toggle to dark mode
    act(() => {
      result.current[1](true);
    });

    await waitFor(() => {
      expect(result.current[0]).toBe(true);
      expect(localStorage.getItem("theme")).toBe("dark");
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });

    // Toggle back to light mode
    act(() => {
      result.current[1](false);
    });

    await waitFor(() => {
      expect(result.current[0]).toBe(false);
      expect(localStorage.getItem("theme")).toBe("light");
      expect(document.documentElement.classList.contains("dark")).toBe(false);
    });
  });

  it("respects system preference when no stored theme", async () => {
    // Mock system preference for dark mode
    const matchMediaMock = vi.fn().mockImplementation((query: string) => ({
      matches: query === "(prefers-color-scheme: dark)",
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: matchMediaMock,
    });

    const { result } = renderHook(() => useDarkMode());

    await waitFor(() => {
      expect(result.current[0]).toBe(true);
    });
  });
});
