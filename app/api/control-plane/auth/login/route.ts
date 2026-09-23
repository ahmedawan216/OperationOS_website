import { NextResponse } from "next/server";
import { assertTrustedControlPlaneOrigin, ControlPlaneAuthorizationError } from "@/lib/control-plane/auth-core";
import { issueFounderSession } from "@/lib/control-plane/auth";
import { controlPlaneRequestUrl } from "@/lib/control-plane/host-routing";

function destination(request: Request, pathname: string): URL {
  return controlPlaneRequestUrl({
    internalPathname: pathname,
    requestUrl: request.url,
    forwardedHost: request.headers.get("x-forwarded-host"),
    host: request.headers.get("host"),
    forwardedProto: request.headers.get("x-forwarded-proto"),
    configuredHost: process.env.CONTROL_PLANE_HOST,
  });
}

export async function POST(request: Request) {
  try {
    assertTrustedControlPlaneOrigin({ requestUrl: request.url, origin: request.headers.get("origin"), configuredOrigin: process.env.CONTROL_PLANE_ORIGIN });
    const form = await request.formData();
    const password = form.get("password");
    if (typeof password !== "string") throw new ControlPlaneAuthorizationError("Founder credentials are invalid");
    await issueFounderSession({ password });
    return NextResponse.redirect(destination(request, "/control"), 303);
  } catch {
    const target = destination(request, "/control/login");
    target.searchParams.set("error", "invalid");
    return NextResponse.redirect(target, 303);
  }
}
