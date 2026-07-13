import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    await resend.emails.send({
      from: "onboarding@resend.dev",
      to: email,
      subject: "Welcome to the RecruitOS Waitlist",
      html: `
        <h2>You're on the list 🎉</h2>
        <p>Thanks for joining the RecruitOS waitlist.</p>
        <p>We'll email you as soon as early access is available.</p>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { success: false },
      { status: 500 }
    );
  }
}