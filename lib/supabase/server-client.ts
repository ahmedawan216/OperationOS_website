import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let serverClient: SupabaseClient | undefined;

function required(name: string, value: string | undefined): string {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`${name} is not configured`);
  return normalized;
}

export function getServerSupabaseClient(): SupabaseClient {
  if (serverClient) return serverClient;
  const url = required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
  const secret = required("SUPABASE_SECRET_KEY", process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY);
  serverClient = createClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  return serverClient;
}
