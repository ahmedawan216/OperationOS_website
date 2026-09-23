import "server-only";
import { unstable_noStore as noStore } from "next/cache";
import { requireFounderSession } from "./auth";
import { getConfiguredControlPlaneProvider, readControlPlaneSnapshot } from "./provider";

export async function queryControlPlane(productKey?: string) {
  noStore();
  const session = await requireFounderSession();
  const provider = await getConfiguredControlPlaneProvider();
  return readControlPlaneSnapshot({ provider, founderId: session.sub, productKey });
}
