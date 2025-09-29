"use client";

import { useCurrentUser } from "@/hooks/use-current-user";
import { ProjectUserDashboard } from "./project-user-dashboard";
// Placeholder page; router and mutations removed after context refactor
import { useProtectPage } from "@/hooks/use-protect-page";
import InternalDashboard from "./internal-dashboard";


export default function DashboardPage() {
  const { user } = useCurrentUser();
  // const router = useRouter();
  useProtectPage();

  if (!user) {
    // The layout should prevent this, but as a fallback:
    return null;
  }

  if (user.role === 'project_user') {
    return <ProjectUserDashboard />;
  }
  return <InternalDashboard />;
}
