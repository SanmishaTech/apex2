'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { apiGet, apiPut } from '@/lib/api-client';
import { AppCard } from '@/components/common/app-card';
import { AppButton } from '@/components/common/app-button';
import { AppCheckbox } from '@/components/common/app-checkbox';
import { toast } from '@/lib/toast';
import { usePermissions } from '@/hooks/use-permissions';
import { PERMISSIONS, PERMISSION_GROUPS } from '@/config/roles';

type PermissionRow = { id: number; permissionName: string };
type PermissionsResponse = { data: PermissionRow[] };

type RoleDetail = {
  id: number;
  name: string;
  description: string | null;
  permissionNames: string[];
};

export default function RolePermissionsPage() {
  const params = useParams<{ id?: string }>();
  const router = useRouter();
  const id = params?.id;

  const { can } = usePermissions();

  const { data: role, error: roleError, isLoading: roleLoading, mutate: mutateRole } = useSWR<RoleDetail>(
    id ? `/api/access-control/roles/${id}` : null,
    apiGet
  );

  const { data: perms, error: permsError, isLoading: permsLoading } = useSWR<PermissionsResponse>(
    '/api/access-control/permissions',
    apiGet
  );

  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!role) return;
    setSelected(new Set(role.permissionNames || []));
  }, [role?.id]);

  const savingDisabled = !can(PERMISSIONS.EDIT_ROLES_PERMISSIONS);

  async function save() {
    if (!id) return;
    try {
      const permissionNames = Array.from(selected);
      await apiPut(`/api/access-control/roles/${id}/permissions`, { permissionNames });
      toast.success('Role permissions updated');
      await mutateRole();
    } catch (e) {
      toast.error((e as Error).message || 'Failed to update permissions');
    }
  }

  function toggle(name: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(name);
      else next.delete(name);
      return next;
    });
  }

  const loading = roleLoading || permsLoading;

  const allPermissions = perms?.data || [];
  const groupedPermissionNames = new Set(
    PERMISSION_GROUPS.flatMap((g) => g.permissions)
  );
  const otherPermissions = allPermissions.filter(
    (p) => !groupedPermissionNames.has(p.permissionName)
  );

  return (
    <AppCard>
      <AppCard.Header>
        <AppCard.Title>{role ? `Role: ${role.name}` : 'Role'}</AppCard.Title>
        <AppCard.Description>Toggle permissions for this role.</AppCard.Description>
        <AppCard.Action>
          <AppButton
            variant='secondary'
            size='sm'
            type='button'
            onClick={() => router.push('/roles')}
          >
            Back
          </AppButton>
        </AppCard.Action>
      </AppCard.Header>

      <AppCard.Content>
        {roleError || permsError ? (
          <div className='text-sm text-destructive'>
            {(roleError as Error)?.message || (permsError as Error)?.message || 'Failed to load'}
          </div>
        ) : null}

        {loading ? (
          <div className='text-sm text-muted-foreground'>Loading...</div>
        ) : (
          <div className='space-y-6'>
            {PERMISSION_GROUPS.map((group) => {
              const items = allPermissions.filter((p) =>
                group.permissions.includes(p.permissionName)
              );
              if (!items.length) return null;
              return (
                <div
                  key={group.key}
                  className='rounded-md border bg-muted/20 p-3 space-y-2'
                >
                  <div className='text-sm font-medium'>{group.label}</div>
                  <div className='grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3'>
                    {items.map((p) => (
                      <AppCheckbox
                        key={p.permissionName}
                        label={p.permissionName}
                        className='col-span-1 mt-0'
                        checked={selected.has(p.permissionName)}
                        onCheckedChange={(v) => toggle(p.permissionName, v)}
                        disabled={savingDisabled}
                      />
                    ))}
                  </div>
                </div>
              );
            })}

            {otherPermissions.length ? (
              <div className='rounded-md border bg-muted/20 p-3 space-y-2'>
                <div className='text-sm font-medium'>Other</div>
                <div className='grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3'>
                  {otherPermissions.map((p) => (
                    <AppCheckbox
                      key={p.permissionName}
                      label={p.permissionName}
                      className='col-span-1 mt-0'
                      checked={selected.has(p.permissionName)}
                      onCheckedChange={(v) => toggle(p.permissionName, v)}
                      disabled={savingDisabled}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </AppCard.Content>

      <AppCard.Footer className='justify-end'>
        <AppButton
          type='button'
          onClick={save}
          disabled={savingDisabled || loading}
        >
          Save
        </AppButton>
      </AppCard.Footer>
    </AppCard>
  );
}
