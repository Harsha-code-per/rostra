"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { toast } from "sonner";
import { RostraApi, SESSION_KEY, UNAUTHORIZED_EVENT } from "./api";
import type { Employee, UserSession } from "./types";

interface AuthContextType {
  user: UserSession | null;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<UserSession>;
  logout: () => void;
  updateCurrentUserEmployee: (updates: Partial<Employee>) => void;
  resetPermanentPassword: (newPassword: string, oldPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function persist(session: UserSession | null) {
  if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else localStorage.removeItem(SESSION_KEY);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SESSION_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from localStorage after mount
      if (saved) setUser(JSON.parse(saved));
    } catch {
      localStorage.removeItem(SESSION_KEY);
    }
    setIsLoading(false);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    persist(null);
  }, []);

  // Any authenticated request that comes back 401 ends the session.
  useEffect(() => {
    const onUnauthorized = () => {
      if (!localStorage.getItem(SESSION_KEY)) return;
      logout();
      toast.error("Your session has expired. Please sign in again.");
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, [logout]);

  const login = async (email: string, pass: string) => {
    const session = await RostraApi.login(email, pass);
    setUser(session);
    persist(session);
    return session;
  };

  const resetPermanentPassword = async (newPassword: string, oldPassword: string) => {
    if (!user) throw new Error("No active session");
    await RostraApi.changePassword(oldPassword, newPassword);
    // The server invalidates tokens issued before the change, so sign in again to get a fresh one.
    const session = await RostraApi.login(user.email, newPassword);
    setUser(session);
    persist(session);
  };

  const updateCurrentUserEmployee = (updates: Partial<Employee>) => {
    if (!user) return;
    const next = { ...user, employee: { ...user.employee, ...updates } };
    setUser(next);
    persist(next);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, updateCurrentUserEmployee, resetPermanentPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
