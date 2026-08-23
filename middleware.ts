import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  clearSessionCookies,
  setSessionCookies,
} from "@/lib/supabase/auth-cookies";

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_ANON_KEY;

  if (!url || !key) return null;
  return { url, key };
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
  const supabase = createClient(config.url, config.key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    ...(accessToken
      ? {
          global: {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          },
        }
      : {}),
  });

  if (accessToken) {
    const { data } = await supabase.auth.getUser(accessToken);
    if (data.user) return response;
  }

  if (refreshToken) {
    const refreshClient = createClient(config.url, config.key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });

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
