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
import Link from 'next/link';
import { EditButton } from '@/components/common/icon-button';

// Types

type ItemListItem = {
  id: number;
  itemCode: string;
  hsnCode: string | null;
  item: string;
  itemCategory?: {
    itemCategoryCode: string;
    itemCategory: string;
  } | null;
  unit?: {
    unitName: string;
  } | null;
  gstRate: number | null;
  asset: boolean;
  discontinue: boolean;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

type ItemsResponse = {
  data: ItemListItem[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
};

export default function ItemsPage() {
  const [qp, setQp] = useQueryParamsState({
    page: 1,
    perPage: 10,
    search: '',
    sort: 'itemCode',
    order: 'asc',
  });
  const { page, perPage, search, sort, order } =
    qp as unknown as {
      page: number;
      perPage: number;
      search: string;
      sort: string;
      order: 'asc' | 'desc';
    };

  // Local filter draft state (only applied when clicking Filter)
  const [searchDraft, setSearchDraft] = useState(search);

  // Sync drafts when query params change externally (e.g., back navigation)
  useEffect(() => {
    setSearchDraft(search);
  }, [search]);

  const filtersDirty = searchDraft !== search;

  function applyFilters() {
    setQp({
      page: 1,
      search: searchDraft.trim(),
    });
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
    return `/api/items?${sp.toString()}`;
  }, [page, perPage, search, sort, order]);

  const { data, error, isLoading, mutate } = useSWR<ItemsResponse>(query, apiGet);

  const { can } = usePermissions();

  if (error) {
    toast.error((error as Error).message || 'Failed to load items');
  }

  function toggleSort(field: string) {
    if (sort === field) {
      setQp({ order: order === 'asc' ? 'desc' : 'asc' });
    } else {
      setQp({ sort: field, order: 'asc' });
    }
  }

  const columns: Column<ItemListItem>[] = [
    {
      key: 'itemCode',
      header: 'Item Code',
      sortable: true,
      cellClassName: 'font-medium whitespace-nowrap',
    },
    {
      key: 'item',
      header: 'Item Name',
      sortable: true,
      cellClassName: 'font-medium whitespace-nowrap',
    },
    {
      key: 'itemCategory',
      header: 'Category',
      sortable: false,
      cellClassName: 'whitespace-nowrap',
      accessor: (r) => r.itemCategory ? `${r.itemCategory.itemCategoryCode} - ${r.itemCategory.itemCategory}` : '-',
    },
    {
      key: 'unit',
      header: 'Unit',
      sortable: false,
      cellClassName: 'whitespace-nowrap',
      accessor: (r) => r.unit?.unitName || '-',
    },
    {
      key: 'gstRate',
      header: 'GST Rate',
      sortable: true,
      cellClassName: 'whitespace-nowrap',
      accessor: (r) => r.gstRate ? `${r.gstRate}%` : '-',
    },
    {
      key: 'asset',
      header: 'Asset',
      sortable: false,
      cellClassName: 'whitespace-nowrap',
      accessor: (r) => r.asset ? 'Yes' : 'No',
    },
    {
      key: 'discontinue',
      header: 'Discontinue',
      sortable: false,
      cellClassName: 'whitespace-nowrap',
      accessor: (r) => r.discontinue ? 'Yes' : 'No',
    },
    {
      key: 'createdAt',
      header: 'Created',
      sortable: true,
      className: 'whitespace-nowrap',
      cellClassName: 'text-muted-foreground whitespace-nowrap',
      accessor: (r) => formatDate(r.createdAt),
    },
    {
      key: 'updatedAt',
      header: 'Updated',
      sortable: false,
      className: 'whitespace-nowrap',
      cellClassName: 'text-muted-foreground whitespace-nowrap',
      accessor: (r) => formatRelativeTime(r.updatedAt),
    },
  ];

  const sortState: SortState = { field: sort, order };

  async function handleDelete(id: number) {
    try {
      await apiDelete(`/api/items/${id}`);
      toast.success('Item deleted');
      await mutate();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <AppCard>
      <AppCard.Header>
        <AppCard.Title>Items</AppCard.Title>
        <AppCard.Description>Manage items.</AppCard.Description>
        {can(PERMISSIONS.CREATE_ITEMS) && (
          <AppCard.Action>
            <Link href='/items/new'>
              <AppButton size='sm' iconName='Plus' type='button'>
                Add
              </AppButton>
            </Link>
          </AppCard.Action>
        )}
      </AppCard.Header>
      <AppCard.Content>
        <FilterBar title='Search & Filter'>
          <NonFormTextInput
            aria-label='Search items'
            placeholder='Search items...'
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
            if (!can(PERMISSIONS.EDIT_ITEMS) && !can(PERMISSIONS.DELETE_ITEMS)) return null;
            return (
              <div className='flex'>
                {can(PERMISSIONS.EDIT_ITEMS) && (
                  <Link href={`/items/${row.id}/edit`}>
                    <EditButton tooltip='Edit Item' aria-label='Edit Item' />
                  </Link>
                )}
                {can(PERMISSIONS.DELETE_ITEMS) && (
                  <DeleteButton
                    onDelete={() => handleDelete(row.id)}
                    itemLabel='item'
                    title='Delete item?'
                    description={`This will permanently remove item "${row.itemCode} - ${row.item}". This action cannot be undone.`}
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
