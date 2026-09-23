import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getServerSupabaseClient } from "./server-client";

let feedbackClient: SupabaseClient | null = null;

function getFeedbackClient(): SupabaseClient {
  feedbackClient ??= getServerSupabaseClient();
  return feedbackClient;
}

export const feedbackSupabase = new Proxy({} as SupabaseClient, {
  get(_target, property, receiver) {
    return Reflect.get(getFeedbackClient(), property, receiver);
  },
});
