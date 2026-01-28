import { useState, useEffect, ReactNode, useCallback } from 'react';
import { AuthContext, AuthState, User, Business, TOKEN_KEY } from './authTypes';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    businesses: [],
    token: localStorage.getItem(TOKEN_KEY),
    isLoading: true,
    isAuthenticated: false,
  });

  const fetchMe = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setState(s => ({ ...s, isLoading: false, isAuthenticated: false }));
      return;
    }

    try {
      const response = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        localStorage.removeItem(TOKEN_KEY);
        setState({ user: null, businesses: [], token: null, isLoading: false, isAuthenticated: false });
        return;
      }

      const data = await response.json();
      setState({
        user: { id: data.userId, email: data.email },
        businesses: data.businesses || [],
        token,
        isLoading: false,
        isAuthenticated: true,
      });
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      setState({ user: null, businesses: [], token: null, isLoading: false, isAuthenticated: false });
    }
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  const login = useCallback((token: string, user: User) => {
    localStorage.setItem(TOKEN_KEY, token);
    setState(s => ({ ...s, token, user, isAuthenticated: true, isLoading: false }));
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setState({ user: null, businesses: [], token: null, isLoading: false, isAuthenticated: false });
  }, []);

  const addBusiness = useCallback((business: Business) => {
    setState(s => ({ ...s, businesses: [...s.businesses, business] }));
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout, addBusiness, fetchMe }}>
      {children}
    </AuthContext.Provider>
  );
}
