import { type FormEvent, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getApiErrorMessage, safeJsonParse } from "../../shared/utils/api";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface JoinResponse {
  token: string;
  position: number;
  queueName: string;
}

export function JoinQueue() {
  const { businessSlug } = useParams<{ businessSlug: string }>();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !businessSlug) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/join/${businessSlug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });

      if (!response.ok) {
        const errorMessage = await getApiErrorMessage(response, "Failed to join queue");
        throw new Error(errorMessage);
      }

      const data = await safeJsonParse<JoinResponse>(response);
      if (!data) {
        throw new Error("Invalid response from server");
      }

      // Save token to localStorage for persistence
      localStorage.setItem(`queue_token_${businessSlug}`, data.token);

      // Navigate to position page
      navigate(`/q/${data.token}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Check if user already has a token for this business
  const existingToken = businessSlug ? localStorage.getItem(`queue_token_${businessSlug}`) : null;

  if (existingToken) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Back button */}
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-zinc-500 hover:text-white mb-8 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>

          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 text-center">
            <div className="w-16 h-16 bg-violet-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold mb-2">You're already in line</h1>
            <p className="text-zinc-500 mb-8">Check your position or start fresh</p>
            <div className="space-y-3">
              <button
                onClick={() => navigate(`/q/${existingToken}`)}
                className="w-full py-4 bg-white text-zinc-900 font-semibold rounded-2xl hover:bg-zinc-100 transition-colors"
              >
                Check My Position
              </button>
              <button
                onClick={() => {
                  localStorage.removeItem(`queue_token_${businessSlug}`);
                  window.location.reload();
                }}
                className="w-full py-4 bg-zinc-800 text-white font-semibold rounded-2xl hover:bg-zinc-700 transition-colors"
              >
                Join Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-md mx-auto px-4 py-8">
        {/* Back button */}
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-zinc-500 hover:text-white mb-8 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        {/* Header */}
        <div className="mb-8">
          <p className="text-violet-400 font-medium mb-2">{businessSlug?.replace(/-/g, " ")}</p>
          <h1 className="text-3xl font-bold tracking-tight">Join the queue</h1>
          <p className="text-zinc-500 mt-2">We'll let you know when it's your turn</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label htmlFor="name" className="block text-sm font-medium text-zinc-400 mb-2">
              Your name
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              className="w-full px-5 py-4 bg-zinc-900 border border-zinc-800 rounded-2xl text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition-all"
              maxLength={100}
              required
              autoFocus
              disabled={isSubmitting}
            />
          </div>

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl mb-6">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || !name.trim()}
            className="w-full py-4 bg-white text-zinc-900 font-semibold rounded-2xl hover:bg-zinc-100 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Joining...
              </span>
            ) : (
              "Join Queue"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
