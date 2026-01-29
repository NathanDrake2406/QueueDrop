"use client";

import Link from "next/link";
import { useDarkMode } from "@/shared/hooks/useDarkMode";
import { useAuth } from "@/features/auth/hooks/useAuth";
import styles from "./LandingPage.module.css";

// Static data - defined outside component to avoid recreation on every render
const STATS = [
  { value: "500+", label: "Concurrent connections" },
  { value: "<2ms", label: "P95 latency" },
  { value: "100%", label: "Uptime" },
] as const;

const FEATURES = [
  { title: "Real-time Updates", description: "Position changes pushed instantly via WebSocket.", icon: "⚡" },
  { title: "Push Notifications", description: "Native alerts even when the browser is closed.", icon: "🔔" },
  { title: "QR Code Generation", description: "Download codes to display at your entrance.", icon: "📱" },
  { title: "Auto No-Show", description: "Mark customers after configurable timeout.", icon: "⏱️" },
  { title: "Staff Dashboard", description: "Call next, mark served, manage everything.", icon: "📋" },
  { title: "No App Required", description: "Works in any browser, nothing to install.", icon: "🌐" },
] as const;

const STEPS = [
  { step: "1", title: "Scan & Join", description: "Customer scans QR to join the queue remotely." },
  { step: "2", title: "Wait Anywhere", description: "Grab coffee, shop, or wait in the car." },
  { step: "3", title: "Get Notified", description: "Push notification when it's their turn." },
] as const;

const TECH_STACK = ["Next.js 16", ".NET 8", "SignalR", "PostgreSQL", "Tailwind"] as const;

// Static logo - drop with queue dots
function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2dd4bf" />
          <stop offset="100%" stopColor="#0d9488" />
        </linearGradient>
      </defs>
      <path
        d="M50 8 C50 8 85 45 85 62 C85 79 69 92 50 92 C31 92 15 79 15 62 C15 45 50 8 50 8Z"
        fill="url(#logoGrad)"
      />
      <circle cx="50" cy="75" r="6" fill="white" />
      <circle cx="50" cy="58" r="5" fill="white" fillOpacity="0.8" />
      <circle cx="50" cy="44" r="4" fill="white" fillOpacity="0.5" />
      <circle cx="50" cy="33" r="3" fill="white" fillOpacity="0.25" />
    </svg>
  );
}

export function LandingPage() {
  const { isAuthenticated, businesses } = useAuth();
  const [isDark, setIsDark] = useDarkMode();

  return (
    <div className={`min-h-screen ${isDark ? "bg-slate-950 text-slate-100" : "bg-white text-slate-900"}`}>
      {/* Navigation */}
      <nav className={`sticky top-0 z-50 backdrop-blur-md ${isDark ? "bg-slate-950/90" : "bg-white/90"}`}>
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo size={36} />
            <span className="text-lg font-semibold tracking-tight">
              QueueDrop
            </span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsDark(!isDark)}
              className={`p-2 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 ${isDark ? "hover:bg-slate-800 text-slate-400 focus-visible:ring-offset-slate-950" : "hover:bg-slate-100 text-slate-500 focus-visible:ring-offset-white"}`}
              aria-label="Toggle dark mode"
            >
              {isDark ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
            {isAuthenticated ? (
              <Link
                href={businesses.length > 0 ? `/staff/${businesses[0].slug}` : "/onboarding"}
                className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
              >
                Dashboard
              </Link>
            ) : (
              <Link
                href="/login"
                className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
              >
                Get Started
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-24 sm:pt-32 pb-20 px-6 relative overflow-hidden">
        {/* Subtle gradient orb background - will-change hints GPU compositing for blur */}
        <div
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-3xl opacity-20 pointer-events-none will-change-transform ${isDark ? "bg-teal-500" : "bg-teal-300"}`}
        />

        <div className="max-w-3xl mx-auto text-center relative">
          <div className={`${styles.animateFadeUp} ${styles.delay1} inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-8 ${isDark ? "bg-teal-950 text-teal-300" : "bg-teal-50 text-teal-700"}`}>
            <span className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-pulse" />
            Real-time via WebSockets
          </div>

          <h1 className={`${styles.animateFadeUp} ${styles.delay2} text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight mb-6 leading-tight`}>
            Queue management{" "}
            <span className="bg-gradient-to-r from-teal-500 to-teal-400 bg-clip-text text-transparent whitespace-nowrap">that just works</span>
          </h1>

          <p className={`${styles.animateFadeUp} ${styles.delay3} text-lg sm:text-xl mb-10 max-w-2xl mx-auto leading-relaxed ${isDark ? "text-slate-400" : "text-slate-600"}`}>
            Customers join via QR, track their spot live, and show up right on time. No app required.
          </p>

          <div className={`${styles.animateFadeUp} ${styles.delay4} flex flex-col sm:flex-row items-center justify-center gap-3`}>
            <Link
              href="/demo"
              className="w-full sm:w-auto px-6 py-3 bg-teal-600 text-white font-medium rounded-lg text-center hover:bg-teal-500 transition-[background-color,transform] hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
            >
              Try the Demo
            </Link>
            <Link
              href="/staff/demo-shop"
              className={`w-full sm:w-auto px-6 py-3 font-medium rounded-lg text-center transition-[background-color,transform] hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 ${isDark ? "bg-slate-800 text-white hover:bg-slate-700" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
            >
              Staff Dashboard
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className={`py-14 ${isDark ? "bg-slate-900/50" : "bg-slate-50"}`}>
        <div className="max-w-4xl mx-auto px-6">
          <div className="grid grid-cols-3 gap-8 text-center">
            {STATS.map((stat) => (
              <div key={stat.label}>
                <div className="text-2xl sm:text-4xl font-semibold bg-gradient-to-r from-teal-500 to-teal-400 bg-clip-text text-transparent">{stat.value}</div>
                <div className={`text-xs sm:text-sm mt-1 ${isDark ? "text-slate-500" : "text-slate-500"}`}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-semibold text-center mb-4 text-balance">
            Everything you need
          </h2>
          <p className={`text-center mb-12 ${isDark ? "text-slate-400" : "text-slate-600"}`}>
            Built for barbershops, restaurants, clinics, and any walk-in business.
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className={`p-5 rounded-xl transition-[background-color,transform] hover:-translate-y-1 ${isDark ? "bg-slate-900/50 hover:bg-slate-900" : "bg-slate-50 hover:bg-slate-100"}`}
              >
                <span className="text-2xl mb-3 block">{feature.icon}</span>
                <h3 className="font-medium mb-2">{feature.title}</h3>
                <p className={`text-sm leading-relaxed ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className={`py-20 px-6 ${isDark ? "bg-slate-900/50" : "bg-slate-50"}`}>
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-semibold text-center mb-12 text-balance">
            How it works
          </h2>

          <div className="grid md:grid-cols-3 gap-8 text-center relative">
            {/* Connection line (hidden on mobile) */}
            <div className={`hidden md:block absolute top-5 left-[20%] right-[20%] h-0.5 ${isDark ? "bg-slate-700" : "bg-slate-200"}`} />

            {STEPS.map((item) => (
              <div key={item.step} className="relative">
                <div className="w-10 h-10 mx-auto mb-4 rounded-full bg-gradient-to-br from-teal-500 to-teal-600 text-white flex items-center justify-center font-semibold shadow-lg shadow-teal-500/25">
                  {item.step}
                </div>
                <h3 className="font-medium mb-2">{item.title}</h3>
                <p className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <div className="p-10 sm:p-12 bg-gradient-to-br from-teal-600 to-teal-700 rounded-2xl relative overflow-hidden">
            {/* Subtle pattern overlay - will-change hints GPU compositing for blur */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full blur-3xl will-change-transform" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white rounded-full blur-2xl will-change-transform" />
            </div>

            <div className="relative">
              <h2 className="text-2xl sm:text-3xl font-semibold text-white mb-3 text-balance">
                Ready to try it?
              </h2>
              <p className="text-teal-100 mb-8">
                Jump into the demo as a customer or staff member.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  href="/join/demo-shop"
                  className="w-full sm:w-auto px-6 py-3 bg-white text-teal-700 font-medium rounded-lg text-center hover:bg-teal-50 transition-[background-color,transform] hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-teal-600"
                >
                  Join as Customer
                </Link>
                <Link
                  href="/staff/demo-shop"
                  className="w-full sm:w-auto px-6 py-3 bg-teal-500/80 text-white font-medium rounded-lg text-center hover:bg-teal-500 transition-[background-color,transform] hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-teal-600"
                >
                  Staff Dashboard
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={`py-10 px-6 ${isDark ? "bg-slate-900/50" : "bg-slate-50"}`}>
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
            <span className={`text-sm ${isDark ? "text-slate-500" : "text-slate-400"}`}>Built with</span>
            {TECH_STACK.map((tech) => (
              <span key={tech} className={`px-2 py-1 text-xs rounded transition-colors ${isDark ? "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300" : "bg-slate-200 text-slate-600 hover:bg-slate-300"}`}>
                {tech}
              </span>
            ))}
          </div>

          <div className="flex items-center justify-center gap-3">
            <Logo size={24} />
            <span className={`text-sm ${isDark ? "text-slate-500" : "text-slate-400"}`}>
              QueueDrop — A queue management demo
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
