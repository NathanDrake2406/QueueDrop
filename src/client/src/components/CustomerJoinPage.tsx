"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDarkMode } from "@/shared/hooks/useDarkMode";

export function CustomerJoinPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [isDark] = useDarkMode();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim()) {
      router.push(`/join/${code.trim().toLowerCase()}`);
    }
  };

  return (
    <div
      className={`min-h-screen transition-colors ${isDark ? "bg-slate-950 text-white" : "bg-slate-50 text-slate-900"}`}
    >
      <div className="max-w-md mx-auto px-4 py-12">
        {/* Back to home */}
        <button
          onClick={() => router.push("/")}
          className={`flex items-center gap-2 mb-8 transition-colors ${isDark ? "text-slate-500 hover:text-white" : "text-slate-500 hover:text-slate-900"}`}
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back
        </button>

        {/* Logo */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-none mb-4 shadow-[0_14px_30px_rgba(16,185,129,0.28)]">
            <svg
              className="w-8 h-8 text-white"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            Join a Queue
          </h1>
          <p className={`mt-2 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            Scan a QR code or enter the queue code
          </p>
        </div>

        {/* QR Scan Button */}
        <button
          onClick={() => router.push("/scan")}
          className={`w-full p-6 border rounded-none mb-4 transition-all group ${isDark ? "bg-slate-900 border-slate-800 hover:bg-slate-800 hover:border-slate-700" : "bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-200/50"}`}
        >
          <div className="flex items-center gap-4">
            <div
              className={`w-14 h-14 rounded-none flex items-center justify-center group-hover:bg-teal-600 transition-colors ${isDark ? "bg-teal-900/50 text-teal-400 group-hover:text-white" : "bg-teal-100 text-teal-600 group-hover:text-white"}`}
            >
              <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 11h8V3H3v8zm2-6h4v4H5V5zm8-2v8h8V3h-8zm6 6h-4V5h4v4zM3 21h8v-8H3v8zm2-6h4v4H5v-4zm13 2h-2v2h2v2h-2v-2h-2v2h-2v-2h2v-2h-2v-2h2v2h2v-2h2v2zm0 2v2h2v-2h-2zm2-2h2v-2h-2v2z" />
              </svg>
            </div>
            <div className="text-left flex-1">
              <p className="font-semibold text-lg">Scan QR Code</p>
              <p
                className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}
              >
                Use your camera to join instantly
              </p>
            </div>
            <svg
              className={`w-5 h-5 ${isDark ? "text-slate-600" : "text-slate-400"}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </div>
        </button>

        {/* Divider */}
        <div className="flex items-center gap-4 my-8">
          <div
            className={`flex-1 h-px ${isDark ? "bg-slate-800" : "bg-slate-200"}`}
          />
          <span
            className={`text-sm ${isDark ? "text-slate-500" : "text-slate-400"}`}
          >
            or enter code
          </span>
          <div
            className={`flex-1 h-px ${isDark ? "bg-slate-800" : "bg-slate-200"}`}
          />
        </div>

        {/* Manual code entry */}
        <form onSubmit={handleSubmit}>
          <div className="relative mb-4">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter queue code (e.g., demo-shop)"
              className={`w-full px-4 py-3.5 border rounded-none transition-all focus:outline-none focus:ring-2 focus:ring-teal-500/20 ${isDark ? "bg-slate-900 border-slate-700 text-white placeholder-slate-500 focus:border-teal-500" : "bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-teal-500"}`}
            />
          </div>
          <button
            type="submit"
            disabled={!code.trim()}
            className={`w-full py-3.5 bg-gradient-to-r from-teal-500 via-emerald-500 to-teal-400 text-slate-950 font-semibold rounded-none hover:brightness-110 disabled:cursor-not-allowed transition-all shadow-[0_14px_30px_rgba(16,185,129,0.28)] disabled:shadow-none ${isDark ? "disabled:bg-slate-800 disabled:text-slate-500" : "disabled:bg-slate-200 disabled:text-slate-400"}`}
          >
            Join Queue
          </button>
        </form>

        {/* Demo link */}
        <div className="mt-12 text-center">
          <p
            className={`text-sm mb-3 ${isDark ? "text-slate-500" : "text-slate-500"}`}
          >
            Want to try it out?
          </p>
          <button
            onClick={() => router.push("/join/demo-shop")}
            className="text-teal-500 font-medium hover:text-teal-400 transition-colors"
          >
            Join Demo Queue →
          </button>
        </div>
      </div>
    </div>
  );
}
