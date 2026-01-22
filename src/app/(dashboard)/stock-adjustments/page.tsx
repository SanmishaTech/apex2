'use client';

import { useMemo, useState, useEffect } from 'react';
import useSWR from 'swr';
import { AppButton, AppCard } from '@/components/common';
import { DataTable, Column, SortState } from '@/components/common/data-table';
import { Pagination } from '@/components/common/pagination';
import { FilterBar } from '@/components/common/filter-bar';
import { NonFormTextInput } from '@/components/common/non-form-text-input';
import { apiGet } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { formatDate } from '@/lib/locales';
import { useScrollRestoration } from '@/hooks/use-scroll-restoration';
import { useQueryParamsState } from '@/hooks/use-query-params-state';
import { usePermissions } from '@/hooks/use-permissions';
import { PERMISSIONS } from '@/config/roles';

interface RowItem {
  id: number;
  date: string;
  site: { id: number; site: string } | null;
  createdBy?: { id: number; name: string | null } | null;
  createdAt: string;
}

interface Paginated<T> {
  data: T[];
  page?: number;
  perPage?: number;
  totalPages?: number;
  total?: number;
  meta?: { page: number; perPage: number; totalPages: number; total: number };
}

export default function StockAdjustmentsPage() {
  const [qp, setQp] = useQueryParamsState({ page: 1, perPage: 10, sort: 'date', order: 'desc', search: '' });
  const { page, perPage, sort, order, search } = qp as any;
  const [searchDraft, setSearchDraft] = useState(search || '');
  useEffect(() => { setSearchDraft(search || ''); }, [search]);
  const filtersDirty = searchDraft !== (search || '');

  const { can } = usePermissions();

  const query = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set('page', String(page));
    sp.set('perPage', String(perPage));
    if (sort) sp.set('sort', sort);
    if (order) sp.set('order', order);
    if ((search || '').trim()) sp.set('search', (search || '').trim());
    return `/api/stock-adjustments?${sp.toString()}`;
  }, [page, perPage, sort, order, search]);

  const { data, error, isLoading } = useSWR<Paginated<RowItem>>(query, apiGet);
  const { pushWithScrollSave } = useScrollRestoration('stock-adjustments-list');

  if (error) toast.error((error as Error).message || 'Failed to load stock adjustments');

  function toggleSort(field: string) {
    if (sort === field) setQp({ order: order === 'asc' ? 'desc' : 'asc' });
    else setQp({ sort: field, order: 'asc' });
  }

  const columns: Column<RowItem>[] = [
    { key: 'date', header: 'Date', sortable: true, accessor: (r) => new Date(r.date).toLocaleDateString('en-GB'), className: 'whitespace-nowrap', cellClassName: 'whitespace-nowrap text-muted-foreground' },
    { key: 'site', header: 'Site', sortable: true, accessor: (r) => r.site?.site || '-', className: 'whitespace-nowrap' },
    { key: 'createdBy', header: 'User', sortable: true, accessor: (r) => r.createdBy?.name || '-', className: 'whitespace-nowrap' },
  ];

  const sortState: SortState = { field: sort, order };

  function applyFilters() {
    setQp({ page: 1, search: searchDraft.trim() });
  }
  function resetFilters() {
    setSearchDraft('');
    setQp({ page: 1, search: '' });
  }

  const meta = (data?.meta || { page: data?.page, perPage: data?.perPage, totalPages: data?.totalPages, total: data?.total });

  return (
    <AppCard>
      <AppCard.Header>
        <AppCard.Title>Stock Adjustments</AppCard.Title>
        <AppCard.Description>Adjust stock for items at sites.</AppCard.Description>
        {can(PERMISSIONS.CREATE_STOCK_ADJUSTMENTS) && (
          <AppCard.Action>
            <AppButton size='sm' iconName='Plus' type='button' onClick={() => pushWithScrollSave('/stock-adjustments/new')}>Add</AppButton>
          </AppCard.Action>
        )}
      </AppCard.Header>
      <AppCard.Content>
        <FilterBar title='Search'>
          <NonFormTextInput
            aria-label='Search'
            placeholder='Search'
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            containerClassName='w-full'
          />
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
              <AppButton size='sm' variant='ghost' iconName='Eye' onClick={() => pushWithScrollSave(`/stock-adjustments/${row.id}/view`)}>View</AppButton>
            </div>
          )}
        />
      </AppCard.Content>
      <AppCard.Footer className='justify-end'>
        <Pagination
          page={meta?.page || page}
          totalPages={meta?.totalPages || 1}
          total={meta?.total}
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
