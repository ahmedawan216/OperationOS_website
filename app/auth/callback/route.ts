import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { createCookieStorage, createSupabaseAuthClient } from "@/lib/supabase/auth";
import { clearSessionCookies, setSessionCookies } from "@/lib/supabase/auth-cookies";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next");
  const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  if (!code) return NextResponse.redirect(new URL("/sign-in?error=invalid-link", url.origin));

  const cookieStore = await cookies();
  const supabase = createSupabaseAuthClient(undefined, createCookieStorage(cookieStore));
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session) {
    console.error("Supabase auth callback error:", error);
    clearSessionCookies(cookieStore);
    return NextResponse.redirect(new URL("/sign-in?error=auth-callback", url.origin));
  }

  setSessionCookies(cookieStore, data.session.access_token, data.session.refresh_token);
  const response = NextResponse.redirect(new URL(safeNext, url.origin));
  response.cookies.set("operationos-pkce-code-verifier", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
