import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApiErrorMessage } from '../../shared/utils/api';
import { useDarkMode } from '../../shared/hooks/useDarkMode';

type PageState = 'form' | 'sent';

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [pageState, setPageState] = useState<PageState>('form');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDark] = useDarkMode();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/send-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const message = await getApiErrorMessage(response, 'Failed to send magic link');
        setError(message);
        setIsLoading(false);
        return;
      }

      setPageState('sent');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`min-h-screen transition-colors ${isDark ? "bg-slate-950 text-white" : "bg-slate-50 text-slate-900"}`}>
      <div className="max-w-md mx-auto px-4 py-12">
        {/* Back button */}
        <button
          onClick={() => navigate('/')}
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
          <h1 className="font-display text-3xl font-bold tracking-tight">
            {pageState === 'form' ? 'Sign in to QueueDrop' : 'Check your email'}
          </h1>
          <p className={`mt-2 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            {pageState === 'form'
              ? 'Enter your email to receive a magic link'
              : `We sent a sign-in link to ${email}`}
          </p>
        </div>

        {pageState === 'form' ? (
          <form onSubmit={handleSubmit}>
            {/* Email input */}
            <div className="mb-4">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoFocus
                autoComplete="email"
                className={`w-full px-4 py-3.5 border rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-teal-500/20 ${
                  isDark
                    ? "bg-slate-900 border-slate-700 text-white placeholder-slate-500 focus:border-teal-500"
                    : "bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-teal-500"
                }`}
              />
            </div>

            {/* Error message */}
            {error && (
              <div className={`mb-4 p-4 border rounded-lg text-sm ${isDark ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-red-50 border-red-200 text-red-600"}`}>
                {error}
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={isLoading || !email.trim()}
              className="w-full py-3.5 bg-teal-600 text-white font-semibold rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-teal-600/20"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Sending...
                </span>
              ) : (
                'Continue with Email'
              )}
            </button>
          </form>
        ) : (
          <div className="text-center">
            {/* Success icon */}
            <div className={`inline-flex items-center justify-center w-16 h-16 rounded-lg mb-6 ${isDark ? "bg-teal-500/10 border border-teal-500/20" : "bg-teal-50 border border-teal-200"}`}>
              <svg className="w-8 h-8 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>

            <p className={`mb-8 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              Click the link in your email to sign in. The link will expire in 15 minutes.
            </p>

            {/* Try again button */}
            <button
              onClick={() => {
                setPageState('form');
                setEmail('');
                setError(null);
              }}
              className="text-teal-600 font-medium hover:text-teal-700 transition-colors"
            >
              Use a different email
            </button>
          </div>
        )}

        {/* Footer */}
        <p className={`text-center text-sm mt-12 ${isDark ? "text-slate-600" : "text-slate-400"}`}>
          No account? No problem. We'll create one for you.
        </p>
      </div>
    </div>
  );
}
