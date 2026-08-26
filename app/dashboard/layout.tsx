import type { ReactNode } from "react";
import { Header } from "@/components/layout/header";
import { requireAuthenticatedUser } from "@/lib/supabase/auth";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  await requireAuthenticatedUser();
  return <><Header dashboard />{children}</>;
}
