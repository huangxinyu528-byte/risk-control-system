"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AUTH_STORAGE_KEY } from "@/lib/auth";
import type { AuthUser } from "@/lib/types";

type AuthContextValue = {
  user: AuthUser | null;
  isReady: boolean;
  login: (password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);

    if (raw) {
      try {
        setUser(JSON.parse(raw) as AuthUser);
      } catch {
        window.localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    }

    setIsReady(true);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isReady,
      login: async (password) => {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: password.trim() }),
        });
        const result = (await response.json()) as {
          success: boolean;
          message?: string;
          data?: { user: AuthUser };
        };

        if (!response.ok || !result.success || !result.data?.user) {
          return {
            success: false,
            message: result.message ?? "密码错误",
          };
        }

        window.localStorage.setItem(
          AUTH_STORAGE_KEY,
          JSON.stringify(result.data.user),
        );
        setUser(result.data.user);

        return { success: true };
      },
      logout: () => {
        window.localStorage.removeItem(AUTH_STORAGE_KEY);
        setUser(null);
      },
    }),
    [isReady, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth 必须在 AuthProvider 内使用");
  }

  return context;
}
