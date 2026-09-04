import { NextResponse } from "next/server";
import { Resend } from "resend";

let resendClient: Resend | null = null;

function getResendClient(): Resend {
  if (resendClient) {
    return resendClient;
  }

  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error("RESEND_API_KEY is missing from environment variables.");
  }

  resendClient = new Resend(apiKey);
  return resendClient;
}

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://operationos.org";

export async function POST(req: Request) {
  try {
    const { name, email } = await req.json();

    if (typeof email !== "string" || !email.trim()) {
      return NextResponse.json({ success: false, error: "Email is required." }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const safeName = typeof name === "string" ? name.trim() : "";
    const greeting = safeName ? `Welcome to OperationOS, ${safeName}!` : "Welcome to OperationOS!";

    const resend = getResendClient();
    const { error } = await resend.emails.send({
      from: "OperationOS <hello@operationos.org>",
      to: normalizedEmail,
      subject: "Welcome to OperationOS",
      html: `<!DOCTYPE html><html><body style="margin:0;padding:40px 16px;background:#f5f5f5;font-family:Inter,Arial,sans-serif;color:#111827"><table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border:1px solid #e5e7eb;border-radius:16px"><tr><td style="padding:40px"><h1 style="margin:0;font-size:28px">${greeting}</h1><p style="font-size:16px;line-height:1.7;color:#4b5563">Thanks for joining the <strong>OperationOS</strong> early-access waitlist.</p><p style="font-size:16px;line-height:1.8;color:#374151">OperationOS builds focused software for operational work, starting with <strong>RecruitOS</strong>.</p><ul style="color:#374151;font-size:16px;line-height:1.8"><li>Early product updates</li><li>Exclusive previews and demos</li><li>Priority access before public launch</li></ul><p><a href="${siteUrl}" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:600">Visit OperationOS</a></p><p style="margin-top:32px;color:#6b7280">— Ahmed<br>Founder, OperationOS</p></td></tr></table></td></tr></table></body></html>`,
    });

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Waitlist signup error:", error);
    return NextResponse.json({ success: false, error: "Unable to join the waitlist right now." }, { status: 500 });
  }
}
