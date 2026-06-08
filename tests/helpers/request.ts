import { NextRequest } from "next/server";

export function authedRequest(url: string, token?: string, init?: RequestInit): NextRequest {
  const headers = new Headers(init?.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return new NextRequest(new Request(url, { ...init, headers }));
}

export function authHeader(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}
