import React from "react";
import "@testing-library/dom";
import "@testing-library/jest-dom/vitest";
import { afterEach, vi, beforeEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Mock localStorage (jsdom's implementation may be incomplete in Node 22+)
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
  };
})();
Object.defineProperty(window, "localStorage", { value: localStorageMock });

// Mock next/navigation globally
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  })),
  usePathname: vi.fn(() => "/"),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  useParams: vi.fn(() => ({})),
  notFound: vi.fn(),
  redirect: vi.fn(),
}));

// Mock next/link - render as regular anchor
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// Cleanup after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Reset localStorage before each test
beforeEach(() => {
  localStorage.clear();
});

// Mock ResizeObserver (not available in jsdom)
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock IntersectionObserver (not available in jsdom)
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock matchMedia (not available in jsdom, needed for dark mode)
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock Notification API
Object.defineProperty(window, "Notification", {
  writable: true,
  value: {
    permission: "default",
    requestPermission: vi.fn().mockResolvedValue("granted"),
  },
});

// Mock service worker registration
Object.defineProperty(navigator, "serviceWorker", {
  writable: true,
  value: {
    register: vi.fn().mockResolvedValue({ scope: "/" }),
    ready: Promise.resolve({ pushManager: {} }),
  },
});
