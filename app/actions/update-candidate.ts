"use server";

import { revalidatePath } from "next/cache";
import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { normalizeEmail } from "@/lib/recruitos/skills";

export async function updateCandidate(candidateId: string, input: { fullName: string; email: string; phone: string; location: string; headline: string }) {
  const user = await requireAuthenticatedUser();
  const email = normalizeEmail(input.email);
  const { data: candidate } = await supabaseAdmin.from("candidates").select("id").eq("id", candidateId).eq("user_id", user.id).single();
  if (!candidate) return { success: false, error: "Candidate not found." };

  const { error } = await supabaseAdmin.from("candidates").update({
    full_name: input.fullName.trim() || null,
    email,
    normalized_email: email,
    phone: input.phone.trim() || null,
    location: input.location.trim() || null,
    headline: input.headline.trim() || null,
    updated_at: new Date().toISOString(),
  }).eq("id", candidateId).eq("user_id", user.id);
  if (error) {
    console.error("Candidate update error:", error);
    return { success: false, error: "Could not update candidate." };
  }
  revalidatePath(`/dashboard/agents/recruitos/candidates/${candidateId}`);
  return { success: true };
}
