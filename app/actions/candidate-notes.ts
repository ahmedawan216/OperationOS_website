"use server";

import { revalidatePath } from "next/cache";
import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function addCandidateNote(candidateId: string, content: string, returnPath?: string) {
  const user = await requireAuthenticatedUser();
  const value = content.trim();
  if (!candidateId || !value) return { success: false, error: "Note cannot be empty." };
  if (value.length > 5000) return { success: false, error: "Note is too long." };

  const { data: candidate } = await supabaseAdmin.from("candidates").select("id").eq("id", candidateId).eq("user_id", user.id).single();
  if (!candidate) return { success: false, error: "Candidate not found." };

  const { error } = await supabaseAdmin.from("candidate_notes").insert({ user_id: user.id, candidate_id: candidateId, content: value });
  if (error) {
    console.error("Candidate note error:", error);
    return { success: false, error: "Could not save the note." };
  }

  await supabaseAdmin.from("candidate_activity").insert({ user_id: user.id, candidate_id: candidateId, type: "note_added", metadata: {} });
  if (returnPath) revalidatePath(returnPath);
  return { success: true };
}

export async function deleteCandidateNote(noteId: string, returnPath?: string) {
  const user = await requireAuthenticatedUser();
  const { error } = await supabaseAdmin.from("candidate_notes").delete().eq("id", noteId).eq("user_id", user.id);
  if (error) {
    console.error("Candidate note delete error:", error);
    return { success: false, error: "Could not delete the note." };
  }
  if (returnPath) revalidatePath(returnPath);
  return { success: true };
}
