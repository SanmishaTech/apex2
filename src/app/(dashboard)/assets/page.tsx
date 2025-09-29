'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Edit, Trash2 } from 'lucide-react';
import { AppCard } from '@/components/common/app-card';
import { DataTable, SortState, Column } from '@/components/common/data-table';
import { Pagination } from '@/components/common/pagination';
import { FilterBar } from '@/components/common';
import { NonFormTextInput } from '@/components/common/non-form-text-input';
import { AppButton } from '@/components/common/app-button';
import { DeleteButton } from '@/components/common/delete-button';
import { EditButton } from '@/components/common/icon-button';
import { useProtectPage } from '@/hooks/use-protect-page';
import { usePermissions } from '@/hooks/use-permissions';
import { useScrollRestoration } from '@/hooks/use-scroll-restoration';
import { useQueryParamsState } from '@/hooks/use-query-params-state';
import { useSearchParams } from 'next/navigation';
import { PERMISSIONS } from '@/config/roles';
import useSWR from 'swr';
import { toast } from '@/lib/toast';
import { apiDelete } from '@/lib/api-client';
import { Asset, AssetsResponse } from '@/types/assets';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function AssetsPage() {
  useProtectPage();
  
  const searchParams = useSearchParams();
  const { pushWithScrollSave } = useScrollRestoration('assets-list');
  
  const [qp, setQp] = useQueryParamsState({
    page: 1,
    perPage: 10,
    search: '',
    sort: 'createdAt',
    order: 'desc',
  });
  const { page, perPage, search, sort, order } = qp as unknown as {
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

  function clearFilters() {
    setSearchDraft('');
    setQp({ page: 1, search: '' });
  }

  const { can } = usePermissions();

  const canEdit = can(PERMISSIONS.EDIT_ASSETS);
  const canCreate = can(PERMISSIONS.CREATE_ASSETS);
  const canDelete = can(PERMISSIONS.DELETE_ASSETS);

  // Build query parameters
  const queryParams = new URLSearchParams({
    page: page.toString(),
    perPage: perPage.toString(),
    sort,
    order,
    ...(search && { search }),
  });

  const { data, error, isLoading, mutate } = useSWR<AssetsResponse>(
    `/api/assets?${queryParams}`,
    fetcher
  );

  const sortState: SortState = { field: sort, order };

  function toggleSort(field: string) {
    const newOrder = sort === field && order === 'asc' ? 'desc' : 'asc';
    setQp({ sort: field, order: newOrder });
  }

  const handleDelete = async (id: number) => {
    try {
      await apiDelete(`/api/assets/${id}`);
      toast.success('Asset deleted successfully');
      mutate(); // Refresh the data
    } catch (error) {
      console.error('Delete error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete asset');
    }
  };

  const columns = [
    {
      key: 'assetNo',
      header: 'Asset No',
      sortable: true,
      accessor: (asset: Asset) => (
        <span className="font-medium text-blue-600">{asset.assetNo}</span>
      ),
    },
    {
      key: 'assetName',
      header: 'Asset Name',
      sortable: true,
      accessor: (asset: Asset) => (
        <div>
          <div className="font-medium">{asset.assetName}</div>
          {asset.make && <div className="text-sm text-muted-foreground">{asset.make}</div>}
        </div>
      ),
    },
    {
      key: 'assetGroup',
      header: 'Asset Group',
      sortable: false,
      accessor: (asset: Asset) => asset.assetGroup?.assetGroupName || '-',
    },
    {
      key: 'assetCategory',
      header: 'Asset Category',
      sortable: false,
      accessor: (asset: Asset) => asset.assetCategory?.category || '-',
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      accessor: (asset: Asset) => (
        <Badge 
          variant={asset.status === 'Working' ? 'default' : 'secondary'}
          className={asset.status === 'Working' ? 'bg-green-100 text-green-800' : ''}
        >
          {asset.status}
        </Badge>
      ),
    },
    {
      key: 'useStatus',
      header: 'Use Status',
      sortable: true,
      accessor: (asset: Asset) => (
        <Badge 
          variant={asset.useStatus === 'In Use' ? 'default' : 'secondary'}
          className={
            asset.useStatus === 'In Use' 
              ? 'bg-blue-100 text-blue-800' 
              : 'bg-orange-100 text-orange-800'
          }
        >
          {asset.useStatus}
        </Badge>
      ),
    },
    {
      key: 'supplier',
      header: 'Supplier',
      sortable: true,
      accessor: (asset: Asset) => asset.supplier || '-',
    },
    {
      key: 'purchaseDate',
      header: 'Purchase Date',
      sortable: true,
      accessor: (asset: Asset) => 
        asset.purchaseDate 
          ? new Date(asset.purchaseDate).toLocaleDateString()
          : '-',
    },
  ];


  if (error) {
    return (
      <AppCard>
        <AppCard.Content className="p-6">
          <div className="text-center text-red-600">
            Failed to load assets. Please try again.
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
            <h1 className="text-2xl font-bold">Assets</h1>
            <p className="text-muted-foreground mt-1">
              Manage your organization's assets
            </p>
          </div>
          {canCreate && (
            <AppButton
              onClick={() => pushWithScrollSave('/assets/new')}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Asset
            </AppButton>
          )}
        </div>
      </AppCard.Header>

      <AppCard.Content>
        <FilterBar title="Search & Filter">
          <NonFormTextInput
            aria-label="Search assets"
            placeholder="Search by asset number, name, make, or supplier..."
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            containerClassName="w-full"
          />
          <AppButton
            size="sm"
            onClick={applyFilters}
            disabled={!filtersDirty && !searchDraft}
            className="min-w-[84px]"
          >
            Filter
          </AppButton>
          {search && (
            <AppButton
              variant="secondary"
              size="sm"
              onClick={clearFilters}
              className="min-w-[84px]"
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
          renderRowActions={(asset) => {
            if (!canEdit && !canDelete) return null;
            return (
              <div className="flex">
                {canEdit && (
                  <EditButton
                    tooltip="Edit Asset"
                    aria-label="Edit Asset"
                    onClick={() => pushWithScrollSave(`/assets/${asset.id}/edit`)}
                  />
                )}
                {canDelete && (
                  <DeleteButton
                    onDelete={() => handleDelete(asset.id)}
                    itemLabel="asset"
                    title="Delete asset?"
                    description={`This will permanently remove asset ${asset.assetName}. This action cannot be undone.`}
                  />
                )}
              </div>
            );
          }}
        />
      </AppCard.Content>
      <AppCard.Footer className="justify-end">
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
