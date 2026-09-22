import "server-only";

import { controlPlaneSnapshotSchema, type ControlPlaneSnapshot } from "./contracts";

export interface ControlPlaneDataProvider {
  readonly mode: "authoritative" | "fixture";
  readSnapshot(input: { founderId: string; productKey?: string }): Promise<unknown>;
}

export class ControlPlaneConfigurationError extends Error {
  readonly code = "CONTROL_PLANE_NOT_CONFIGURED";
}

export async function readControlPlaneSnapshot(input: {
  provider: ControlPlaneDataProvider;
  founderId: string;
  productKey?: string;
}): Promise<ControlPlaneSnapshot> {
  if (!input.founderId) throw new Error("Authorized founder identity is required");
  const parsed = controlPlaneSnapshotSchema.parse(await input.provider.readSnapshot({ founderId: input.founderId, productKey: input.productKey }));
  if (parsed.sourceMode !== input.provider.mode) throw new Error("Control Plane provider mode mismatch");
  if (input.productKey) {
    const leaked = [parsed.products, parsed.executions, parsed.learnings, parsed.improvements].flat().some((item) => "productKey" in item && item.productKey !== input.productKey);
    if (leaked) throw new Error("Cross-product projection leakage detected");
  }
  return parsed;
}

export function assertFixtureModeAllowed(environment: string | undefined): void {
  if (environment === "production") throw new ControlPlaneConfigurationError("Fixture Control Plane data is forbidden in production");
}

export async function getConfiguredControlPlaneProvider(): Promise<ControlPlaneDataProvider> {
  if (process.env.CONTROL_PLANE_DATA_MODE === "fixture") {
    assertFixtureModeAllowed(process.env.NODE_ENV);
    const { fixtureControlPlaneProvider } = await import("./testing/fixture-provider");
    return fixtureControlPlaneProvider;
  }
  throw new ControlPlaneConfigurationError("An authoritative Control Plane provider must be configured");
}
