import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  clearSessionCookies,
  setSessionCookies,
} from "@/lib/supabase/auth-cookies";

const AUTH_REQUEST_TIMEOUT_MS = 5000;

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_ANON_KEY;

  if (!url || !key) return null;
  return { url, key };
}

async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AUTH_REQUEST_TIMEOUT_MS);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function createAuthClient(url: string, key: string, accessToken?: string) {
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: fetchWithTimeout,
      ...(accessToken
        ? {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        : {}),
    },
  });
}

export async function middleware(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith("/dashboard")) {
    return NextResponse.next();
  }

  const response = NextResponse.next();
  const config = getSupabaseConfig();

  if (!config) {
    return NextResponse.redirect(new URL("/sign-in?error=config", request.url));
  }

  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;

  if (accessToken) {
    const supabase = createAuthClient(config.url, config.key, accessToken);
    const { data } = await supabase.auth.getClaims(accessToken);
    if (data?.claims) return response;
  }

  if (refreshToken) {
    const refreshClient = createAuthClient(config.url, config.key);
    const { data, error } = await refreshClient.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (!error && data.session && data.user) {
      setSessionCookies(
        response.cookies,
        data.session.access_token,
        data.session.refresh_token
      );
      return response;
    }
  }

  clearSessionCookies(response.cookies);
  const signInUrl = new URL("/sign-in", request.url);
  signInUrl.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(signInUrl);
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
