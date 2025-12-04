'use client';

import { useState, useEffect, useMemo } from 'react';
import useSWR from 'swr';
import { AppButton, AppCard } from '@/components/common';
import { DataTable, Column } from '@/components/common/data-table';
import { Pagination } from '@/components/common/pagination';
import { FilterBar } from '@/components/common/filter-bar';
import { NonFormTextInput } from '@/components/common/non-form-text-input';
import { SortState } from '@/components/common/data-table';
import { apiGet } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { formatDate } from '@/lib/utils';
import { useScrollRestoration } from '@/hooks/use-scroll-restoration';
import { useQueryParamsState } from '@/hooks/use-query-params-state';
import { usePermissions } from '@/hooks/use-permissions';
import { PERMISSIONS } from '@/config/roles';

interface DailyConsumptionRow {
  id: number;
  dailyConsumptionNo: string;
  dailyConsumptionDate: string;
  site: { id: number; site: string };
  totalAmount: number;
  createdBy?: { id: number; name: string | null } | null;
  createdAt: string;
}

interface Paginated<T> {
  data: T[];
  meta?: { page: number; perPage: number; totalPages: number; total: number };
}

export default function DailyConsumptionsPage() {
  const [qp, setQp] = useQueryParamsState({ page: 1, perPage: 10, search: '', sort: 'dailyConsumptionNo', order: 'asc' });
  const { page, perPage, search, sort, order } = qp as any;

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
    if (sort) sp.set('sort', sort);
    if (order) sp.set('order', order);
    return `/api/daily-consumptions?${sp.toString()}`;
  }, [page, perPage, search, sort, order]);

  const { data, error, isLoading } = useSWR<Paginated<DailyConsumptionRow>>(query, apiGet);
  const { pushWithScrollSave } = useScrollRestoration('daily-consumptions-list');
  const { can } = usePermissions();

  if (error) toast.error((error as Error).message || 'Failed to load daily consumptions');

  function toggleSort(field: string) {
    if (sort === field) setQp({ order: order === 'asc' ? 'desc' : 'asc' });
    else setQp({ sort: field, order: 'asc' });
  }

  const columns: Column<DailyConsumptionRow>[] = [
    { key: 'dailyConsumptionNo', header: 'Daily Consumption Number', sortable: true, cellClassName: 'font-medium whitespace-nowrap' },
    { key: 'dailyConsumptionDate', header: 'Daily Consumption Date', sortable: true, className: 'whitespace-nowrap', cellClassName: 'text-muted-foreground whitespace-nowrap', accessor: (r) => new Date(r.dailyConsumptionDate).toLocaleDateString('en-GB') },
    { key: 'site', header: 'Site', accessor: (r) => r.site?.site || '-', className: 'whitespace-nowrap' },
    { key: 'totalAmount', header: 'Total Amount', accessor: (r) => (Number(r.totalAmount || 0)).toFixed(2), className: 'whitespace-nowrap' },
    { key: 'createdBy', header: 'Prepared By', accessor: (r) => r.createdBy?.name || '-', className: 'whitespace-nowrap' },
  ];

  const sortState: SortState = { field: sort, order };

  return (
    <AppCard>
      <AppCard.Header>
        <AppCard.Title>Daily Consumptions</AppCard.Title>
        <AppCard.Description>Track material consumption per site/day.</AppCard.Description>
        {can(PERMISSIONS.CREATE_DAILY_CONSUMPTIONS) && (
          <AppCard.Action>
            <AppButton size='sm' iconName='Plus' type='button' onClick={() => pushWithScrollSave('/daily-consumptions/new')}>Add</AppButton>
          </AppCard.Action>
        )}
      </AppCard.Header>
      <AppCard.Content>
        <FilterBar title='Search'>
          <NonFormTextInput aria-label='Search daily consumptions' placeholder='Search by number or site...' value={searchDraft} onChange={(e) => setSearchDraft(e.target.value)} containerClassName='w-full' />
          <AppButton size='sm' onClick={applyFilters} disabled={!filtersDirty && !searchDraft} className='min-w-[84px]'>Filter</AppButton>
          {search && (
            <AppButton variant='secondary' size='sm' onClick={resetFilters} className='min-w-[84px]'>Reset</AppButton>
          )}
        </FilterBar>

        <DataTable
          data={data?.data || []}
          columns={columns}
          sort={sortState}
          onSortChange={(s) => toggleSort(s.field)}
          loading={isLoading}
          emptyMessage='No records found'
          renderRowActions={(row) => (
            <div className='flex items-center gap-2'>
              <AppButton size='sm' variant='ghost' iconName='Eye' onClick={() => pushWithScrollSave(`/daily-consumptions/${row.id}/view`)}>
                View
              </AppButton>
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
