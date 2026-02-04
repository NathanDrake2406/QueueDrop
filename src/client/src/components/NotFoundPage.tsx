"use client";

import Link from "next/link";
import { useDarkMode } from "@/shared/hooks/useDarkMode";

export function NotFoundPage() {
  const [isDark] = useDarkMode();

  return (
    <div
      className={`min-h-screen flex items-center justify-center p-4 transition-colors ${isDark ? "bg-slate-950" : "bg-slate-50"}`}
    >
      <div className="text-center">
        <p
          className={`text-8xl font-display font-bold mb-4 ${isDark ? "text-slate-800" : "text-slate-200"}`}
        >
          404
        </p>
        <p className={`mb-8 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
          This page doesn&apos;t exist
        </p>
        <Link
          href="/"
          className="inline-block px-6 py-3 bg-gradient-to-r from-teal-500 via-emerald-500 to-teal-400 text-slate-950 font-semibold rounded-none hover:brightness-110 transition-all shadow-[0_14px_30px_rgba(16,185,129,0.28)]"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}
