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
import { AssetCategoriesResponse, AssetCategory } from '@/types/asset-categories';

export default function AssetCategoriesPage() {
  const [qp, setQp] = useQueryParamsState({
    page: 1,
    perPage: 10,
    search: '',
    sort: 'category',
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
    return `/api/asset-categories?${sp.toString()}`;
  }, [page, perPage, search, sort, order]);

  const { data, error, isLoading, mutate } = useSWR<AssetCategoriesResponse>(
    query,
    apiGet
  );

  const { can } = usePermissions();
  const { pushWithScrollSave } = useScrollRestoration('asset-categories-list');

  if (error) {
    toast.error((error as Error).message || 'Failed to load asset categories');
  }

  function toggleSort(field: string) {
    if (sort === field) {
      setQp({ order: order === 'asc' ? 'desc' : 'asc' });
    } else {
      setQp({ sort: field, order: 'asc' });
    }
  }

  const columns: Column<AssetCategory>[] = [
    {
      key: 'category',
      header: 'Category',
      sortable: true,
      cellClassName: 'font-medium whitespace-nowrap',
    },
    {
      key: 'assetGroup',
      header: 'Asset Group',
      sortable: false,
      cellClassName: 'text-muted-foreground whitespace-nowrap',
      accessor: (r) => r.assetGroup.assetGroup,
    },
    {
      key: 'createdAt',
      header: 'Created',
      sortable: true,
      className: 'whitespace-nowrap',
      cellClassName: 'text-muted-foreground whitespace-nowrap',
      accessor: (r) => formatDate(r.createdAt),
    },
  ];

  const sortState: SortState = { field: sort, order };

  async function handleDelete(id: number) {
    try {
      await apiDelete(`/api/asset-categories/${id}`);
      toast.success('Asset category deleted');
      await mutate();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <AppCard>
      <AppCard.Header>
        <AppCard.Title>Asset Categories</AppCard.Title>
        <AppCard.Description>Manage asset categories organized by asset groups.</AppCard.Description>
        {can(PERMISSIONS.EDIT_ASSET_CATEGORIES) && (
          <AppCard.Action>
            <AppButton 
              size='sm' 
              iconName='Plus' 
              type='button'
              onClick={() => pushWithScrollSave('/asset-categories/new')}
            >
              Add
            </AppButton>
          </AppCard.Action>
        )}
      </AppCard.Header>
      <AppCard.Content>
        <FilterBar title='Search & Filter'>
          <NonFormTextInput
            aria-label='Search asset categories'
            placeholder='Search categories or asset groups...'
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
          renderRowActions={(assetCategory) => {
            if (!can(PERMISSIONS.EDIT_ASSET_CATEGORIES) && !can(PERMISSIONS.DELETE_ASSET_CATEGORIES))
              return null;
            return (
              <div className='flex'>
                {can(PERMISSIONS.EDIT_ASSET_CATEGORIES) && (
                  <EditButton 
                    tooltip='Edit Asset Category' 
                    aria-label='Edit Asset Category'
                    onClick={() => pushWithScrollSave(`/asset-categories/${assetCategory.id}/edit`)}
                  />
                )}
                {can(PERMISSIONS.DELETE_ASSET_CATEGORIES) && (
                  <DeleteButton
                    onDelete={() => handleDelete(assetCategory.id)}
                    itemLabel='asset category'
                    title='Delete asset category?'
                    description={`This will permanently remove ${assetCategory.category} from ${assetCategory.assetGroup.assetGroup}. This action cannot be undone.`}
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
