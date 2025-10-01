'use client';
import useSWR from 'swr';
import Link from 'next/link';
import { useMemo, useState, useEffect } from 'react';
import { apiGet, apiDelete } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { AppCard } from '@/components/common/app-card';
import { AppButton } from '@/components/common/app-button';
import { FilterBar } from '@/components/common';
import { NonFormTextInput } from '@/components/common/non-form-text-input';
import { DataTable, type Column } from '@/components/common/data-table';
import { DeleteButton } from '@/components/common/delete-button';
import { EditButton } from '@/components/common/icon-button';
import { Pagination } from '@/components/common/pagination';
import { usePermissions } from '@/hooks/use-permissions';
import { useProtectPage } from '@/hooks/use-protect-page';
import { PERMISSIONS } from '@/config/roles';
import { useQueryParamsState } from '@/hooks/use-query-params-state';
import { formatDate, formatRelativeTime } from '@/lib/locales';
import { useScrollRestoration } from '@/hooks/use-scroll-restoration';

type NoticeListItem = {
  id: number;
  noticeHead: string;
  noticeHeading: string;
  noticeDescription?: string | null;
  documentUrl?: string | null;
  createdAt: string;
  updatedAt: string;
};

type NoticesResponse = {
  data: NoticeListItem[];
  meta: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
};

export default function NoticesPage() {
  useProtectPage();
  
  const { pushWithScrollSave } = useScrollRestoration('notices-list');
  const [qp, setQp] = useQueryParamsState({ page: 1, perPage: 10, search: '' });
  const { page, perPage, search } = qp as unknown as { page: number; perPage: number; search: string };

  const [searchDraft, setSearchDraft] = useState(search);
  useEffect(() => { setSearchDraft(search); }, [search]);
  const filtersDirty = searchDraft !== search;

  function applyFilters() { setQp({ page: 1, search: searchDraft.trim() }); }
  function resetFilters() { setSearchDraft(''); setQp({ page: 1, search: '' }); }

  const query = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set('page', String(page));
    sp.set('perPage', String(perPage));
    if (search) sp.set('search', search);
    return `/api/notices?${sp.toString()}`;
  }, [page, perPage, search]);

  const { data, error, isLoading, mutate } = useSWR<NoticesResponse>(query, apiGet);
  const { can } = usePermissions();
  if (error) toast.error((error as Error).message || 'Failed to load notices');

  async function handleDelete(id: number) {
    try {
      await apiDelete(`/api/notices/${id}`);
      toast.success('Notice deleted');
      await mutate();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const columns: Column<NoticeListItem>[] = [
    { key: 'noticeHead', header: 'Head', sortable: false, accessor: (r) => r.noticeHead, className: 'min-w-[200px]' },
    { key: 'noticeHeading', header: 'Heading', sortable: false, accessor: (r) => r.noticeHeading, className: 'min-w-[260px]' },
    { key: 'createdAt', header: 'Created', sortable: false, accessor: (r) => formatDate(r.createdAt), className: 'whitespace-nowrap', cellClassName: 'text-muted-foreground whitespace-nowrap' },
    { key: 'updatedAt', header: 'Updated', sortable: false, accessor: (r) => formatRelativeTime(r.updatedAt), className: 'whitespace-nowrap', cellClassName: 'text-muted-foreground whitespace-nowrap' },
  ];

  return (
    <AppCard>
      <AppCard.Header>
        <AppCard.Title>Notices</AppCard.Title>
        <AppCard.Description>Manage site-wide notices.</AppCard.Description>
        {can(PERMISSIONS.CREATE_NOTICES) && (
          <AppCard.Action>
            <AppButton 
              size='sm' 
              iconName='Plus' 
              type='button'
              onClick={() => pushWithScrollSave('/notices/new')}
            >
              Add
            </AppButton>
          </AppCard.Action>
        )}
      </AppCard.Header>
      <AppCard.Content>
        <FilterBar title='Search & Filter'>
          <NonFormTextInput
            aria-label='Search Notices'
            placeholder='Search by Head or Heading...'
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            containerClassName='w-full'
          />
          <AppButton size='sm' onClick={applyFilters} disabled={!filtersDirty && !searchDraft} className='min-w-[84px]'>
            Filter
          </AppButton>
          {search && (
            <AppButton variant='secondary' size='sm' onClick={resetFilters} className='min-w-[84px]'>
              Reset
            </AppButton>
          )}
        </FilterBar>

        <DataTable
          columns={columns}
          data={data?.data || []}
          loading={isLoading}
          stickyColumns={1}
          renderRowActions={(row) => (
            <div className='flex items-center gap-1'>
              {row.documentUrl ? (
                <Link href={row.documentUrl} target='_blank' className='text-xs underline'>Document</Link>
              ) : null}
              {can(PERMISSIONS.EDIT_NOTICES) && (
                <EditButton 
                  tooltip='Edit Notice' 
                  aria-label='Edit Notice'
                  onClick={() => pushWithScrollSave(`/notices/${row.id}/edit`)}
                />
              )}
              {can(PERMISSIONS.DELETE_NOTICES) && (
                <DeleteButton
                  onDelete={() => handleDelete(row.id)}
                  itemLabel='Notice'
                  title='Delete Notice?'
                  description={`This will permanently remove notice "${row.noticeHeading}". This action cannot be undone.`}
                />
              )}
            </div>
          )}
        />
      </AppCard.Content>
      <AppCard.Footer className='justify-end'>
        <Pagination
          page={data?.meta?.page || page}
          totalPages={data?.meta?.totalPages || 1}
          total={data?.meta?.total}
          perPage={perPage}
          onPerPageChange={(val) => setQp({ page: 1, perPage: val })}
          onPageChange={(p) => setQp({ page: p })}
          showPageNumbers
          maxButtons={5}
          disabled={isLoading}
        />
      </AppCard.Footer>
    </AppCard>
  );
}
