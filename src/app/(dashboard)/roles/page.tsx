'use client';

import useSWR from 'swr';
import Link from 'next/link';
import { apiGet } from '@/lib/api-client';
import { AppCard } from '@/components/common/app-card';
import { AppButton } from '@/components/common/app-button';
import { DataTable, Column } from '@/components/common/data-table';
import { usePermissions } from '@/hooks/use-permissions';
import { PERMISSIONS } from '@/config/roles';
import { EditButton } from '@/components/common/icon-button';
import { useScrollRestoration } from '@/hooks/use-scroll-restoration';

type RoleRow = {
  id: number;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { permissions: number; users: number };
};

type RolesResponse = { data: RoleRow[] };

export default function RolesPage() {
  const { data, error, isLoading } = useSWR<RolesResponse>(
    '/api/access-control/roles',
    apiGet
  );

  const { can } = usePermissions();
  const { pushWithScrollSave } = useScrollRestoration('roles-list');

  const columns: Column<RoleRow>[] = [
    {
      key: 'name',
      header: 'Role',
      accessor: (r) => r.name,
      cellClassName: 'font-medium whitespace-nowrap',
    },
    {
      key: 'permissions',
      header: 'Permissions',
      accessor: (r) => String(r._count?.permissions ?? 0),
      className: 'text-right whitespace-nowrap',
      cellClassName: 'text-right tabular-nums whitespace-nowrap',
    },
    {
      key: 'users',
      header: 'Users',
      accessor: (r) => String(r._count?.users ?? 0),
      className: 'text-right whitespace-nowrap',
      cellClassName: 'text-right tabular-nums whitespace-nowrap',
    },
  ];

  return (
    <AppCard>
      <AppCard.Header>
        <AppCard.Title>Roles</AppCard.Title>
        <AppCard.Description>Manage role permissions.</AppCard.Description>
        {can(PERMISSIONS.EDIT_ROLES_PERMISSIONS) && (
          <AppCard.Action>
            <div className='flex gap-2'>
              <AppButton
                size='sm'
                iconName='Plus'
                type='button'
                onClick={() => pushWithScrollSave('/roles/new')}
              >
                Add Role
              </AppButton>
            </div>
          </AppCard.Action>
        )}
      </AppCard.Header>
      <AppCard.Content>
        {error ? (
          <div className='text-sm text-destructive'>
            {(error as Error).message || 'Failed to load roles'}
          </div>
        ) : null}

        <DataTable
          columns={columns}
          data={data?.data || []}
          loading={isLoading}
          stickyColumns={1}
          renderRowActions={(r) => {
            if (!can(PERMISSIONS.EDIT_ROLES_PERMISSIONS)) return null;
            return (
              <div className='flex items-center gap-2'>
              {/* Dont give edit options as business logic depends on it */}
                {/* <EditButton
                  tooltip='Edit Role'
                  aria-label='Edit Role'
                  onClick={() => pushWithScrollSave(`/roles/${r.id}/edit`)}
                /> */}
                <Link href={`/roles/${r.id}`}>
                  <AppButton size='sm' variant='secondary' type='button'>
                    Edit Permissions
                  </AppButton>
                </Link>
              </div>
            );
          }}
        />
      </AppCard.Content>
    </AppCard>
  );
}
