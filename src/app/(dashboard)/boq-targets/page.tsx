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

type BoqTargetListItem = {
  id: number;
  siteId: number | null;
  site: { id: number; site: string } | null;
  boqId: number | null;
  boq: { id: number; boqNo: string | null } | null;
  activityId: string | null;
  fromTargetDate: string | null;
  toTargetDate: string | null;
  dailyTargetQty: string | number | null;
  createdAt: string;
  updatedAt: string;
};

type BoqTargetsResponse = {
  data: BoqTargetListItem[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
};

export default function BoqTargetsPage() {
  const [qp, setQp] = useQueryParamsState({
    page: 1,
    perPage: 10,
    search: '',
    sort: 'createdAt',
    order: 'desc',
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
    return `/api/boq-targets?${sp.toString()}`;
  }, [page, perPage, search, sort, order]);

  const { data, error, isLoading, mutate } = useSWR<BoqTargetsResponse>(query, apiGet);

  const { can } = usePermissions();

  if (error) {
    toast.error((error as Error).message || 'Failed to load BOQ Targets');
  }

  function toggleSort(field: string) {
    if (sort === field) {
      setQp({ order: order === 'asc' ? 'desc' : 'asc' });
    } else {
      setQp({ sort: field, order: 'asc' });
    }
  }

  const columns: Column<BoqTargetListItem>[] = [
    {
      key: 'site',
      header: 'Site',
      sortable: false,
      accessor: (r) => r.site?.site || '—',
      className: 'whitespace-nowrap',
      cellClassName: 'whitespace-nowrap',
    },
    {
      key: 'boq',
      header: 'BOQ No.',
      sortable: false,
      accessor: (r) => r.boq?.boqNo || `BOQ ${r.boqId}` || '—',
      cellClassName: 'font-medium whitespace-nowrap',
    },
    {
      key: 'activityId',
      header: 'Activity ID',
      sortable: true,
      accessor: (r) => r.activityId || '—',
      className: 'whitespace-nowrap',
      cellClassName: 'whitespace-nowrap',
    },
    {
      key: 'fromTargetDate',
      header: 'From Date',
      sortable: true,
      accessor: (r) => r.fromTargetDate ? formatDate(r.fromTargetDate) : '—',
      className: 'whitespace-nowrap',
      cellClassName: 'whitespace-nowrap',
    },
    {
      key: 'toTargetDate',
      header: 'To Date',
      sortable: true,
      accessor: (r) => r.toTargetDate ? formatDate(r.toTargetDate) : '—',
      className: 'whitespace-nowrap',
      cellClassName: 'whitespace-nowrap',
    },
    {
      key: 'dailyTargetQty',
      header: 'Daily Target Qty',
      sortable: false,
      accessor: (r) => (r.dailyTargetQty != null ? String(r.dailyTargetQty) : '—'),
      className: 'whitespace-nowrap',
      cellClassName: 'text-right tabular-nums',
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
      await apiDelete(`/api/boq-targets/${id}`);
      toast.success('BOQ Target deleted');
      await mutate();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <AppCard>
      <AppCard.Header>
        <AppCard.Title>BOQ Targets</AppCard.Title>
        <AppCard.Description>Manage BOQ targets and daily quantities.</AppCard.Description>
        {can(PERMISSIONS.CREATE_BOQS) && (
          <AppCard.Action>
            <Link href='/boq-targets/new'>
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
            aria-label='Search BOQ Targets'
            placeholder='Search by Activity ID or Site...'
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
            if (!can(PERMISSIONS.EDIT_BOQS) && !can(PERMISSIONS.DELETE_BOQS)) return null;
            return (
              <div className='flex'>
                {can(PERMISSIONS.EDIT_BOQS) && (
                  <Link href={`/boq-targets/${row.id}/edit`}>
                    <EditButton tooltip='Edit BOQ Target' aria-label='Edit BOQ Target' />
                  </Link>
                )}
                {can(PERMISSIONS.DELETE_BOQS) && (
                  <DeleteButton
                    onDelete={() => handleDelete(row.id)}
                    itemLabel='BOQ Target'
                    title='Delete BOQ Target?'
                    description={`This will permanently remove BOQ Target "${row.activityId || row.id}". This action cannot be undone.`}
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
