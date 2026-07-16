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
<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#f5f5f5;font-family:Inter,Arial,sans-serif;color:#111827;">
    <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
      <tr>
        <td align="center">

          <table
            width="600"
            cellpadding="0"
            cellspacing="0"
            style="
              max-width:600px;
              width:100%;
              background:#ffffff;
              border:1px solid #e5e7eb;
              border-radius:16px;
              overflow:hidden;
            "
          >

            <!-- Header -->
            <tr>
              <td align="center" style="padding:40px 32px 24px;">
                <img
                  src="https://operationos.org/operationos-logo-final.png"
                  alt="OperationOS"
                  width="56"
                  height="56"
                  style="display:block;margin-bottom:16px;"
                />

                <h1
                  style="
                    margin:0;
                    font-size:28px;
                    font-weight:700;
                    color:#111827;
                  "
                >
                  ${greeting}
                </h1>

                <p
                  style="
                    margin:16px 0 0;
                    font-size:16px;
                    line-height:1.7;
                    color:#4b5563;
                  "
                >
                  Thanks for joining the
                  <strong>OperationOS</strong> early-access waitlist.
                </p>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:0 40px 8px;">

                <p style="font-size:16px;line-height:1.8;color:#374151;">
                  We're building the
                  <strong>operating system for AI employees</strong>,
                  starting with <strong>RecruitOS</strong>.
                </p>

                <p style="font-size:16px;line-height:1.8;color:#374151;">
                  As one of our earliest supporters, you'll receive:
                </p>

                <ul style="color:#374151;font-size:16px;line-height:1.8;padding-left:22px;">
                  <li>Early product updates</li>
                  <li>Exclusive previews and demos</li>
                  <li>Priority access before public launch</li>
                </ul>

              </td>
            </tr>

            <!-- Button -->
            <tr>
              <td align="center" style="padding:20px 40px 8px;">

                <a
                  href="https://operationos.org"
                  style="
                    display:inline-block;
                    background:#111827;
                    color:#ffffff;
                    text-decoration:none;
                    padding:14px 28px;
                    border-radius:10px;
                    font-weight:600;
                    font-size:15px;
                  "
                >
                  Visit OperationOS
                </a>

              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td
                style="
                  padding:32px 40px 40px;
                  text-align:center;
                  font-size:14px;
                  color:#6b7280;
                  line-height:1.8;
                "
              >

                <p style="margin:0 0 12px;">
                  We're excited to build the future with you.
                </p>

                <p style="margin:0;">
                  — Ahmed<br>
                  Founder, OperationOS
                </p>

                <hr
                  style="
                    border:none;
                    border-top:1px solid #e5e7eb;
                    margin:28px 0;
                  "
                >

                <p style="margin:0;">
                  <a
                    href="https://operationos.org"
                    style="color:#111827;text-decoration:none;font-weight:600;"
                  >
                    operationos.org
                  </a>
                </p>

              </td>
            </tr>

          </table>

        </td>
      </tr>
    </table>
  </body>
</html>
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
