import { NextResponse } from "next/server";
import { assertTrustedControlPlaneOrigin, ControlPlaneAuthorizationError } from "@/lib/control-plane/auth-core";
import { issueFounderSession } from "@/lib/control-plane/auth";

export async function POST(request: Request) {
  try {
    assertTrustedControlPlaneOrigin({ requestUrl: request.url, origin: request.headers.get("origin"), configuredOrigin: process.env.CONTROL_PLANE_ORIGIN });
    const form = await request.formData();
    const password = form.get("password");
    if (typeof password !== "string") throw new ControlPlaneAuthorizationError("Founder credentials are invalid");
    await issueFounderSession({ password });
    return NextResponse.redirect(new URL("/control", request.url), 303);
  } catch {
    return NextResponse.redirect(new URL("/control/login?error=invalid", request.url), 303);
  }
}
