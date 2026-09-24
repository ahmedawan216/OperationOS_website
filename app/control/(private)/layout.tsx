import { ControlPlaneShell } from "@/components/control-plane/control-plane-shell";
import { requireFounderSession } from "@/lib/control-plane/auth";
import { isConfiguredControlPlaneHost } from "@/lib/control-plane/host-routing";
import { headers } from "next/headers";

export default async function PrivateControlLayout({ children }: { children: React.ReactNode }) {
  const session = await requireFounderSession();
  const requestHeaders = await headers();
  const host = (requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "").split(",")[0]!.trim().replace(/:\d+$/, "");
  const cleanUrls = isConfiguredControlPlaneHost(host, process.env.CONTROL_PLANE_HOST);
  return <ControlPlaneShell founderId={session.sub} cleanUrls={cleanUrls}>{children}</ControlPlaneShell>;
}
