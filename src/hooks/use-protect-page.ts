// Client-side page guard using configured PAGE_ACCESS_RULES; handles redirects & missing permission toasts.
// When options.manual=true it only returns flags allowing caller-controlled navigation.
"use client";

import { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useCurrentUser } from './use-current-user';
import { findAccessRule, Permission } from '@/config/access-control';
import { ROLES_PERMISSIONS } from '@/config/roles';
import { toast } from '@/lib/toast';

export interface UseProtectPageOptions {
  /** Where to send unauthenticated users (no token / not logged in) */
  redirectUnauthed?: string;
  /** Where to send authenticated but forbidden users */
  redirectForbidden?: string;
  /** Disable automatic redirect; just return flags */
  manual?: boolean;
}

export interface UseProtectPageResult {
  loading: boolean;           // still resolving auth/rule
  allowed: boolean;           // user may view page content
  requiresAuth: boolean;      // page has a rule (needs login)
  missing: Permission[];      // permissions the user lacks
  requiredPermissions: Permission[]; // full list required by rule (if any)
  user: { id: number; role: string } | null;
  /** Call to re-run redirect logic manually (useful when manual=true)*/
  recheck: () => void;
}

/**
 * Page-level guard hook using configured PAGE_ACCESS_RULES.
 * - Reads current path & rule via findAccessRule.
 * - Computes permission gap vs current user role.
 * - Optionally auto-redirects to login / fallback.
 */
export function useProtectPage(options: UseProtectPageOptions = {}): UseProtectPageResult {
  const {
    redirectUnauthed = '/login',
    redirectForbidden = '/dashboard',
    manual = false,
  } = options;

  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading } = useCurrentUser();

  const rule = findAccessRule(pathname || '');
  const isPageRule = rule?.type === 'page';

  const userPerms = user ? (ROLES_PERMISSIONS[user.role] || []) : [];
  const userPermSet = new Set(userPerms); // O(1) lookups instead of O(n)
  const required = isPageRule ? (rule?.permissions || []) : [];
  const missing = required.filter(p => !userPermSet.has(p));
  const allowed = !isPageRule || (!!user && missing.length === 0);
  const requiresAuth = Boolean(isPageRule);

  // track if we've already shown a forbidden toast for this pathname to avoid duplicates (e.g., StrictMode)
  const notifiedRef = useRef<string | null>(null);

  // redirect side effect
  useEffect(() => {
    if (manual) return; // user handles it
    if (isLoading) return;
    if (!requiresAuth) return; // public page

    if (!user) {
      router.replace(redirectUnauthed);
      return;
    }
    if (!allowed) {
      if (notifiedRef.current !== pathname) {
        const missingList = missing
          .filter((m): m is Permission => m != null && typeof m === 'string')
          .map(m => m.split(':').pop())
          .filter((part): part is string => typeof part === 'string')
          .join(', ');
        toast.error('You do not have permission to access that page', {
          description: missing.length ? `Missing: ${missingList}` : undefined,
        });
        notifiedRef.current = pathname;
      }
      router.replace(redirectForbidden);
    }
  }, [manual, isLoading, user, allowed, requiresAuth, router, redirectUnauthed, redirectForbidden, pathname, missing]);

  return {
    loading: isLoading,
    allowed,
    requiresAuth,
    missing: missing as Permission[],
    requiredPermissions: required as Permission[],
    user: user ? { id: user.id, role: user.role } : null,
    recheck: () => {
      if (manual) {
        if (!user) router.replace(redirectUnauthed); else if (!allowed) router.replace(redirectForbidden);
      }
    },
  };
}
