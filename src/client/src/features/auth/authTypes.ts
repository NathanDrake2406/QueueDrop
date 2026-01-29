import { createContext } from 'react';

export interface User {
  id: string;
  email: string;
}

export type BusinessRole = "owner" | "staff";

export interface Business {
  id: string;
  name: string;
  slug: string;
  role: BusinessRole;
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
  isOwner: (businessSlug: string) => boolean;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export const TOKEN_KEY = 'auth_token';
