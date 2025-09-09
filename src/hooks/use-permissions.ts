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
  const perms: Permission[] = useMemo(() => {
    if (!user) return [];
    const map = ROLES_PERMISSIONS as unknown as RolePermissionsMap;
    return map[user.role as RoleKey] || [];
  }, [user]);

  function can(...required: Permission[]) {
    if (!required.length) return true;
    return required.every(p => perms.includes(p));
  }
  function canAny(...required: Permission[]) {
    if (!required.length) return true;
    return required.some(p => perms.includes(p));
  }
  function lacks(...required: Permission[]) {
    return required.filter(p => !perms.includes(p));
  }
  return { role: user?.role || null, permissions: perms, can, canAny, lacks };
}

// Convenience wrapper component for conditional rendering in JSX
import React from 'react';
export interface IfPermittedProps extends React.PropsWithChildren {
  all?: Permission[];   // all of these
  any?: Permission[];   // or any of these (evaluated if all omitted)
  fallback?: React.ReactNode;
}


