'use client';

import { useState, useEffect, useMemo } from 'react';
import useSWR from 'swr';
import { AppButton, AppCard } from '@/components/common';
import { DataTable, Column } from '@/components/common/data-table';
import { Pagination } from '@/components/common/pagination';
import { FilterBar } from '@/components/common/filter-bar';
import { NonFormTextInput } from '@/components/common/non-form-text-input';
import { AppSelect } from '@/components/common/app-select';
import { StatusBadge } from '@/components/common/status-badge';
import { DeleteButton } from '@/components/common/delete-button';
import { SortState } from '@/components/common/data-table';
import { useQueryParamsState } from '@/hooks/use-query-params-state';
import { usePermissions } from '@/hooks/use-permissions';
import { PERMISSIONS } from '@/config/roles';
import { apiGet, apiDelete } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { formatDate } from '@/lib/utils';
import Link from 'next/link';
import { EditButton } from '@/components/common/icon-button';
import { StatesResponse, State } from '@/types/states';

export default function StatesPage() {
  const [qp, setQp] = useQueryParamsState({
    page: 1,
    perPage: 10,
    search: '',
    status: '',
    sort: 'state',
    order: 'asc',
  });
  const { page, perPage, search, status, sort, order } =
    qp as unknown as {
      page: number;
      perPage: number;
      search: string;
      status: string;
      sort: string;
      order: 'asc' | 'desc';
    };

  // Local filter draft state (only applied when clicking Filter)
  const [searchDraft, setSearchDraft] = useState(search);
  const [statusDraft, setStatusDraft] = useState(status);

  // Sync drafts when query params change externally (e.g., back navigation)
  useEffect(() => {
    setSearchDraft(search);
  }, [search]);
  useEffect(() => {
    setStatusDraft(status);
  }, [status]);

  const filtersDirty =
    searchDraft !== search || statusDraft !== status;

  function applyFilters() {
    setQp({
      page: 1,
      search: searchDraft.trim(),
      status: statusDraft,
    });
  }

  function resetFilters() {
    setSearchDraft('');
    setStatusDraft('');
    setQp({ page: 1, search: '', status: '' });
  }

  const query = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set('page', String(page));
    sp.set('perPage', String(perPage));
    if (search) sp.set('search', search);
    if (status) sp.set('status', status);
    if (sort) sp.set('sort', sort);
    if (order) sp.set('order', order);
    return `/api/states?${sp.toString()}`;
  }, [page, perPage, search, status, sort, order]);

  const { data, error, isLoading, mutate } = useSWR<StatesResponse>(
    query,
    apiGet
  );

  const { can } = usePermissions();

  if (error) {
    toast.error((error as Error).message || 'Failed to load states');
  }

  function toggleSort(field: string) {
    if (sort === field) {
      setQp({ order: order === 'asc' ? 'desc' : 'asc' });
    } else {
      setQp({ sort: field, order: 'asc' });
    }
  }

  const columns: Column<State>[] = [
    {
      key: 'state',
      header: 'State Name',
      sortable: true,
      cellClassName: 'font-medium whitespace-nowrap',
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      accessor: (r) => <StatusBadge active={r.status} />,
      cellClassName: 'whitespace-nowrap',
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
      await apiDelete(`/api/states/${id}`);
      toast.success('State deleted');
      await mutate();
    } catch (err) {
      toast.error((err as Error).message || 'Failed to delete state');
    }
  }

  return (
    <AppCard>
      <AppCard.Header>
        <AppCard.Title>States</AppCard.Title>
        <AppCard.Description>Manage application states.</AppCard.Description>
        {can(PERMISSIONS.EDIT_STATES) && (
          <AppCard.Action>
            <Link href='/states/new'>
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
            aria-label='Search states'
            placeholder='Search states...'
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            containerClassName='w-full'
          />
          <AppSelect
            value={statusDraft || '__all'}
            onValueChange={(v) => setStatusDraft(v === '__all' ? '' : v)}
            placeholder='Status'
          >
            <AppSelect.Item value='__all'>All Statuses</AppSelect.Item>
            <AppSelect.Item value='true'>Active</AppSelect.Item>
            <AppSelect.Item value='false'>Inactive</AppSelect.Item>
          </AppSelect>
          <AppButton
            size='sm'
            onClick={applyFilters}
            disabled={
              !filtersDirty && !searchDraft && !statusDraft
            }
            className='min-w-[84px]'
          >
            Filter
          </AppButton>
          {(search || status) && (
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
          data={data?.data || []}
          columns={columns}
          sort={sortState}
          onSortChange={(s) => toggleSort(s.field)}
          loading={isLoading}
          emptyMessage='No states found'
          renderRowActions={(state) => {
            return (
              <div className='flex items-center gap-2'>
                {can(PERMISSIONS.EDIT_STATES) && (
                  <Link href={`/states/${state.id}/edit`}>
                    <EditButton tooltip='Edit State' aria-label='Edit State' />
                  </Link>
                )}
                {can(PERMISSIONS.DELETE_STATES) && (
                  <DeleteButton
                    onDelete={() => handleDelete(state.id)}
                    itemLabel='state'
                    title='Delete state?'
                    description={`This will permanently remove ${state.state}. This action cannot be undone.`}
                  />
                )}
              </div>
            );
          }}
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
