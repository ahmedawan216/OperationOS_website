import "server-only";

import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@/lib/supabase/auth-cookies";

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase public URL/key is missing from environment variables.");
  return { url, key };
}

export function createSupabaseAuthClient(accessToken?: string) {
  const { url, key } = getSupabaseConfig();
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
      flowType: "pkce",
    },
    ...(accessToken ? { global: { headers: { Authorization: `Bearer ${accessToken}` } } } : {}),
  });
}

export async function getAuthenticatedUser() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!accessToken) return null;

  const supabase = createSupabaseAuthClient(accessToken);
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) return null;
  return data.user;
}

export async function requireAuthenticatedUser() {
  const user = await getAuthenticatedUser();
  if (!user) throw new Error("AUTH_REQUIRED");
  return user;
}

export async function getAuthTokens() {
  const cookieStore = await cookies();
  return {
    accessToken: cookieStore.get(ACCESS_TOKEN_COOKIE)?.value ?? null,
    refreshToken: cookieStore.get(REFRESH_TOKEN_COOKIE)?.value ?? null,
  };
}

export function getSafeRedirectPath(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return "/dashboard";
  if (!value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}
