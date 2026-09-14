"use client";

import { useLayoutEffect } from "react";

type CachedResponse = {
  expiresAt: number;
  status: number;
  statusText: string;
  headers: Array<[string, string]>;
  body: string;
};

const PROFILE_TTL_MS = 120_000;

export default function StudentNetworkGuard() {
  useLayoutEffect(() => {
    const originalFetch = window.fetch.bind(window);
    const cache = new Map<string, CachedResponse>();
    const inflight = new Map<string, Promise<Response>>();

    function profileKey(input: RequestInfo | URL, init?: RequestInit) {
      const rawUrl = typeof input === "string" || input instanceof URL ? String(input) : input.url;
      const url = new URL(rawUrl, window.location.origin);
      if (url.origin !== window.location.origin || url.pathname !== "/api/student/profile") return "";
      const method = String(init?.method || (input instanceof Request ? input.method : "GET") || "GET").toUpperCase();
      if (method !== "GET") return "";
      const headers = new Headers(input instanceof Request ? input.headers : undefined);
      if (init?.headers) new Headers(init.headers).forEach((value, key) => headers.set(key, value));
      const authorization = headers.get("authorization") || "";
      return authorization ? `${url.pathname}|${authorization}` : "";
    }

    function recreate(entry: CachedResponse) {
      return new Response(entry.body, {
        status: entry.status,
        statusText: entry.statusText,
        headers: entry.headers,
      });
    }

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const key = profileKey(input, init);
      if (!key) return originalFetch(input, init);

      const cached = cache.get(key);
      if (cached && cached.expiresAt > Date.now()) return recreate(cached);
      if (cached) cache.delete(key);

      const active = inflight.get(key);
      if (active) return (await active).clone();

      const request = originalFetch(input, init).then(async response => {
        if (response.ok) {
          const clone = response.clone();
          const body = await clone.text();
          cache.set(key, {
            expiresAt: Date.now() + PROFILE_TTL_MS,
            status: response.status,
            statusText: response.statusText,
            headers: Array.from(response.headers.entries()),
            body,
          });
        }
        return response;
      }).finally(() => inflight.delete(key));

      inflight.set(key, request);
      return request;
    };

    return () => {
      window.fetch = originalFetch;
      cache.clear();
      inflight.clear();
    };
  }, []);

  return null;
}
