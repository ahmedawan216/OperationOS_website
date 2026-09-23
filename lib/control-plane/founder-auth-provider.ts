import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { FounderIdentityVerifier } from "./auth-core";

function required(name: string, value: string | undefined): string {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`${name} is not configured`);
  return normalized;
}

export function createSupabaseFounderIdentityVerifier(): FounderIdentityVerifier {
  const url = required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
  const publishableKey = required(
    "SUPABASE_PUBLISHABLE_KEY",
    process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  const founderEmail = required("CONTROL_PLANE_FOUNDER_EMAIL", process.env.CONTROL_PLANE_FOUNDER_EMAIL).toLowerCase();
  const client = createClient(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });

  return {
    async verifyPassword(password: string): Promise<boolean> {
      const { data, error } = await client.auth.signInWithPassword({ email: founderEmail, password });
      if (error || !data.session?.access_token) return false;
      const { data: verified, error: verificationError } = await client.auth.getUser(data.session.access_token);
      if (verificationError || !verified.user) return false;
      return verified.user.email?.toLowerCase() === founderEmail;
    },
  };
}
