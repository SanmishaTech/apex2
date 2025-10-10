"use client";

import { useCurrentUser } from "@/hooks/use-current-user";
import { useProtectPage } from "@/hooks/use-protect-page";
import InternalDashboard from "./internal-dashboard";

export default function DashboardPage() {
  const { user } = useCurrentUser();
  useProtectPage();

  if (!user) {
    // The layout should prevent this, but as a fallback:
    return null;
  }

  return <InternalDashboard />;
}
