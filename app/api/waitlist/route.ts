import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const { name, email } = await req.json();

    // 👇 Paste it here
    const greeting = name?.trim()
      ? `Welcome to OperationOS, ${name.trim()}!`
      : "Welcome to OperationOS!";

    const { error } = await resend.emails.send({
      from: "OperationOS <hello@operationos.org>",
      to: email,
      subject: "Welcome to OperationOS",
      html: `
        <h2>${greeting}</h2>

        <p>Thanks for joining our early access waitlist.</p>

        <p>
          We're building the operating system for AI employees, beginning with RecruitOS.
        </p>

        <p>
          As one of our earliest supporters, you'll receive product updates,
          early access opportunities, and launch announcements before the public.
        </p>

        <p>
          We're excited to have you with us.
        </p>

        <p>
          — Ahmed<br>
          Founder, OperationOS
        </p>
      `,
    });

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { success: false },
      { status: 500 }
    );
  }
}