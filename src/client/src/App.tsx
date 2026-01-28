import { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, Link } from "react-router-dom";
import { useDarkMode } from "./shared/hooks/useDarkMode";
import { JoinQueue } from "./features/customer/JoinQueue";
import { QueuePosition } from "./features/customer/QueuePosition";
import { QRScanner } from "./features/customer/QRScanner";
import { StaffDashboard } from "./features/staff/StaffDashboard";
import { DemoPage } from "./features/demo/DemoPage";
import { AuthProvider } from "./features/auth/AuthContext";
import { LoginPage } from "./features/auth/LoginPage";
import { VerifyPage } from "./features/auth/VerifyPage";
import { OnboardingPage } from "./features/auth/OnboardingPage";
import { ProtectedRoute } from "./features/auth/components/ProtectedRoute";
import { useAuth } from "./features/auth/hooks/useAuth";

function LandingPage() {
  const navigate = useNavigate();
  const { isAuthenticated, businesses } = useAuth();
  const [isDark, setIsDark] = useDarkMode();

  return (
    <div className={`min-h-screen transition-colors ${isDark ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900"}`}>
      {/* Navigation */}
      <nav className={`sticky top-0 z-50 backdrop-blur-md border-b transition-colors ${isDark ? "bg-slate-950/80 border-slate-800" : "bg-white/80 border-slate-200/60"}`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-600 rounded-lg flex items-center justify-center shadow-lg shadow-teal-600/20">
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <span className="text-xl font-display font-semibold">QueueDrop</span>
          </div>
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Dark mode toggle */}
            <button
              onClick={() => setIsDark(!isDark)}
              className={`p-2 rounded-lg transition-colors ${isDark ? "hover:bg-slate-800 text-slate-400 hover:text-slate-200" : "hover:bg-slate-100 text-slate-500 hover:text-slate-700"}`}
              aria-label="Toggle dark mode"
            >
              {isDark ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
            <button
              onClick={() => navigate("/customer")}
              className={`hidden sm:block font-medium transition-colors ${isDark ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-900"}`}
            >
              Join Queue
            </button>
            {isAuthenticated ? (
              <Link
                to={businesses.length > 0 ? `/staff/${businesses[0].slug}` : '/onboarding'}
                className="px-5 py-2.5 bg-teal-600 text-white font-semibold rounded-lg hover:bg-teal-700 shadow-lg shadow-teal-600/20 transition-all hover:shadow-xl hover:shadow-teal-600/25"
              >
                Dashboard
              </Link>
            ) : (
              <Link
                to="/login"
                className="px-5 py-2.5 bg-teal-600 text-white font-semibold rounded-lg hover:bg-teal-700 shadow-lg shadow-teal-600/20 transition-all hover:shadow-xl hover:shadow-teal-600/25"
              >
                Get Started
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-16 sm:pt-24 pb-20 sm:pb-32 px-4 sm:px-6 overflow-hidden">
        {/* Subtle gradient background */}
        <div className={`absolute inset-0 ${isDark ? "bg-gradient-to-b from-teal-950/30 via-transparent to-transparent" : "bg-gradient-to-b from-teal-50/50 via-transparent to-transparent"}`} />
        <div className={`absolute top-0 right-0 w-[600px] h-[600px] rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 ${isDark ? "bg-teal-900/20" : "bg-teal-100/40"}`} />

        <div className="relative max-w-4xl mx-auto text-center">
          {/* Tech badge */}
          <div className={`inline-flex items-center gap-2 px-4 py-2 border rounded-full text-sm mb-8 shadow-sm animate-fade-up ${isDark ? "bg-slate-900 border-slate-700 text-slate-300" : "bg-white border-slate-200 text-slate-600"}`}>
            <span className="w-2 h-2 bg-teal-500 rounded-full animate-pulse" />
            Real-time updates via SignalR WebSockets
          </div>

          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6 animate-fade-up animation-delay-100">
            Smart queue management{" "}
            <br className="hidden sm:block" />
            <span className="text-teal-500">for walk-in businesses</span>
          </h1>

          <p className={`text-lg sm:text-xl mb-10 max-w-2xl mx-auto leading-relaxed animate-fade-up animation-delay-200 ${isDark ? "text-slate-400" : "text-slate-600"}`}>
            Customers join via QR code, track their position live, and get notified when called.
            No app download required - works in any browser.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-up animation-delay-300">
            <button
              onClick={() => navigate("/demo")}
              className="w-full sm:w-auto px-8 py-4 bg-teal-600 text-white font-semibold rounded-lg hover:bg-teal-700 shadow-xl shadow-teal-600/20 transition-all hover:shadow-2xl hover:shadow-teal-600/25 hover:-translate-y-0.5"
            >
              Try Interactive Demo
            </button>
            <button
              onClick={() => navigate("/staff/demo-shop")}
              className={`w-full sm:w-auto px-8 py-4 font-semibold rounded-lg border transition-all ${isDark ? "bg-slate-900 text-white border-slate-700 hover:bg-slate-800 hover:border-slate-600" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300"}`}
            >
              View Staff Dashboard
            </button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className={`py-20 sm:py-28 px-4 sm:px-6 ${isDark ? "bg-slate-900/50" : "bg-white"}`}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-display text-3xl sm:text-4xl font-bold mb-4">
              Everything you need to manage queues
            </h2>
            <p className={`text-lg max-w-2xl mx-auto ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              Built for barbershops, restaurants, clinics, and any walk-in business.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                ),
                title: "Real-time Updates",
                description: "Live position updates via WebSocket. Customers always know where they stand.",
              },
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                ),
                title: "Push Notifications",
                description: "Native browser notifications work even when the tab is closed.",
              },
              {
                icon: (
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3 11h8V3H3v8zm2-6h4v4H5V5zm8-2v8h8V3h-8zm6 6h-4V5h4v4zM3 21h8v-8H3v8zm2-6h4v4H5v-4z"/>
                  </svg>
                ),
                title: "QR Code Generation",
                description: "Generate and download QR codes to display at your entrance.",
              },
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ),
                title: "Auto No-Show",
                description: "Automatically mark customers as no-show after configurable timeout.",
              },
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                  </svg>
                ),
                title: "Staff Dashboard",
                description: "Call next customer, mark as served, and manage your queue in real-time.",
              },
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                ),
                title: "No App Required",
                description: "Works in any browser. Customers don't need to download anything.",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className={`p-6 border rounded-xl transition-all hover:-translate-y-1 group ${isDark ? "bg-slate-900 border-slate-800 hover:border-slate-700" : "bg-slate-50 border-slate-200 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-200/50"}`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-colors ${isDark ? "bg-teal-900/50 text-teal-400 group-hover:bg-teal-600 group-hover:text-white" : "bg-teal-100 text-teal-600 group-hover:bg-teal-600 group-hover:text-white"}`}>
                  {feature.icon}
                </div>
                <h3 className="font-display font-semibold text-lg mb-2">{feature.title}</h3>
                <p className={`text-sm leading-relaxed ${isDark ? "text-slate-400" : "text-slate-500"}`}>{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className={`py-20 sm:py-28 px-4 sm:px-6 ${isDark ? "" : "bg-slate-100/50"}`}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-display text-3xl sm:text-4xl font-bold mb-4">
              How it works
            </h2>
            <p className={`text-lg ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              Three simple steps to eliminate wait time frustration.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 md:gap-4">
            {[
              {
                step: "1",
                title: "Scan & Join",
                description: "Customers scan your QR code or enter your queue code to join the line from anywhere.",
                icon: (
                  <svg className="w-10 h-10" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3 11h8V3H3v8zm2-6h4v4H5V5zm8-2v8h8V3h-8zm6 6h-4V5h4v4zM3 21h8v-8H3v8zm2-6h4v4H5v-4z"/>
                  </svg>
                ),
              },
              {
                step: "2",
                title: "Wait Anywhere",
                description: "No more standing in line. Customers can grab a coffee, shop, or wait in their car.",
                icon: (
                  <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                ),
              },
              {
                step: "3",
                title: "Get Notified",
                description: "Push notifications alert customers when it's their turn. No more missed calls.",
                icon: (
                  <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                ),
              },
            ].map((item, index) => (
              <div key={item.step} className="relative text-center p-6">
                {/* Connecting line */}
                {index < 2 && (
                  <div className={`hidden md:block absolute top-16 left-[60%] w-[80%] h-0.5 ${isDark ? "bg-slate-800" : "bg-slate-200"}`}>
                    <div className={`absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full ${isDark ? "bg-slate-700" : "bg-slate-300"}`} />
                  </div>
                )}

                <div className={`w-20 h-20 mx-auto mb-4 rounded-xl shadow-lg flex items-center justify-center ${isDark ? "bg-slate-900 text-slate-500" : "bg-white text-slate-400"}`}>
                  {item.icon}
                </div>
                <div className="inline-flex items-center justify-center w-8 h-8 bg-teal-600 text-white text-sm font-bold rounded-full mb-3">
                  {item.step}
                </div>
                <h3 className="font-display font-semibold text-lg mb-2">{item.title}</h3>
                <p className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 sm:py-28 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="relative p-10 sm:p-14 bg-gradient-to-br from-teal-600 to-teal-700 rounded-xl shadow-2xl shadow-teal-600/30 overflow-hidden">
            {/* Decorative circles */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/30 rounded-full blur-3xl translate-x-1/3 -translate-y-1/3" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-teal-400/20 rounded-full blur-2xl -translate-x-1/4 translate-y-1/4" />

            <div className="relative">
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-white mb-4">
                Ready to try it?
              </h2>
              <p className="text-teal-100 mb-8 max-w-lg mx-auto">
                Experience the demo queue as a customer or explore the staff dashboard.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <button
                  onClick={() => navigate("/join/demo-shop")}
                  className="w-full sm:w-auto px-8 py-4 bg-white text-teal-700 font-semibold rounded-lg hover:bg-teal-50 transition-colors shadow-lg"
                >
                  Join as Customer
                </button>
                <button
                  onClick={() => navigate("/staff/demo-shop")}
                  className="w-full sm:w-auto px-8 py-4 bg-teal-500/30 text-white font-semibold rounded-lg hover:bg-teal-500/40 border border-teal-400/30 transition-colors"
                >
                  Open Staff Dashboard
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tech stack + Footer */}
      <footer className={`py-10 px-4 sm:px-6 border-t ${isDark ? "border-slate-800" : "border-slate-200"}`}>
        <div className="max-w-6xl mx-auto">
          {/* Tech stack */}
          <div className={`flex flex-wrap items-center justify-center gap-4 mb-8 pb-8 border-b ${isDark ? "border-slate-800" : "border-slate-200"}`}>
            <span className={`text-sm ${isDark ? "text-slate-500" : "text-slate-400"}`}>Built with</span>
            {["React", ".NET 9", "SignalR", "PostgreSQL", "Tailwind CSS"].map((tech) => (
              <span
                key={tech}
                className={`px-3 py-1 text-sm font-medium rounded-full ${isDark ? "bg-slate-900 text-slate-300 border border-slate-800" : "bg-slate-100 text-slate-600"}`}
              >
                {tech}
              </span>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                </svg>
              </div>
              <span className="font-display font-semibold">QueueDrop</span>
            </div>
            <p className={`text-sm ${isDark ? "text-slate-500" : "text-slate-400"}`}>
              A portfolio project demonstrating real-time queue management
            </p>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-2 text-sm transition-colors ${isDark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-700"}`}
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              View on GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function CustomerJoinPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [isDark] = useDarkMode();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim()) {
      navigate(`/join/${code.trim().toLowerCase()}`);
    }
  };

  return (
    <div className={`min-h-screen transition-colors ${isDark ? "bg-slate-950 text-white" : "bg-slate-50 text-slate-900"}`}>
      <div className="max-w-md mx-auto px-4 py-12">
        {/* Back to home */}
        <button
          onClick={() => navigate("/")}
          className={`flex items-center gap-2 mb-8 transition-colors ${isDark ? "text-slate-500 hover:text-white" : "text-slate-500 hover:text-slate-900"}`}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        {/* Logo */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-teal-600 rounded-lg mb-4 shadow-lg shadow-teal-600/20">
            <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Join a Queue</h1>
          <p className={`mt-2 ${isDark ? "text-slate-400" : "text-slate-500"}`}>Scan a QR code or enter the queue code</p>
        </div>

        {/* QR Scan Button */}
        <button
          onClick={() => navigate("/scan")}
          className={`w-full p-6 border rounded-xl mb-4 transition-all group ${isDark ? "bg-slate-900 border-slate-800 hover:bg-slate-800 hover:border-slate-700" : "bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-200/50"}`}
        >
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-lg flex items-center justify-center group-hover:bg-teal-600 transition-colors ${isDark ? "bg-teal-900/50 text-teal-400 group-hover:text-white" : "bg-teal-100 text-teal-600 group-hover:text-white"}`}>
              <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 11h8V3H3v8zm2-6h4v4H5V5zm8-2v8h8V3h-8zm6 6h-4V5h4v4zM3 21h8v-8H3v8zm2-6h4v4H5v-4zm13 2h-2v2h2v2h-2v-2h-2v2h-2v-2h2v-2h-2v-2h2v2h2v-2h2v2zm0 2v2h2v-2h-2zm2-2h2v-2h-2v2z"/>
              </svg>
            </div>
            <div className="text-left flex-1">
              <p className="font-semibold text-lg">Scan QR Code</p>
              <p className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>Use your camera to join instantly</p>
            </div>
            <svg className={`w-5 h-5 ${isDark ? "text-slate-600" : "text-slate-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </button>

        {/* Divider */}
        <div className="flex items-center gap-4 my-8">
          <div className={`flex-1 h-px ${isDark ? "bg-slate-800" : "bg-slate-200"}`} />
          <span className={`text-sm ${isDark ? "text-slate-500" : "text-slate-400"}`}>or enter code</span>
          <div className={`flex-1 h-px ${isDark ? "bg-slate-800" : "bg-slate-200"}`} />
        </div>

        {/* Manual code entry */}
        <form onSubmit={handleSubmit}>
          <div className="relative mb-4">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter queue code (e.g., demo-shop)"
              className={`w-full px-4 py-3.5 border rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-teal-500/20 ${isDark ? "bg-slate-900 border-slate-700 text-white placeholder-slate-500 focus:border-teal-500" : "bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-teal-500"}`}
            />
          </div>
          <button
            type="submit"
            disabled={!code.trim()}
            className={`w-full py-3.5 bg-teal-600 text-white font-semibold rounded-lg hover:bg-teal-700 disabled:cursor-not-allowed transition-colors shadow-lg shadow-teal-600/20 disabled:shadow-none ${isDark ? "disabled:bg-slate-800 disabled:text-slate-500" : "disabled:bg-slate-200 disabled:text-slate-400"}`}
          >
            Join Queue
          </button>
        </form>

        {/* Demo link */}
        <div className="mt-12 text-center">
          <p className={`text-sm mb-3 ${isDark ? "text-slate-500" : "text-slate-500"}`}>Want to try it out?</p>
          <button
            onClick={() => navigate("/join/demo-shop")}
            className="text-teal-500 font-medium hover:text-teal-400 transition-colors"
          >
            Join Demo Queue →
          </button>
        </div>
      </div>
    </div>
  );
}

function NotFound() {
  const [isDark] = useDarkMode();

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 transition-colors ${isDark ? "bg-slate-950" : "bg-slate-50"}`}>
      <div className="text-center">
        <p className={`text-8xl font-display font-bold mb-4 ${isDark ? "text-slate-800" : "text-slate-200"}`}>404</p>
        <p className={`mb-8 ${isDark ? "text-slate-400" : "text-slate-500"}`}>This page doesn't exist</p>
        <a
          href="/"
          className="inline-block px-6 py-3 bg-teal-600 text-white font-semibold rounded-lg hover:bg-teal-700 transition-colors shadow-lg shadow-teal-600/20"
        >
          Go Home
        </a>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/verify" element={<VerifyPage />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/customer" element={<CustomerJoinPage />} />
          <Route path="/demo" element={<DemoPage />} />
          <Route path="/scan" element={<QRScanner />} />
          <Route path="/join/:businessSlug/:queueSlug?" element={<JoinQueue />} />
          <Route path="/q/:token" element={<QueuePosition />} />
          <Route
            path="/staff/:businessSlug"
            element={
              <ProtectedRoute>
                <StaffDashboard />
              </ProtectedRoute>
            }
          />
          <Route path="/404" element={<NotFound />} />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
