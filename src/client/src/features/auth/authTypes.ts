import { createContext } from 'react';

export interface User {
  id: string;
  email: string;
}

export interface Business {
  id: string;
  name: string;
  slug: string;
}

export interface AuthState {
  user: User | null;
  businesses: Business[];
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export interface AuthContextValue extends AuthState {
  login: (token: string, user: User) => void;
  logout: () => void;
  addBusiness: (business: Business) => void;
  fetchMe: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export const TOKEN_KEY = 'auth_token';
