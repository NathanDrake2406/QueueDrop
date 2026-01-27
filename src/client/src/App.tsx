import { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { JoinQueue } from "./features/customer/JoinQueue";
import { QueuePosition } from "./features/customer/QueuePosition";
import { QRScanner } from "./features/customer/QRScanner";
import { StaffDashboard } from "./features/staff/StaffDashboard";

function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Navigation */}
      <nav className="border-b border-zinc-900">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <span className="text-xl font-bold">QueueDrop</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/customer")}
              className="text-zinc-400 hover:text-white transition-colors"
            >
              Join Queue
            </button>
            <button
              onClick={() => navigate("/staff/demo-shop")}
              className="px-4 py-2 bg-zinc-800 text-white rounded-xl hover:bg-zinc-700 transition-colors"
            >
              Staff Login
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-20 pb-32 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-violet-500/10 border border-violet-500/20 rounded-full text-violet-400 text-sm mb-8">
            <span className="w-2 h-2 bg-violet-500 rounded-full animate-pulse" />
            Real-time queue management
          </div>
          <h1 className="text-5xl sm:text-7xl font-bold tracking-tight mb-6">
            Skip the wait,
            <br />
            <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
              not the line
            </span>
          </h1>
          <p className="text-xl text-zinc-400 mb-12 max-w-2xl mx-auto">
            Smart queue management for restaurants, barbershops, clinics, and more. 
            Customers join from their phone and get notified when it's their turn.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => navigate("/join/demo-shop")}
              className="w-full sm:w-auto px-8 py-4 bg-white text-zinc-900 font-semibold rounded-2xl hover:bg-zinc-100 transition-colors"
            >
              Try Demo Queue
            </button>
            <button
              onClick={() => navigate("/staff/demo-shop")}
              className="w-full sm:w-auto px-8 py-4 bg-zinc-800 text-white font-semibold rounded-2xl hover:bg-zinc-700 transition-colors"
            >
              View Staff Dashboard
            </button>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 px-4 bg-zinc-900/50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">How it works</h2>
          <p className="text-zinc-500 text-center mb-16">Three simple steps to eliminate wait time frustration</p>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "1",
                title: "Scan & Join",
                description: "Customers scan your QR code or enter your queue code to join the line from anywhere.",
                icon: (
                  <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3 11h8V3H3v8zm2-6h4v4H5V5zm8-2v8h8V3h-8zm6 6h-4V5h4v4zM3 21h8v-8H3v8zm2-6h4v4H5v-4z"/>
                  </svg>
                ),
              },
              {
                step: "2",
                title: "Wait Anywhere",
                description: "No more standing in line. Customers can grab a coffee, shop, or wait in their car.",
                icon: (
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                ),
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6 text-violet-400">
                  {item.icon}
                </div>
                <div className="text-sm text-violet-400 font-medium mb-2">Step {item.step}</div>
                <h3 className="text-xl font-semibold mb-3">{item.title}</h3>
                <p className="text-zinc-500">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">Built for modern businesses</h2>
          <p className="text-zinc-500 text-center mb-16">Everything you need to manage queues efficiently</p>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { title: "Real-time Updates", description: "Live position updates via WebSocket. Customers always know where they stand.", color: "violet" },
              { title: "Push Notifications", description: "Native browser notifications work even when the tab is closed.", color: "fuchsia" },
              { title: "QR Code Generation", description: "Generate and download QR codes to display at your entrance.", color: "violet" },
              { title: "Auto No-Show", description: "Automatically mark customers as no-show after a configurable timeout.", color: "fuchsia" },
              { title: "Staff Dashboard", description: "Call next customer, mark as served, and manage your queue in real-time.", color: "violet" },
              { title: "No App Required", description: "Works in any browser. Customers don't need to download anything.", color: "fuchsia" },
            ].map((feature) => (
              <div
                key={feature.title}
                className="p-6 bg-zinc-900 border border-zinc-800 rounded-2xl hover:border-zinc-700 transition-colors"
              >
                <div className={`w-10 h-10 rounded-xl mb-4 flex items-center justify-center ${
                  feature.color === "violet" ? "bg-violet-500/20 text-violet-400" : "bg-fuchsia-500/20 text-fuchsia-400"
                }`}>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-zinc-500">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="p-12 bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 border border-violet-500/20 rounded-3xl">
            <h2 className="text-3xl font-bold mb-4">Ready to try it?</h2>
            <p className="text-zinc-400 mb-8">
              Experience the demo queue as a customer or explore the staff dashboard.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => navigate("/join/demo-shop")}
                className="w-full sm:w-auto px-8 py-4 bg-white text-zinc-900 font-semibold rounded-2xl hover:bg-zinc-100 transition-colors"
              >
                Join as Customer
              </button>
              <button
                onClick={() => navigate("/staff/demo-shop")}
                className="w-full sm:w-auto px-8 py-4 bg-zinc-800 text-white font-semibold rounded-2xl hover:bg-zinc-700 transition-colors"
              >
                Open Staff Dashboard
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-zinc-900">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-zinc-500">
            <div className="w-6 h-6 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-lg" />
            <span className="text-sm">QueueDrop</span>
          </div>
          <p className="text-sm text-zinc-600">
            Built with React, .NET, SignalR, and PostgreSQL
          </p>
        </div>
      </footer>
    </div>
  );
}

function CustomerJoinPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim()) {
      navigate(`/join/${code.trim().toLowerCase()}`);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-md mx-auto px-4 py-12">
        {/* Back to home */}
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-zinc-500 hover:text-white mb-8 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        {/* Logo */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-2xl mb-4">
            <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Join a Queue</h1>
          <p className="text-zinc-500 mt-2">Scan a QR code or enter the queue code</p>
        </div>

        {/* QR Scan Button */}
        <button
          onClick={() => navigate("/scan")}
          className="w-full p-6 bg-zinc-900 border border-zinc-800 rounded-3xl mb-4 hover:bg-zinc-800 hover:border-zinc-700 transition-all group"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-zinc-800 rounded-2xl flex items-center justify-center group-hover:bg-zinc-700 transition-colors">
              <svg className="w-7 h-7 text-zinc-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 11h8V3H3v8zm2-6h4v4H5V5zm8-2v8h8V3h-8zm6 6h-4V5h4v4zM3 21h8v-8H3v8zm2-6h4v4H5v-4zm13 2h-2v2h2v2h-2v-2h-2v2h-2v-2h2v-2h-2v-2h2v2h2v-2h2v2zm0 2v2h2v-2h-2zm2-2h2v-2h-2v2z"/>
              </svg>
            </div>
            <div className="text-left flex-1">
              <p className="font-semibold text-lg">Scan QR Code</p>
              <p className="text-zinc-500 text-sm">Use your camera to join instantly</p>
            </div>
            <svg className="w-5 h-5 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </button>

        {/* Divider */}
        <div className="flex items-center gap-4 my-8">
          <div className="flex-1 h-px bg-zinc-800" />
          <span className="text-zinc-600 text-sm">or enter code</span>
          <div className="flex-1 h-px bg-zinc-800" />
        </div>

        {/* Manual code entry */}
        <form onSubmit={handleSubmit}>
          <div className="relative mb-4">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter queue code (e.g., demo-shop)"
              className="w-full px-5 py-4 bg-zinc-900 border border-zinc-800 rounded-2xl text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={!code.trim()}
            className="w-full py-4 bg-white text-zinc-900 font-semibold rounded-2xl hover:bg-zinc-100 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed transition-colors"
          >
            Join Queue
          </button>
        </form>

        {/* Demo link */}
        <div className="mt-12 text-center">
          <p className="text-zinc-600 text-sm mb-3">Want to try it out?</p>
          <button
            onClick={() => navigate("/join/demo-shop")}
            className="text-violet-400 font-medium hover:text-violet-300 transition-colors"
          >
            Join Demo Queue →
          </button>
        </div>
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-4">
      <div className="text-center">
        <p className="text-8xl font-bold text-zinc-800 mb-4">404</p>
        <p className="text-zinc-500 mb-8">This page doesn't exist</p>
        <a
          href="/"
          className="inline-block px-6 py-3 bg-white text-zinc-900 font-semibold rounded-xl hover:bg-zinc-100 transition-colors"
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
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/customer" element={<CustomerJoinPage />} />
        <Route path="/scan" element={<QRScanner />} />
        <Route path="/join/:businessSlug" element={<JoinQueue />} />
        <Route path="/q/:token" element={<QueuePosition />} />
        <Route path="/staff/:businessSlug" element={<StaffDashboard />} />
        <Route path="/404" element={<NotFound />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
