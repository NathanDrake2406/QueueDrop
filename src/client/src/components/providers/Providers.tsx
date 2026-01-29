"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@/features/auth/AuthContext";
import { ErrorBoundary } from "@/shared/components/ErrorBoundary";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <AuthProvider>{children}</AuthProvider>
    </ErrorBoundary>
  );
}
