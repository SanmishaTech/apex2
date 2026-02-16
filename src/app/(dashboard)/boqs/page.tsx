'use client';

import useSWR from 'swr';
import { useMemo, useState, useEffect } from 'react';
import { apiGet } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { Pagination } from '@/components/common/pagination';
import { NonFormTextInput } from '@/components/common/non-form-text-input';
import { FilterBar } from '@/components/common';
import { AppCard } from '@/components/common/app-card';
import { AppButton } from '@/components/common/app-button';
import { AppSelect } from '@/components/common/app-select';
import { DataTable, SortState, Column } from '@/components/common/data-table';
import { usePermissions } from '@/hooks/use-permissions';
import { PERMISSIONS } from '@/config/roles';
import { formatRelativeTime, formatDate } from '@/lib/locales';
import { useQueryParamsState } from '@/hooks/use-query-params-state';
import Link from 'next/link';
import { EditButton, ViewButton } from '@/components/common/icon-button';

// Types

type BoqListItem = {
  id: number;
  boqNo: string | null;
  siteId: number | null;
  site: { id: number; site: string } | null;
  workName: string | null;
  workOrderNo: string | null;
  totalWorkValue: string | number | null; // Prisma Decimal can serialize as string
  gstRate: string | number | null; // Prisma Decimal can serialize as string
  createdAt: string;
  updatedAt: string;
};

type BoqsResponse = {
  data: BoqListItem[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
};

type SiteOption = {
  id: number;
  site: string;
};

export default function BoqsPage() {
  const [qp, setQp] = useQueryParamsState({
    page: 1,
    perPage: 10,
    search: '',
    siteId: '',
    sort: 'createdAt',
    order: 'desc',
  });
  const { page, perPage, search, siteId, sort, order } =
    qp as unknown as {
      page: number;
      perPage: number;
      search: string;
      siteId: string;
      sort: string;
      order: 'asc' | 'desc';
    };

  // Local filter draft state (only applied when clicking Filter)
  const [searchDraft, setSearchDraft] = useState(search);
  const [siteIdDraft, setSiteIdDraft] = useState(siteId);

  // Sync drafts when query params change externally (e.g., back navigation)
  useEffect(() => {
    setSearchDraft(search);
    setSiteIdDraft(siteId);
  }, [search, siteId]);

  const filtersDirty = searchDraft !== search || siteIdDraft !== siteId;

  function applyFilters() {
    setQp({
      page: 1,
      search: searchDraft.trim(),
      siteId: siteIdDraft,
    });
  }

  function resetFilters() {
    setSearchDraft('');
    setSiteIdDraft('');
    setQp({ page: 1, search: '', siteId: '' });
  }

  const { data: siteOptionsResp } = useSWR<{ data: SiteOption[] }>(
    '/api/sites/options',
    apiGet
  );

  const query = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set('page', String(page));
    sp.set('perPage', String(perPage));
    if (search) sp.set('search', search);
    if (siteId) sp.set('siteId', siteId);
    if (sort) sp.set('sort', sort);
    if (order) sp.set('order', order);
    return `/api/boqs?${sp.toString()}`;
  }, [page, perPage, search, siteId, sort, order]);

  const { data, error, isLoading, mutate } = useSWR<BoqsResponse>(query, apiGet);

  const { can } = usePermissions();

  if (error) {
    toast.error((error as Error).message || 'Failed to load BOQs');
  }

  function toggleSort(field: string) {
    if (sort === field) {
      setQp({ order: order === 'asc' ? 'desc' : 'asc' });
    } else {
      setQp({ sort: field, order: 'asc' });
    }
  }

  const columns: Column<BoqListItem>[] = [
    {
      key: 'boqNo',
      header: 'B.O.Q. No.',
      sortable: true,
      accessor: (r) => r.boqNo || '—',
      cellClassName: 'font-medium whitespace-nowrap',
    },
    {
      key: 'site',
      header: 'Site',
      sortable: false,
      accessor: (r) => r.site?.site || '—',
      className: 'whitespace-nowrap',
      cellClassName: 'whitespace-nowrap',
    },
    {
      key: 'workName',
      header: 'Work Name',
      sortable: true,
      accessor: (r) => r.workName || '—',
      className: 'min-w-[240px]',
    },
    {
      key: 'workOrderNo',
      header: 'Work Order No',
      sortable: true,
      accessor: (r) => r.workOrderNo || '—',
      className: 'whitespace-nowrap',
    },
    {
      key: 'totalWorkValue',
      header: 'Total Work Value',
      sortable: false,
      accessor: (r) => (r.totalWorkValue != null ? String(r.totalWorkValue) : '—'),
      className: 'whitespace-nowrap',
      cellClassName: 'text-right tabular-nums',
    },
    {
      key: 'gstRate',
      header: 'GST %',
      sortable: false,
      accessor: (r) => (r.gstRate != null ? String(r.gstRate) : '—'),
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

  return (
    <AppCard>
      <AppCard.Header>
        <AppCard.Title>Bill of Quantities</AppCard.Title>
        <AppCard.Description>Manage BOQs.</AppCard.Description>
        {can(PERMISSIONS.CREATE_BOQS) && (
          <AppCard.Action>
            <Link href='/boqs/new'>
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
            aria-label='Search BOQs'
            placeholder='Search by BOQ No or Work Name...'
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            containerClassName='w-full'
          />
          <AppSelect
            label=''
            value={siteIdDraft || '__all'}
            onValueChange={(v) => setSiteIdDraft(v === '__all' ? '' : v)}
            placeholder='Select site'
          >
            <AppSelect.Item value='__all'>All Sites</AppSelect.Item>
            {(siteOptionsResp?.data || []).map((s) => (
              <AppSelect.Item key={s.id} value={String(s.id)}>
                {s.site}
              </AppSelect.Item>
            ))}
          </AppSelect>
          <AppButton
            size='sm'
            onClick={applyFilters}
            disabled={!filtersDirty && !searchDraft && !siteIdDraft}
            className='min-w-21'
          >
            Filter
          </AppButton>
          {(search || siteId) && (
            <AppButton
              variant='secondary'
              size='sm'
              onClick={resetFilters}
              className='min-w-21'
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
            return (
              <div className='flex'>
                <Link href={`/boqs/view/${row.id}`}>
                  <ViewButton tooltip='View BOQ' aria-label='View BOQ' />
                </Link>
                {can(PERMISSIONS.EDIT_BOQS) && (
                  <Link href={`/boqs/${row.id}/edit`}>
                    <EditButton tooltip='Edit BOQ' aria-label='Edit BOQ' />
                  </Link>
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
