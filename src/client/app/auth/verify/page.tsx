"use client";

import { Suspense } from "react";
import { VerifyPage } from "@/features/auth/VerifyPage";

function VerifyLoading() {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 mb-6">
          <svg
            className="w-12 h-12 animate-spin text-teal-500"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        </div>
        <p className="text-slate-400">Loading...</p>
      </div>
    </div>
  );
}

export default function Verify() {
  return (
    <Suspense fallback={<VerifyLoading />}>
      <VerifyPage />
    </Suspense>
  );
}
