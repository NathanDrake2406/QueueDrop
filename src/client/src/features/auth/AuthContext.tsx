"use client";

import { useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { AuthContext, TOKEN_KEY } from './authTypes';
import type { AuthState, User, Business } from './authTypes';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    businesses: [],
    token: null, // Don't access localStorage during SSR
    isLoading: true,
    isAuthenticated: false,
  });

  const fetchMe = useCallback(async () => {
    // Only access localStorage on client
    if (typeof window === 'undefined') return;

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

  const isOwner = useCallback((businessSlug: string): boolean => {
    const business = state.businesses.find(b => b.slug === businessSlug);
    return business?.role === "owner";
  }, [state.businesses]);

  return (
    <AuthContext.Provider value={{ ...state, login, logout, addBusiness, fetchMe, isOwner }}>
      {children}
    </AuthContext.Provider>
  );
}
