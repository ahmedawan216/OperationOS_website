import { ControlPlaneShell } from "@/components/control-plane/control-plane-shell";
import { readFounderSession } from "@/lib/control-plane/auth";
import { founderLoginForUnauthenticatedPage, isConfiguredControlPlaneHost } from "@/lib/control-plane/host-routing";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

export default async function PrivateControlLayout({ children }: { children: React.ReactNode }) {
  const requestHeaders = await headers();
  const host = (requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "").split(",")[0]!.trim().replace(/:\d+$/, "");
  const session = await readFounderSession();
  if (!session) {
    const login = founderLoginForUnauthenticatedPage(host, process.env.CONTROL_PLANE_HOST);
    if (login) redirect(login);
    notFound();
  }
  const cleanUrls = isConfiguredControlPlaneHost(host, process.env.CONTROL_PLANE_HOST);
  return <ControlPlaneShell founderId={session.sub} cleanUrls={cleanUrls}>{children}</ControlPlaneShell>;
}
