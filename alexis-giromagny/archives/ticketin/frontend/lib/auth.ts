"use client";

export type Role = "ADMIN" | "AGENT" | "CLIENT";

export interface CurrentUser {
  sub: string;
  email: string;
  organizationId: string;
  role: Role;
}

const TOKEN_KEY = "ticketin_token";

export function setToken(token: string): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(TOKEN_KEY, token);
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function clearToken(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(TOKEN_KEY);
  }
}

/** Décode le payload du JWT (sans vérifier la signature — usage purement UI). */
export function getCurrentUser(): CurrentUser | null {
  const token = getToken();
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    const decoded = JSON.parse(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/")),
    ) as CurrentUser & { exp?: number };
    if (decoded.exp && decoded.exp * 1000 < Date.now()) {
      clearToken();
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}
