import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { createSupabaseAuthClient } from "@/lib/supabase/auth";
import { setSessionCookies } from "@/lib/supabase/auth-cookies";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next");
  const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  if (!code) {
    return NextResponse.redirect(new URL("/sign-in?error=invalid-link", url.origin));
  }

  const supabase = createSupabaseAuthClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session) {
    console.error("Supabase auth callback error:", error);
    return NextResponse.redirect(new URL("/sign-in?error=auth-callback", url.origin));
  }

  const response = NextResponse.redirect(new URL(safeNext, url.origin));
  setSessionCookies(
    response.cookies,
    data.session.access_token,
    data.session.refresh_token
  );

  return response;
}
