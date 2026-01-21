'use client';

import { useEffect, useState } from 'react';
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

type UserPermissionsDetail = {
  id: number;
  name: string | null;
  email: string;
  permissionNames: string[];
};

export default function UserPermissionsPage() {
  const params = useParams<{ id?: string }>();
  const router = useRouter();
  const id = params?.id;

  const { can } = usePermissions();

  const { data: user, error: userError, isLoading: userLoading, mutate: mutateUser } = useSWR<UserPermissionsDetail>(
    id ? `/api/access-control/users/${id}/permissions` : null,
    apiGet
  );

  const { data: perms, error: permsError, isLoading: permsLoading } = useSWR<PermissionsResponse>(
    '/api/access-control/permissions',
    apiGet
  );

  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    setSelected(new Set(user.permissionNames || []));
  }, [user?.id]);

  const savingDisabled = !can(PERMISSIONS.EDIT_USERS);
  const loading = userLoading || permsLoading;

  const allPermissions = perms?.data || [];
  const groupedPermissionNames = new Set(
    PERMISSION_GROUPS.flatMap((g) => g.permissions)
  );
  const otherPermissions = allPermissions.filter(
    (p) => !groupedPermissionNames.has(p.permissionName)
  );

  function toggle(name: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(name);
      else next.delete(name);
      return next;
    });
  }

  async function save() {
    if (!id) return;
    try {
      const permissionNames = Array.from(selected);
      await apiPut(`/api/access-control/users/${id}/permissions`, { permissionNames });
      toast.success('User permissions updated');
      await mutateUser();
    } catch (e) {
      toast.error((e as Error).message || 'Failed to update permissions');
    }
  }

  return (
    <AppCard>
      <AppCard.Header>
        <AppCard.Title>
          {user ? `User Permissions: ${user.email}` : 'User Permissions'}
        </AppCard.Title>
        <AppCard.Description>
          Assign user-specific permissions. Effective permissions are role permissions + user permissions.
        </AppCard.Description>
        <AppCard.Action>
          <AppButton
            variant='secondary'
            size='sm'
            type='button'
            onClick={() => router.push('/users')}
          >
            Back
          </AppButton>
        </AppCard.Action>
      </AppCard.Header>

      <AppCard.Content>
        {userError || permsError ? (
          <div className='text-sm text-destructive'>
            {(userError as Error)?.message || (permsError as Error)?.message || 'Failed to load'}
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
        <AppButton type='button' onClick={save} disabled={savingDisabled || loading}>
          Save
        </AppButton>
      </AppCard.Footer>
    </AppCard>
  );
}
