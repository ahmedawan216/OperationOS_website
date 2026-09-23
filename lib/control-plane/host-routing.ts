const CONTROL_SECTIONS = new Set([
  "products", "agents", "executions", "health", "learnings", "improvements",
  "evaluations", "safety", "approvals", "versions", "meta-agent", "login",
]);

export type ControlHostResolution =
  | { disposition: "next"; privateSurface: boolean }
  | { disposition: "rewrite"; pathname: string; privateSurface: true }
  | { disposition: "redirect"; pathname: string; privateSurface: true }
  | { disposition: "deny"; privateSurface: true };

function normalizedHost(value: string | undefined): string | undefined {
  const normalized = value?.trim().toLowerCase().replace(/\.$/, "");
  return normalized || undefined;
}

function isAsset(pathname: string): boolean {
  return pathname.startsWith("/_next/") || pathname.startsWith("/brand/") || pathname === "/favicon.ico" || pathname === "/apple-icon.png";
}

export function isConfiguredControlPlaneHost(hostname: string, configuredHost?: string): boolean {
  return Boolean(normalizedHost(configuredHost) && normalizedHost(hostname) === normalizedHost(configuredHost));
}

export function controlPlanePath(pathname: string, hostname: string, configuredHost?: string): string {
  if (pathname !== "/control" && !pathname.startsWith("/control/")) throw new Error("Control Panel path must use the internal route namespace");
  if (isConfiguredControlPlaneHost(hostname, configuredHost)) return pathname === "/control" ? "/" : pathname.replace(/^\/control(?=\/)/, "");
  return pathname;
}

export function controlPlaneRequestUrl(input: {
  internalPathname: string;
  requestUrl: string;
  forwardedHost?: string | null;
  host?: string | null;
  forwardedProto?: string | null;
  configuredHost?: string;
}): URL {
  const target = new URL(input.requestUrl);
  const requestHost = (input.forwardedHost?.split(",")[0]?.trim() || input.host?.trim() || target.host);
  const hostname = requestHost.replace(/:\d+$/, "");
  target.host = requestHost;
  if (!requestHost.includes(":")) target.port = "";
  target.protocol = input.forwardedProto ?? target.protocol;
  target.pathname = controlPlanePath(input.internalPathname, hostname, input.configuredHost);
  target.search = "";
  return target;
}

export function resolveControlPlaneHost(input: {
  hostname: string;
  pathname: string;
  configuredHost?: string;
  requireConfiguredHost?: boolean;
}): ControlHostResolution {
  const configuredHost = normalizedHost(input.configuredHost);
  const hostname = normalizedHost(input.hostname);
  const protectedPath = input.pathname === "/control" || input.pathname.startsWith("/control/") || input.pathname.startsWith("/api/control-plane/");

  if (!configuredHost) return input.requireConfiguredHost && protectedPath ? { disposition: "deny", privateSurface: true } : { disposition: "next", privateSurface: protectedPath };
  if (hostname !== configuredHost) return protectedPath ? { disposition: "deny", privateSurface: true } : { disposition: "next", privateSurface: false };
  if (isAsset(input.pathname) || input.pathname.startsWith("/api/control-plane/")) return { disposition: "next", privateSurface: true };
  if (input.pathname === "/control" || input.pathname === "/control/") return { disposition: "redirect", pathname: "/", privateSurface: true };
  if (input.pathname.startsWith("/control/")) {
    const legacySection = input.pathname.slice("/control/".length).replace(/\/$/, "");
    return CONTROL_SECTIONS.has(legacySection)
      ? { disposition: "redirect", pathname: `/${legacySection}`, privateSurface: true }
      : { disposition: "deny", privateSurface: true };
  }
  if (input.pathname === "/") return { disposition: "rewrite", pathname: "/control", privateSurface: true };
  const section = input.pathname.slice(1);
  if (CONTROL_SECTIONS.has(section)) return { disposition: "rewrite", pathname: `/control/${section}`, privateSurface: true };
  return { disposition: "deny", privateSurface: true };
}
