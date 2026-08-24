import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

type Props = { params: Promise<{ resumeId: string }> };

export async function GET(_request: Request, { params }: Props) {
  try {
    const user = await requireAuthenticatedUser();
    const { resumeId } = await params;
    const { data: resume, error } = await supabaseAdmin.from("resumes").select("storage_path").eq("id", resumeId).eq("user_id", user.id).single();
    if (error || !resume) return NextResponse.json({ error: "Resume not found." }, { status: 404 });

    const { data, error: signedUrlError } = await supabaseAdmin.storage.from("resumes").createSignedUrl(resume.storage_path, 60 * 5);
    if (signedUrlError || !data?.signedUrl) {
      console.error("Resume signed URL error:", signedUrlError);
      return NextResponse.json({ error: "Resume is temporarily unavailable." }, { status: 500 });
    }
    return NextResponse.redirect(data.signedUrl);
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    console.error("Resume download error:", error);
    return NextResponse.json({ error: "Unable to open resume." }, { status: 500 });
  }
}
