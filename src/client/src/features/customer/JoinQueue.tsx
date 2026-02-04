import { type FormEvent, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { notFound } from "next/navigation";
import { getApiErrorMessage, safeJsonParse } from "../../shared/utils/api";
import { QueueSelector } from "./components/QueueSelector";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

interface Queue {
  queueId: string;
  name: string;
  slug: string;
  waitingCount: number;
  estimatedWaitMinutes: number;
}

export interface QueuesResponse {
  businessId: string;
  businessName: string;
  queues: Queue[];
}

interface JoinResponse {
  token: string;
  position: number;
  queueName: string;
  queueSlug: string;
}

type PageState = "loading" | "select-queue" | "join-form" | "already-joined" | "error";

interface JoinQueueProps {
  businessSlug: string;
  queueSlug?: string;
  /** Server-fetched queue data - when provided, skips client-side fetch */
  serverData?: QueuesResponse;
}

// Helper to determine initial page state from data
function determineInitialState(
  data: QueuesResponse,
  urlQueueSlug: string | undefined,
  businessSlug: string
): { pageState: PageState; selectedQueueSlug: string | null; selectedQueueName: string; existingToken: string | null } {
  // If queueSlug was in URL, validate it exists
  if (urlQueueSlug) {
    const targetQueue = data.queues.find((q) => q.slug === urlQueueSlug);
    if (!targetQueue) {
      // Will trigger notFound in useEffect
      return { pageState: "loading", selectedQueueSlug: null, selectedQueueName: "", existingToken: null };
    }

    // Check for existing token for this specific queue (client-side only)
    const token = typeof window !== "undefined"
      ? localStorage.getItem(`queue_token_${businessSlug}_${urlQueueSlug}`)
      : null;

    if (token) {
      return { pageState: "already-joined", selectedQueueSlug: urlQueueSlug, selectedQueueName: targetQueue.name, existingToken: token };
    }
    return { pageState: "join-form", selectedQueueSlug: urlQueueSlug, selectedQueueName: targetQueue.name, existingToken: null };
  }

  if (data.queues.length === 1) {
    // Single queue - go directly to form
    const singleQueue = data.queues[0];

    // Check for existing token (client-side only)
    const token = typeof window !== "undefined"
      ? localStorage.getItem(`queue_token_${businessSlug}_${singleQueue.slug}`)
      : null;

    if (token) {
      return { pageState: "already-joined", selectedQueueSlug: singleQueue.slug, selectedQueueName: singleQueue.name, existingToken: token };
    }
    return { pageState: "join-form", selectedQueueSlug: singleQueue.slug, selectedQueueName: singleQueue.name, existingToken: null };
  }

  // Multiple queues - show selector
  return { pageState: "select-queue", selectedQueueSlug: null, selectedQueueName: "", existingToken: null };
}

export function JoinQueue({ businessSlug, queueSlug: urlQueueSlug, serverData }: JoinQueueProps) {
  const router = useRouter();

  // Initialize state from serverData if available (for SSR)
  const initialState = serverData
    ? determineInitialState(serverData, urlQueueSlug, businessSlug)
    : { pageState: "loading" as PageState, selectedQueueSlug: urlQueueSlug || null, selectedQueueName: "", existingToken: null };

  const [pageState, setPageState] = useState<PageState>(initialState.pageState);
  const [businessName, setBusinessName] = useState<string>(serverData?.businessName || "");
  const [queues, setQueues] = useState<Queue[]>(serverData?.queues || []);
  const [selectedQueueSlug, setSelectedQueueSlug] = useState<string | null>(initialState.selectedQueueSlug);
  const [selectedQueueName, setSelectedQueueName] = useState<string>(initialState.selectedQueueName);
  const [existingToken, setExistingToken] = useState<string | null>(initialState.existingToken);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Fetch queues and determine initial state (skip if serverData provided)
  useEffect(() => {
    // Skip fetch if serverData was provided
    if (serverData) return;

    async function fetchQueues() {
      if (!businessSlug) return;

      try {
        const response = await fetch(`${API_BASE}/api/business/${businessSlug}/queues`);
        if (!response.ok) {
          if (response.status === 404) {
            notFound();
            return;
          }
          throw new Error("Failed to load queues");
        }

        const data = await safeJsonParse<QueuesResponse>(response);
        if (!data || !data.queues) {
          throw new Error("Invalid response from server");
        }

        setBusinessName(data.businessName);
        setQueues(data.queues);

        const state = determineInitialState(data, urlQueueSlug, businessSlug);

        // Handle notFound case
        if (urlQueueSlug && !data.queues.find((q) => q.slug === urlQueueSlug)) {
          notFound();
          return;
        }

        setSelectedQueueSlug(state.selectedQueueSlug);
        setSelectedQueueName(state.selectedQueueName);
        setExistingToken(state.existingToken);
        setPageState(state.pageState);
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "Failed to load queues");
        setPageState("error");
      }
    }

    fetchQueues();
  }, [businessSlug, urlQueueSlug, router, serverData]);

  const handleQueueSelect = (queueSlug: string) => {
    const selected = queues.find((q) => q.slug === queueSlug);
    if (!selected) return;

    setSelectedQueueSlug(queueSlug);
    setSelectedQueueName(selected.name);

    // Check for existing token for this queue
    const token = localStorage.getItem(`queue_token_${businessSlug}_${queueSlug}`);
    if (token) {
      setExistingToken(token);
      setPageState("already-joined");
    } else {
      setPageState("join-form");
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !businessSlug || !selectedQueueSlug) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch(`${API_BASE}/api/join/${businessSlug}/${selectedQueueSlug}`, {
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

      // Save token to localStorage with queue-specific key
      localStorage.setItem(`queue_token_${businessSlug}_${selectedQueueSlug}`, data.token);

      // Navigate to position page
      router.push(`/q/${data.token}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoinAgain = () => {
    if (businessSlug && selectedQueueSlug) {
      localStorage.removeItem(`queue_token_${businessSlug}_${selectedQueueSlug}`);
    }
    setExistingToken(null);
    setPageState("join-form");
  };

  const handleBackToQueueSelection = () => {
    setSelectedQueueSlug(null);
    setSelectedQueueName("");
    setExistingToken(null);
    setPageState("select-queue");
  };

  // Loading state
  if (pageState === "loading") {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="flex items-center gap-3">
          <svg className="animate-spin w-6 h-6 text-teal-400" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-slate-400">Loading...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (pageState === "error") {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-xl font-semibold text-red-400 mb-2">Something went wrong</p>
          <p className="text-slate-500 mb-6">{loadError}</p>
          <button
            onClick={() => router.push("/")}
            className="px-6 py-3 bg-slate-800 text-white rounded-none hover:bg-slate-700 transition-colors"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  // Already joined state
  if (pageState === "already-joined" && existingToken) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Back button */}
          <button
            onClick={() => (queues.length > 1 ? handleBackToQueueSelection() : router.push("/"))}
            className="flex items-center gap-2 text-slate-500 hover:text-white mb-8 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {queues.length > 1 ? "Back to queues" : "Back"}
          </button>

          <div className="bg-slate-900 border border-slate-800 rounded-none p-8 text-center">
            <div className="w-16 h-16 bg-teal-500/20 rounded-none flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold mb-2">You're already in line</h1>
            <p className="text-slate-500 mb-2">for {selectedQueueName}</p>
            <p className="text-slate-600 text-sm mb-8">Check your position or start fresh</p>
            <div className="space-y-3">
              <button
                onClick={() => router.push(`/q/${existingToken}`)}
                className="w-full py-4 bg-white text-slate-900 font-semibold rounded-none hover:bg-slate-100 transition-colors"
              >
                Check My Position
              </button>
              <button
                onClick={handleJoinAgain}
                className="w-full py-4 bg-slate-800 text-white font-semibold rounded-none hover:bg-slate-700 transition-colors"
              >
                Join Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Queue selection state
  if (pageState === "select-queue") {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <div className="max-w-md mx-auto px-4 py-8">
          {/* Back button */}
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 text-slate-500 hover:text-white mb-8 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>

          <QueueSelector
            businessName={businessName}
            queues={queues.map((q) => ({
              name: q.name,
              slug: q.slug,
              waitingCount: q.waitingCount,
              estimatedWaitMinutes: q.estimatedWaitMinutes,
            }))}
            onSelect={handleQueueSelect}
          />
        </div>
      </div>
    );
  }

  // Join form state
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-md mx-auto px-4 py-8">
        {/* Back button */}
        <button
          onClick={() => (queues.length > 1 ? handleBackToQueueSelection() : router.push("/"))}
          className="flex items-center gap-2 text-slate-500 hover:text-white mb-8 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {queues.length > 1 ? "Back to queues" : "Back"}
        </button>

        {/* Header */}
        <div className="mb-8">
          <p className="text-teal-400 font-medium mb-2">{businessName || businessSlug?.replace(/-/g, " ")}</p>
          <h1 className="text-3xl font-bold tracking-tight">Join {selectedQueueName || "the queue"}</h1>
          <p className="text-slate-500 mt-2">We'll let you know when it's your turn</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label htmlFor="name" className="block text-sm font-medium text-slate-400 mb-2">
              Your name
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              className="w-full px-5 py-4 bg-slate-900 border border-slate-800 rounded-none text-white placeholder-slate-600 focus:outline-none focus:border-slate-600 focus:ring-1 focus:ring-slate-600 transition-all"
              maxLength={100}
              required
              autoFocus
              disabled={isSubmitting}
            />
          </div>

          {submitError && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-none mb-6">
              <p className="text-red-400 text-sm">{submitError}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || !name.trim()}
            className="w-full py-4 bg-gradient-to-r from-teal-500 via-emerald-500 to-teal-400 text-slate-950 font-semibold rounded-none hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-[0_14px_30px_rgba(16,185,129,0.28)]"
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
