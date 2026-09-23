import { ControlPlaneShell } from "@/components/control-plane/control-plane-shell";
import { requireFounderSession } from "@/lib/control-plane/auth";

export default async function PrivateControlLayout({ children }: { children: React.ReactNode }) {
  const session = await requireFounderSession();
  return <ControlPlaneShell founderId={session.sub}>{children}</ControlPlaneShell>;
}
