import { ControlPlaneView } from "@/components/control-plane/control-plane-view";
import { queryControlPlane } from "@/lib/control-plane/query";
export default async function ControlPlanePage(){return <ControlPlaneView snapshot={await queryControlPlane()} section="overview"/>}
