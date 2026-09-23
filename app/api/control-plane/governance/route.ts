import { NextResponse } from "next/server";

import { requireFounderSession } from "@/lib/control-plane/auth";
import { assertTrustedControlPlaneOrigin } from "@/lib/control-plane/auth-core";
import { executeGovernanceAction, founderGovernanceRequestSchema } from "@/lib/control-plane/governance";
import { getConfiguredControlPlaneProvider, readControlPlaneSnapshot } from "@/lib/control-plane/provider";
import { getConfiguredGovernanceAdapter } from "@/lib/control-plane/supabase-governance";

function redirect(request: Request, path: string, result: "success" | "failed") {
  return NextResponse.redirect(new URL(`${path}?result=${result}`, request.url), 303);
}

export async function POST(request: Request) {
  const session = await requireFounderSession();
  let failurePath = "/control/approvals";
  try {
    assertTrustedControlPlaneOrigin({
      requestUrl: request.url,
      origin: request.headers.get("origin"),
      configuredOrigin: process.env.CONTROL_PLANE_ORIGIN,
    });
    const form = Object.fromEntries((await request.formData()).entries());
    if (form.action === "request_canary_rollback") failurePath = "/control/versions";
    const command = founderGovernanceRequestSchema.parse(form);
    const provider = await getConfiguredControlPlaneProvider();
    const snapshot = await readControlPlaneSnapshot({
      provider,
      founderId: session.sub,
      productKey: command.productKey,
    });
    const adapter = getConfiguredGovernanceAdapter();
    const now = new Date().toISOString();

    if (command.action === "resolve_approval") {
      const approval = snapshot.approvals.find((item) => item.approvalId === command.approvalId);
      await executeGovernanceAction({
        founderId: session.sub,
        request: { ...command, actorId: session.sub, resolvedAt: now },
        approval,
        approvalResolver: adapter,
      });
      return redirect(request, "/control/approvals", "success");
    }

    const canary = snapshot.canaries.find((item) => item.canaryId === command.canaryId);
    await executeGovernanceAction({
      founderId: session.sub,
      request: { ...command, actorId: session.sub, requestedAt: now },
      canary,
      rollbackController: adapter,
    });
    return redirect(request, "/control/versions", "success");
  } catch {
    return redirect(request, failurePath, "failed");
  }
}
