import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { HeaderClient } from "@/components/layout/header-client";

export async function Header({ dashboard = false }: { dashboard?: boolean }) {
  const user = await getAuthenticatedUser();
  return <HeaderClient isAuthenticated={Boolean(user)} email={user?.email ?? undefined} dashboard={dashboard} />;
}
