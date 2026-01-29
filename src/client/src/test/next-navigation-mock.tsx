/**
 * Mock implementation for next/navigation hooks.
 * Used in unit tests to simulate Next.js App Router navigation.
 */
import { vi } from "vitest";
import type { ReactNode } from "react";

// Create mock functions that can be configured per test
export const mockPush = vi.fn();
export const mockReplace = vi.fn();
export const mockBack = vi.fn();
export const mockForward = vi.fn();
export const mockRefresh = vi.fn();
export const mockPrefetch = vi.fn();

// Default pathname - can be overridden in tests
let currentPathname = "/";
let currentSearchParams = new URLSearchParams();

export function setMockPathname(pathname: string) {
  currentPathname = pathname;
}

export function setMockSearchParams(params: Record<string, string>) {
  currentSearchParams = new URLSearchParams(params);
}

export function resetNavigationMocks() {
  mockPush.mockReset();
  mockReplace.mockReset();
  mockBack.mockReset();
  mockForward.mockReset();
  mockRefresh.mockReset();
  mockPrefetch.mockReset();
  currentPathname = "/";
  currentSearchParams = new URLSearchParams();
}

// Mock useRouter
export const useRouter = vi.fn(() => ({
  push: mockPush,
  replace: mockReplace,
  back: mockBack,
  forward: mockForward,
  refresh: mockRefresh,
  prefetch: mockPrefetch,
}));

// Mock usePathname
export const usePathname = vi.fn(() => currentPathname);

// Mock useSearchParams
export const useSearchParams = vi.fn(() => currentSearchParams);

// Mock useParams - configurable per test
let currentParams: Record<string, string> = {};

export function setMockParams(params: Record<string, string>) {
  currentParams = params;
}

export const useParams = vi.fn(() => currentParams);

// Mock notFound
export const notFound = vi.fn();

// Mock redirect
export const redirect = vi.fn();

// Provider wrapper for tests that need auth context
import { AuthProvider } from "../features/auth/AuthContext";

interface TestWrapperProps {
  children: ReactNode;
}

export function TestWrapper({ children }: TestWrapperProps) {
  return <AuthProvider>{children}</AuthProvider>;
}

// Setup the vi.mock for next/navigation - call this in test setup
export function setupNextNavigationMock() {
  vi.mock("next/navigation", () => ({
    useRouter,
    usePathname,
    useSearchParams,
    useParams,
    notFound,
    redirect,
  }));
}
