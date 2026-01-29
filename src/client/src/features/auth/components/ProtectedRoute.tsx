"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "../hooks/useAuth";

interface Props {
  children: React.ReactNode;
  requireBusiness?: string; // Optional: require membership in specific business
}

export function ProtectedRoute({ children, requireBusiness }: Props) {
  const { isAuthenticated, isLoading, businesses } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      // Store the intended destination for redirect after login
      const returnUrl = encodeURIComponent(pathname);
      router.replace(`/login?returnUrl=${returnUrl}`);
      return;
    }

    if (requireBusiness && !businesses.some((b) => b.slug === requireBusiness)) {
      router.replace("/404");
    }
  }, [isAuthenticated, isLoading, businesses, requireBusiness, router, pathname]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-400">Redirecting...</div>
      </div>
    );
  }

  if (requireBusiness && !businesses.some((b) => b.slug === requireBusiness)) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-400">Redirecting...</div>
      </div>
    );
  }

  return <>{children}</>;
}
