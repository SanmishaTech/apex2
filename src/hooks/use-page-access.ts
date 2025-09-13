// (Deprecated) Transitional wrapper around useProtectPage providing legacy shape.
// Prefer importing useProtectPage directly in new code.
"use client";

// DEPRECATED: Prefer useProtectPage({ manual: true })
// This file will be removed after migration.
import { useProtectPage } from './use-protect-page';

export interface PageAccessResult {
  allowed: boolean;      // whether user is allowed (true if no rule)
  checking: boolean;     // still loading user state
  requiresAuth: boolean; // rule exists thus requires auth
  requiredPermissions: string[]; // permissions needed (empty if none)
}

export function usePageAccess(): PageAccessResult {
  const { loading, allowed, requiresAuth, requiredPermissions } = useProtectPage({ manual: true });
  return { allowed, checking: loading, requiresAuth, requiredPermissions };
}
