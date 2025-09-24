'use client';

import useSWR from 'swr';
import { useMemo, useState, useEffect } from 'react';
import { apiGet, apiDelete } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { Pagination } from '@/components/common/pagination';
import { NonFormTextInput } from '@/components/common/non-form-text-input';
import { FilterBar } from '@/components/common';
import { AppCard } from '@/components/common/app-card';
import { AppButton } from '@/components/common/app-button';
import { DataTable, SortState, Column } from '@/components/common/data-table';
import { DeleteButton } from '@/components/common/delete-button';
import { usePermissions } from '@/hooks/use-permissions';
import { PERMISSIONS } from '@/config/roles';
import { formatRelativeTime, formatDate } from '@/lib/locales';
import { useQueryParamsState } from '@/hooks/use-query-params-state';
import { useScrollRestoration } from '@/hooks/use-scroll-restoration';
import Link from 'next/link';
import { EditButton } from '@/components/common/icon-button';

export type ManpowerSupplierListItem = {
  id: number;
  vendorCode: string | null;
  supplierName: string;
  contactPerson: string | null;
  representativeName: string | null;
  city: string | null;
  state: string | null;
  numberOfWorkers: number | null;
  createdAt: string;
  updatedAt: string;
};

export type SuppliersResponse = {
  data: ManpowerSupplierListItem[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
};

export default function ManpowerSuppliersPage() {
  const { pushWithScrollSave } = useScrollRestoration('manpower-suppliers-list');
  
  const [qp, setQp] = useQueryParamsState({
    page: 1,
    perPage: 10,
    search: '',
    sort: 'supplierName',
    order: 'asc',
  });
  const { page, perPage, search, sort, order } =
    (qp as unknown) as {
      page: number;
      perPage: number;
      search: string;
      sort: string;
      order: 'asc' | 'desc';
    };

  const [searchDraft, setSearchDraft] = useState(search);

  useEffect(() => { setSearchDraft(search); }, [search]);

  const filtersDirty = searchDraft !== search;

  function applyFilters() {
    setQp({ page: 1, search: searchDraft.trim() });
  }

  function resetFilters() {
    setSearchDraft('');
    setQp({ page: 1, search: '' });
  }

  const query = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set('page', String(page));
    sp.set('perPage', String(perPage));
    if (search) sp.set('search', search);
    if (sort) sp.set('sort', sort);
    if (order) sp.set('order', order);
    return `/api/manpower-suppliers?${sp.toString()}`;
  }, [page, perPage, search, sort, order]);

  const { data, error, isLoading, mutate } = useSWR<SuppliersResponse>(query, apiGet);

  const { can } = usePermissions();

  if (error) {
    toast.error((error as Error).message || 'Failed to load suppliers');
  }

  function toggleSort(field: string) {
    if (sort === field) {
      setQp({ order: order === 'asc' ? 'desc' : 'asc' });
    } else {
      setQp({ sort: field, order: 'asc' });
    }
  }

  const columns: Column<ManpowerSupplierListItem>[] = [
    { key: 'supplierName', header: 'Supplier', sortable: true, cellClassName: 'font-medium whitespace-nowrap' },
    { key: 'vendorCode', header: 'Vendor Code', sortable: true, className: 'whitespace-nowrap' },
    { key: 'contactPerson', header: 'Contact Person', sortable: false, className: 'whitespace-nowrap' },
    { key: 'representativeName', header: 'Representative', sortable: false, className: 'whitespace-nowrap' },
    { key: 'city', header: 'City', sortable: true, className: 'whitespace-nowrap' },
    { key: 'state', header: 'State', sortable: true, className: 'whitespace-nowrap' },
    { key: 'numberOfWorkers', header: 'Workers', sortable: false, className: 'text-right whitespace-nowrap', cellClassName: 'text-right tabular-nums whitespace-nowrap' },
    { key: 'createdAt', header: 'Created', sortable: true, className: 'whitespace-nowrap', cellClassName: 'text-muted-foreground whitespace-nowrap', accessor: (r) => formatDate(r.createdAt) },
    { key: 'updatedAt', header: 'Updated', sortable: false, className: 'whitespace-nowrap', cellClassName: 'text-muted-foreground whitespace-nowrap', accessor: (r) => formatRelativeTime(r.updatedAt) },
  ];

  const sortState: SortState = { field: sort, order };

  async function handleDelete(id: number) {
    try {
      await apiDelete(`/api/manpower-suppliers/${id}`);
      toast.success('Supplier deleted');
      await mutate();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <AppCard>
      <AppCard.Header>
        <AppCard.Title>Manpower Suppliers</AppCard.Title>
        <AppCard.Description>Manage manpower suppliers.</AppCard.Description>
        {can(PERMISSIONS.EDIT_MANPOWER_SUPPLIERS) && (
          <AppCard.Action>
            <AppButton 
              size='sm' 
              iconName='Plus' 
              type='button'
              onClick={() => pushWithScrollSave('/manpower-suppliers/new')}
            >
              Add
            </AppButton>
          </AppCard.Action>
        )}
      </AppCard.Header>
      <AppCard.Content>
        <FilterBar title='Search & Filter'>
          <NonFormTextInput
            aria-label='Search suppliers'
            placeholder='Search suppliers…'
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            containerClassName='w-full'
          />
          <AppButton
            size='sm'
            onClick={applyFilters}
            disabled={!filtersDirty && !searchDraft}
            className='min-w-[84px]'
          >
            Filter
          </AppButton>
          {search && (
            <AppButton
              variant='secondary'
              size='sm'
              onClick={resetFilters}
              className='min-w-[84px]'
            >
              Reset
            </AppButton>
          )}
        </FilterBar>
        <DataTable
          columns={columns}
          data={data?.data || []}
          loading={isLoading}
          sort={sortState}
          onSortChange={(s) => toggleSort(s.field)}
          stickyColumns={1}
          renderRowActions={(row) => {
            if (!can(PERMISSIONS.EDIT_MANPOWER_SUPPLIERS) && !can(PERMISSIONS.DELETE_MANPOWER_SUPPLIERS)) return null;
            return (
              <div className='flex'>
                {can(PERMISSIONS.EDIT_MANPOWER_SUPPLIERS) && (
                  <EditButton 
                    tooltip='Edit Supplier' 
                    aria-label='Edit Supplier' 
                    onClick={() => pushWithScrollSave(`/manpower-suppliers/${row.id}/edit`)}
                  />
                )}
                {can(PERMISSIONS.DELETE_MANPOWER_SUPPLIERS) && (
                  <DeleteButton
                    onDelete={() => handleDelete(row.id)}
                    itemLabel='supplier'
                    title='Delete supplier?'
                    description={`This will permanently remove supplier "${row.supplierName}". This action cannot be undone.`}
                  />
                )}
              </div>
            );
          }}
        />
      </AppCard.Content>
      <AppCard.Footer className='justify-end'>
        <Pagination
          page={data?.page || page}
          totalPages={data?.totalPages || 1}
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
