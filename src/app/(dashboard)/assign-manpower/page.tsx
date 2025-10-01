'use client';

import useSWR from 'swr';
import { useMemo, useState, useEffect } from 'react';
import { apiGet } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { AppCard } from '@/components/common/app-card';
import { FilterBar } from '@/components/common';
import { NonFormTextInput } from '@/components/common/non-form-text-input';
import { AppButton } from '@/components/common/app-button';
import { DataTable, Column, SortState } from '@/components/common/data-table';
import { Pagination } from '@/components/common/pagination';
import { usePermissions } from '@/hooks/use-permissions';
import { PERMISSIONS } from '@/config/roles';
import { useQueryParamsState } from '@/hooks/use-query-params-state';
import { useScrollRestoration } from '@/hooks/use-scroll-restoration';

import type { SitesResponse } from '@/types/sites';
type SitesQ = { page: number; perPage: number; search: string; sort: string; order: 'asc' | 'desc' };

export default function AssignManpowerSitesPage() {
  const { pushWithScrollSave } = useScrollRestoration('assign-manpower-sites');
  const { can } = usePermissions();

  const [qp, setQp] = useQueryParamsState<SitesQ>({ page: 1, perPage: 10, search: '', sort: 'site', order: 'asc' });
  const { page, perPage, search, sort, order } = qp;

  const [searchDraft, setSearchDraft] = useState(search);
  useEffect(() => { setSearchDraft(search); }, [search]);
  const filtersDirty = searchDraft !== search;

  const query = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set('page', String(page));
    sp.set('perPage', String(perPage));
    if (search) sp.set('search', search);
    if (sort) sp.set('sort', sort);
    if (order) sp.set('order', order);
    return `/api/sites?${sp.toString()}`;
  }, [page, perPage, search, sort, order]);

  const { data, error, isLoading } = useSWR<SitesResponse>(query, apiGet);
  const rows: SiteRow[] = data?.data ?? [];

  if (error) toast.error((error as Error).message || 'Failed to load sites');

  function applyFilters() { setQp({ page: 1, search: searchDraft.trim() }); }
  function resetFilters() { setSearchDraft(''); setQp({ page: 1, search: '' }); }
  function toggleSort(field: string) { setQp(sort === field ? { order: order === 'asc' ? 'desc' : 'asc' } : { sort: field, order: 'asc' }); }

  type SiteRow = (SitesResponse['data'][number] & { _count?: { assignedManpower?: number } });

  const columns: Column<SiteRow>[] = [
    { key: 'site', header: 'Site', sortable: true, cellClassName: 'font-medium whitespace-nowrap' },
    { key: 'shortName', header: 'Short Name', sortable: false, className: 'whitespace-nowrap' },
    { key: 'company', header: 'Company', sortable: false, accessor: (r) => r.company?.shortName || r.company?.companyName || '—', className: 'whitespace-nowrap' },
    { key: 'assigned', header: 'Assigned', sortable: false, accessor: (r) => r._count?.assignedManpower ?? '—', className: 'text-center whitespace-nowrap', cellClassName: 'text-center' },
  ];

  const sortState: SortState = { field: sort, order };

  return (
    <AppCard>
      <AppCard.Header>
        <AppCard.Title>Assign Manpower</AppCard.Title>
        <AppCard.Description>Select a site to view or assign manpower.</AppCard.Description>
      </AppCard.Header>
      <AppCard.Content>
        <FilterBar title='Search'>
          <NonFormTextInput aria-label='Search sites' placeholder='Search sites...' value={searchDraft} onChange={(e) => setSearchDraft(e.target.value)} containerClassName='w-full' />
          <AppButton size='sm' onClick={applyFilters} disabled={!filtersDirty && !searchDraft} className='min-w-[84px]'>Filter</AppButton>
          {search && (
            <AppButton variant='secondary' size='sm' onClick={resetFilters} className='min-w-[84px]'>Reset</AppButton>
          )}
        </FilterBar>
        <DataTable
          columns={columns}
          data={rows}
          loading={isLoading}
          sort={sortState}
          onSortChange={(s) => toggleSort(s.field)}
          stickyColumns={1}
          renderRowActions={(row) => (
            <div className='flex gap-2'>
              <AppButton
                size='sm'
                variant='secondary'
                onClick={() => pushWithScrollSave(`/assign-manpower/${row.id}`)}
              >
                View Assigned
              </AppButton>
              {can(PERMISSIONS.CREATE_MANPOWER_ASSIGNMENTS) && (
                <AppButton
                  size='sm'
                  onClick={() => pushWithScrollSave(`/assign-manpower/${row.id}/assign`)}
                >
                  Assign Manpower
                </AppButton>
              )}
            </div>
          )}
        />
      </AppCard.Content>
      <AppCard.Footer className='justify-end'>
        <Pagination
          page={data?.page ?? page}
          totalPages={data?.totalPages ?? 1}
          total={data?.total}
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
