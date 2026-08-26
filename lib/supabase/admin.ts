import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let supabaseAdminClient: SupabaseClient | null = null;

function getSupabaseAdminClient(): SupabaseClient {
  if (supabaseAdminClient) {
    return supabaseAdminClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error("Supabase URL is missing from environment variables.");
  }

  if (!supabaseServiceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing from environment variables.");
  }

  supabaseAdminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  return supabaseAdminClient;
}

/**
 * Lazily initializes the service-role Supabase client on first property access.
 * This keeps build-time module evaluation from requiring production secrets while
 * preserving the existing `supabaseAdmin` API used throughout the application.
 */
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, property, receiver) {
    return Reflect.get(getSupabaseAdminClient(), property, receiver);
  },
});
