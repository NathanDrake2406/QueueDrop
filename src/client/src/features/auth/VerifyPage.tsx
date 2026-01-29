import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { getApiErrorMessage } from '../../shared/utils/api';

type VerifyState = 'loading' | 'error';

interface VerifyResponse {
  token: string;
  userId: string;
  email: string;
}

export function VerifyPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login, fetchMe, businesses } = useAuth();
  const [pageState, setPageState] = useState<VerifyState>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get('token');

    if (!token) {
      setError('Invalid verification link. No token provided.');
      setPageState('error');
      return;
    }

    let isCancelled = false;

    async function verifyToken() {
      try {
        // Step 1: Verify the magic link token
        const response = await fetch(`/api/auth/verify?token=${encodeURIComponent(token!)}`);

        if (!response.ok) {
          const message = await getApiErrorMessage(response, 'Verification failed. The link may have expired.');
          if (!isCancelled) {
            setError(message);
            setPageState('error');
          }
          return;
        }

        const data: VerifyResponse = await response.json();

        // Step 2: Store the JWT and user info in auth context
        login(data.token, { id: data.userId, email: data.email });

        // Step 3: Fetch user's businesses
        await fetchMe();

      } catch {
        if (!isCancelled) {
          setError('Something went wrong. Please try again.');
          setPageState('error');
        }
      }
    }

    verifyToken();

    return () => {
      isCancelled = true;
    };
  }, [searchParams, login, fetchMe]);

  // Step 4: Redirect based on user state after fetchMe completes
  useEffect(() => {
    // Only redirect if we're still in loading state and have completed auth
    if (pageState === 'loading' && businesses !== undefined) {
      // Check if businesses have been loaded (fetchMe completed)
      // We need to wait for the auth context to update after fetchMe
      if (businesses.length > 0) {
        navigate(`/staff/${businesses[0].slug}`, { replace: true });
      } else if (businesses.length === 0) {
        // Only redirect to onboarding if we've confirmed no businesses
        // We need to check if auth is complete
        const token = localStorage.getItem('auth_token');
        if (token) {
          // Auth is complete, no businesses
          navigate('/onboarding', { replace: true });
        }
      }
    }
  }, [pageState, businesses, navigate]);

  if (pageState === 'loading') {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          {/* Spinning loader */}
          <div className="inline-flex items-center justify-center w-16 h-16 mb-6">
            <svg className="w-12 h-12 animate-spin text-teal-500" fill="none" viewBox="0 0 24 24">
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
          <p className="text-xl font-medium text-slate-300">Verifying your link...</p>
          <p className="text-slate-500 mt-2">Please wait while we sign you in</p>
        </div>
      </div>
    );
  }

  // Error state
  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        {/* Error icon */}
        <div className="inline-flex items-center justify-center w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-full mb-6">
          <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold mb-3">Verification Failed</h1>
        <p className="text-slate-400 mb-8">{error}</p>

        <Link
          to="/login"
          className="inline-block px-8 py-4 bg-gradient-to-r from-teal-500 to-teal-500 text-white font-semibold rounded-xl hover:from-teal-600 hover:to-teal-600 transition-all"
        >
          Try again
        </Link>
      </div>
    </div>
  );
}
