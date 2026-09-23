const CONTROL_SECTIONS = new Set([
  "products", "agents", "executions", "health", "learnings", "improvements",
  "evaluations", "safety", "approvals", "versions", "meta-agent", "login",
]);

export type ControlHostResolution =
  | { disposition: "next"; privateSurface: boolean }
  | { disposition: "rewrite"; pathname: string; privateSurface: true }
  | { disposition: "deny"; privateSurface: true };

function normalizedHost(value: string | undefined): string | undefined {
  const normalized = value?.trim().toLowerCase().replace(/\.$/, "");
  return normalized || undefined;
}

function isAsset(pathname: string): boolean {
  return pathname.startsWith("/_next/") || pathname === "/favicon.ico" || pathname === "/apple-icon.png";
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
  if (isAsset(input.pathname) || input.pathname.startsWith("/api/control-plane/") || protectedPath) return { disposition: "next", privateSurface: true };
  if (input.pathname === "/") return { disposition: "rewrite", pathname: "/control", privateSurface: true };
  const section = input.pathname.slice(1);
  if (CONTROL_SECTIONS.has(section)) return { disposition: "rewrite", pathname: `/control/${section}`, privateSurface: true };
  return { disposition: "deny", privateSurface: true };
}
