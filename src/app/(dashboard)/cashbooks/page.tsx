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
import { formatDate } from '@/lib/locales';
import { useQueryParamsState } from '@/hooks/use-query-params-state';
import { useScrollRestoration } from '@/hooks/use-scroll-restoration';
import Link from 'next/link';
import { EditButton } from '@/components/common/icon-button';
import type { Cashbook, CashbooksResponse } from '@/types/cashbooks';

export default function CashbooksPage() {
  const [qp, setQp] = useQueryParamsState({
    page: 1,
    perPage: 10,
    search: '',
    sort: 'voucherDate',
    order: 'desc',
  });
  const { page, perPage, search, sort, order } = qp;

  // Local filter draft state (only applied when clicking Filter)
  const [searchDraft, setSearchDraft] = useState(search);

  // Sync drafts when query params change externally (e.g., back navigation)
  useEffect(() => {
    setSearchDraft(search);
  }, [search]);

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
    return `/api/cashbooks?${sp.toString()}`;
  }, [page, perPage, search, sort, order]);

  const { data, error, isLoading, mutate } = useSWR<CashbooksResponse>(
    query,
    apiGet
  );

  const { pushWithScrollSave } = useScrollRestoration('cashbooks-list');
  const { can } = usePermissions();

  async function handleDelete(id: string) {
    try {
      await apiDelete(`/api/cashbooks/${id}`);
      toast.success('Cashbook deleted successfully');
      mutate(); // Refresh the data
    } catch (error) {
      console.error('Delete error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete cashbook');
    }
  }

  function toggleSort(field: string) {
    if (sort === field) {
      const newOrder = order === 'asc' ? 'desc' : 'asc';
      setQp({ order: newOrder });
    } else {
      setQp({ sort: field, order: 'asc' });
    }
  }

  const sortState: SortState = { field: sort, order: order as 'asc' | 'desc' };

  const columns: Column<Cashbook>[] = [
    {
      key: 'voucherNo',
      header: 'Voucher No',
      sortable: true,
      accessor: (cashbook) => (
        <div className="font-medium">
          {cashbook.voucherNo || 'N/A'}
        </div>
      ),
    },
    {
      key: 'voucherDate',
      header: 'Voucher Date',
      sortable: true,
      accessor: (cashbook) => (
        <div>
          {formatDate(cashbook.voucherDate)}
        </div>
      ),
    },
    {
      key: 'site',
      header: 'Site',
      accessor: (cashbook) => (
        <div>
          {cashbook.site?.site || 'N/A'}
        </div>
      ),
    },
    {
      key: 'boq',
      header: 'BOQ',
      accessor: (cashbook) => (
        <div>
          {cashbook.boq?.boqNo || 'N/A'}
        </div>
      ),
    },
    {
      key: 'details',
      header: 'Details Count',
      accessor: (cashbook) => (
        <div className="text-center">
          {cashbook.cashbookDetails?.length || 0} items
        </div>
      ),
    },
    {
      key: 'createdAt',
      header: 'Created At',
      sortable: true,
      accessor: (cashbook) => (
        <div className="text-sm text-muted-foreground">
          {formatDate(cashbook.createdAt)}
        </div>
      ),
    },
  ];


  if (error) {
    return (
      <AppCard>
        <AppCard.Content className="p-6">
          <div className="text-center text-red-600">
            Failed to load cashbooks. Please try again.
          </div>
        </AppCard.Content>
      </AppCard>
    );
  }

  return (
    <AppCard>
      <AppCard.Header>
        <div className="flex items-center justify-between">
          <div>
            <AppCard.Title>Cashbooks</AppCard.Title>
            <AppCard.Description>
              Manage application cashbook vouchers.
            </AppCard.Description>
          </div>
          <AppCard.Action>
            {can(PERMISSIONS.CREATE_CASHBOOKS) && (
              <AppButton 
                size='sm' 
                iconName='Plus' 
                type='button'
                onClick={() => pushWithScrollSave('/cashbooks/new')}
              >
                Add Cashbook
              </AppButton>
            )}
          </AppCard.Action>
        </div>
      </AppCard.Header>

      <AppCard.Content>
        <FilterBar title='Search & Filter'>
          <NonFormTextInput
            aria-label='Search cashbooks'
            placeholder="Search cashbooks..."
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            containerClassName="w-full"
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
          renderRowActions={(cashbook) => {
            if (!can(PERMISSIONS.EDIT_CASHBOOKS) && !can(PERMISSIONS.DELETE_CASHBOOKS))
              return null;
            return (
              <div className='flex'>
                {can(PERMISSIONS.EDIT_CASHBOOKS) && (
                  <EditButton 
                    tooltip='Edit Cashbook' 
                    aria-label='Edit Cashbook'
                    onClick={() => pushWithScrollSave(`/cashbooks/${cashbook.id}/edit`)}
                  />
                )}
                {can(PERMISSIONS.DELETE_CASHBOOKS) && (
                  <DeleteButton
                    onDelete={() => handleDelete(String(cashbook.id))}
                    itemLabel='cashbook'
                    title='Delete cashbook?'
                    description={`This will permanently remove cashbook voucher ${cashbook.voucherNo || cashbook.id}. This action cannot be undone.`}
                  />
                )}
              </div>
            );
          }}
        />
      </AppCard.Content>
      <AppCard.Footer className="justify-end">
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
