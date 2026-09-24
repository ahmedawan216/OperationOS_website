import { NextResponse, type NextRequest } from "next/server";

import { resolveControlPlaneHost } from "./lib/control-plane/host-routing";

function privateHeaders(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");
  return response;
}

function requestFacingUrl(request: NextRequest, requestHost: string): URL {
  const target = request.nextUrl.clone();
  target.host = requestHost;
  if (!requestHost.includes(":")) target.port = "";
  target.protocol = request.headers.get("x-forwarded-proto") ?? target.protocol;
  return target;
}

export function middleware(request: NextRequest) {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const requestHost = forwardedHost || request.headers.get("host")?.trim() || request.nextUrl.hostname;
  const hostname = requestHost.replace(/:\d+$/, "");
  const resolution = resolveControlPlaneHost({
    hostname,
    pathname: request.nextUrl.pathname,
    configuredHost: process.env.CONTROL_PLANE_HOST,
    requireConfiguredHost: process.env.NODE_ENV === "production",
  });
  if (resolution.disposition === "deny") return privateHeaders(new NextResponse(null, { status: 404 }));
  if (resolution.disposition === "rewrite") {
    const target = request.nextUrl.clone();
    target.pathname = resolution.pathname;
    return privateHeaders(NextResponse.rewrite(target));
  }
  if (resolution.disposition === "redirect") {
    const target = requestFacingUrl(request, requestHost);
    target.pathname = resolution.pathname;
    return privateHeaders(NextResponse.redirect(target, 308));
  }
  const response = NextResponse.next();
  return resolution.privateSurface ? privateHeaders(response) : response;
}

export const config = { matcher: "/:path*" };
