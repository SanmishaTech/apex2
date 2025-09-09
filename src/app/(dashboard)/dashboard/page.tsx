"use client";

import { useCurrentUser } from "@/hooks/use-current-user";
import { ProjectUserDashboard } from "./project-user-dashboard";
// Placeholder page; router and mutations removed after context refactor


export default function DashboardPage() {
  const { user } = useCurrentUser();
  // const router = useRouter();

  if (!user) {
    // The layout should prevent this, but as a fallback:
    return null;
  }

  if (user.role === 'project_user') {
    return <ProjectUserDashboard />;
  }
  return <div className="p-4">{/* future internal dashboard content */}</div>;
}
