// Derives effective permission list from current user role & exposes helpers (can, canAny, lacks).
// Intended for lightweight conditional rendering in client components.
"use client";
import { useCurrentUser } from '@/hooks/use-current-user';
import { ROLES_PERMISSIONS, PERMISSIONS, ROLES } from '@/config/roles';
import { useMemo } from 'react';

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];
type RoleKey = typeof ROLES[keyof typeof ROLES];
type RolePermissionsMap = Record<RoleKey, Permission[]>;

export interface UsePermissionsResult {
  role: string | null;
  permissions: Permission[];
  can: (...required: Permission[]) => boolean;          // all required
  canAny: (...required: Permission[]) => boolean;       // at least one
  lacks: (...required: Permission[]) => Permission[];   // which of required are missing
}

export function usePermissions(): UsePermissionsResult {
  const { user } = useCurrentUser();
  const { perms, permSet } = useMemo(() => {
    if (!user) return { perms: [], permSet: new Set() };
    const map = ROLES_PERMISSIONS as unknown as RolePermissionsMap;
    // Resolve role robustly
    const input = user.role || '';
    function resolveRoleLabel(value: string): string {
      if (!value) return value;
      const direct = (ROLES as any)[value];
      if (direct) return direct;
      const norm = value.trim();
      const normUpper = norm.toUpperCase().replace(/\s+/g, '_');
      const fromUpper = (ROLES as any)[normUpper];
      if (fromUpper) return fromUpper;
      const labels: string[] = Object.values(ROLES as any);
      const match = labels.find(lbl => lbl.toLowerCase() === norm.toLowerCase());
      return match || value;
    }
    const roleLabel = resolveRoleLabel(input);
    const permissions = map[roleLabel as RoleKey] || [];
    return {
      perms: permissions,
      permSet: new Set(permissions) // O(1) lookups
    };
  }, [user?.role]); // Only depend on role, not entire user object

  function can(...required: Permission[]) {
    if (!required.length) return true;
    return required.every(p => permSet.has(p)); // O(1) per check
  }
  function canAny(...required: Permission[]) {
    if (!required.length) return true;
    return required.some(p => permSet.has(p)); // O(1) per check
  }
  function lacks(...required: Permission[]) {
    return required.filter(p => !permSet.has(p)); // O(1) per check
  }
  // Expose resolved role label
  const roleLabel = user ? (((): string => {
    const input = user.role || '';
    const direct = (ROLES as any)[input];
    if (direct) return direct;
    const norm = input.trim();
    const normUpper = norm.toUpperCase().replace(/\s+/g, '_');
    const fromUpper = (ROLES as any)[normUpper];
    if (fromUpper) return fromUpper;
    const labels: string[] = Object.values(ROLES as any);
    const match = labels.find(lbl => lbl.toLowerCase() === norm.toLowerCase());
    return match || input;
  })()) : null;
  return { role: roleLabel, permissions: perms, can, canAny, lacks };
}

// Convenience wrapper component for conditional rendering in JSX
import React from 'react';
export interface IfPermittedProps extends React.PropsWithChildren {
  all?: Permission[];   // all of these
  any?: Permission[];   // or any of these (evaluated if all omitted)
  fallback?: React.ReactNode;
}


