import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let feedbackClient: SupabaseClient | null = null;

function getFeedbackClient(): SupabaseClient {
  if (feedbackClient) return feedbackClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error("Supabase URL is missing from environment variables.");
  }

  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing from environment variables.");
  }

  feedbackClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  return feedbackClient;
}

export const feedbackSupabase = new Proxy({} as SupabaseClient, {
  get(_target, property, receiver) {
    return Reflect.get(getFeedbackClient(), property, receiver);
  },
});
