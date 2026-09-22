import "server-only";
import { requireFounderSession } from "./auth";
import { getConfiguredControlPlaneProvider, readControlPlaneSnapshot } from "./provider";

export async function queryControlPlane(productKey?: string) {
  const session = await requireFounderSession();
  const provider = await getConfiguredControlPlaneProvider();
  return readControlPlaneSnapshot({ provider, founderId: session.sub, productKey });
}
