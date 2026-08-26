import { supabaseAdmin } from "@/lib/supabase/admin";
import type { CandidateProfile } from "@/lib/recruitos/candidate-extraction";

export async function upsertCandidateFromProfile(userId: string, profile: CandidateProfile) {
  const normalizedEmail = profile.email?.trim().toLowerCase() || null;
  let candidateId: string | null = null;

  if (normalizedEmail) {
    const { data: existing, error: lookupError } = await supabaseAdmin
      .from("candidates")
      .select("id")
      .eq("user_id", userId)
      .eq("normalized_email", normalizedEmail)
      .maybeSingle();

    if (lookupError) throw lookupError;
    candidateId = existing?.id ?? null;
  }

  const candidateData = {
    user_id: userId,
    full_name: profile.fullName,
    email: profile.email,
    normalized_email: normalizedEmail,
    phone: profile.phone,
    location: profile.location,
    headline: profile.headline,
    skills: profile.skills,
    experience: profile.experience,
    education: profile.education,
    years_experience: profile.yearsExperience,
    updated_at: new Date().toISOString(),
  };

  if (candidateId) {
    const { data, error } = await supabaseAdmin
      .from("candidates")
      .update(candidateData)
      .eq("id", candidateId)
      .eq("user_id", userId)
      .select("id")
      .single();
    if (error || !data) throw error ?? new Error("Candidate update failed.");
    return data.id as string;
  }

  const { data, error } = await supabaseAdmin
    .from("candidates")
    .insert(candidateData)
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("Candidate creation failed.");
  return data.id as string;
}

export async function assertCandidateOwnership(userId: string, candidateId: string) {
  const { data, error } = await supabaseAdmin
    .from("candidates")
    .select("id")
    .eq("id", candidateId)
    .eq("user_id", userId)
    .single();
  if (error || !data) throw new Error("CANDIDATE_NOT_FOUND");
  return data;
}
