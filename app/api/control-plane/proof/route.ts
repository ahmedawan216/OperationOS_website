import { NextResponse } from "next/server";
import { requireFounderSession } from "@/lib/control-plane/auth";
import { assertTrustedControlPlaneOrigin } from "@/lib/control-plane/auth-core";
import { runControlledProof } from "@/lib/agent-runtime/controlled-proof-runner";
import { getServerSupabaseClient } from "@/lib/supabase/server-client";

export const maxDuration = 120;

export async function POST(request: Request) {
  const session = await requireFounderSession();
  try {
    assertTrustedControlPlaneOrigin({ requestUrl: request.url, origin: request.headers.get("origin"),
      configuredOrigin: process.env.CONTROL_PLANE_ORIGIN });
    const tenantId = process.env.CONTROL_PLANE_TENANT_ID?.trim();
    if (process.env.CONTROL_PLANE_DATA_MODE !== "authoritative" || tenantId !== "operationos") {
      throw new Error("Controlled proof tenant is unavailable");
    }
    const result = await runControlledProof({ tenantId, actorId: session.sub,
      client: getServerSupabaseClient() });
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Controlled proof unavailable" },
      { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }
}
