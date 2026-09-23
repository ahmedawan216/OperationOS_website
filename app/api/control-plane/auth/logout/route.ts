import { NextResponse } from "next/server";
import { clearFounderSession, requireFounderSession } from "@/lib/control-plane/auth";
import { assertTrustedControlPlaneOrigin } from "@/lib/control-plane/auth-core";
import { controlPlaneRequestUrl } from "@/lib/control-plane/host-routing";

export async function POST(request: Request) {
  await requireFounderSession();
  assertTrustedControlPlaneOrigin({ requestUrl: request.url, origin: request.headers.get("origin"), configuredOrigin: process.env.CONTROL_PLANE_ORIGIN });
  await clearFounderSession();
  return NextResponse.redirect(controlPlaneRequestUrl({
    internalPathname: "/control/login",
    requestUrl: request.url,
    forwardedHost: request.headers.get("x-forwarded-host"),
    host: request.headers.get("host"),
    forwardedProto: request.headers.get("x-forwarded-proto"),
    configuredHost: process.env.CONTROL_PLANE_HOST,
  }), 303);
}
