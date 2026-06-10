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
import { AppSelect } from '@/components/common/app-select';
import { DataTable, SortState, Column } from '@/components/common/data-table';
import { DeleteButton } from '@/components/common/delete-button';
import { usePermissions } from '@/hooks/use-permissions';
import { PERMISSIONS } from '@/config/roles';
import { formatRelativeTime, formatDate } from '@/lib/locales';
import { useQueryParamsState } from '@/hooks/use-query-params-state';
import Link from 'next/link';
import { EditButton, ViewButton } from '@/components/common/icon-button';
import type { SitesResponse } from '@/types/sites';

// Types
type ManpowerFoodChargesListItem = {
  id: number;
  siteId: number;
  site: { id: number; site: string };
  monthYear: string;
  createdAt: string;
  updatedAt: string;
};

type ManpowerFoodChargesResponse = {
  data: ManpowerFoodChargesListItem[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
};

function buildMonthYearOptions(): Array<{ value: string; label: string }> {
  const now = new Date();
  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];
  const names = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  const opts: Array<{ value: string; label: string }> = [];
  for (const y of years) {
    for (let mIndex = 0; mIndex < names.length; mIndex++) {
      const label = `${names[mIndex]} ${y}`;
      const value = `${String(mIndex + 1).padStart(2, "0")}-${y}`;
      opts.push({ value, label });
    }
  }
  return opts;
}

export default function ManpowerFoodChargesPage() {
  const ALL_VALUE = '__ALL__';
  const [qp, setQp] = useQueryParamsState({
    page: 1,
    perPage: 10,
    search: '',
    siteId: '',
    monthYear: '',
    sort: 'createdAt',
    order: 'desc',
  });
  const { page, perPage, search, siteId, monthYear, sort, order } =
    qp as unknown as {
      page: number;
      perPage: number;
      search: string;
      siteId: string;
      monthYear: string;
      sort: string;
      order: 'asc' | 'desc';
    };

  // Local filter draft state
  const [searchDraft, setSearchDraft] = useState(search);
  const [siteIdDraft, setSiteIdDraft] = useState(siteId);
  const [monthYearDraft, setMonthYearDraft] = useState(monthYear);

  const monthOptions = useMemo(() => buildMonthYearOptions(), []);

  useEffect(() => {
    setSearchDraft(search);
    setSiteIdDraft(siteId);
    setMonthYearDraft(monthYear);
  }, [search, siteId, monthYear]);

  const filtersDirty =
    searchDraft !== search ||
    siteIdDraft !== siteId ||
    monthYearDraft !== monthYear;

  function applyFilters() {
    setQp({
      page: 1,
      search: searchDraft.trim(),
      siteId: siteIdDraft,
      monthYear: monthYearDraft,
    });
  }

  function resetFilters() {
    setSearchDraft('');
    setSiteIdDraft('');
    setMonthYearDraft('');
    setQp({ page: 1, search: '', siteId: '', monthYear: '' });
  }

  const query = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set('page', String(page));
    sp.set('perPage', String(perPage));
    if (search) sp.set('search', search);
    if (siteId) sp.set('siteId', siteId);
    if (monthYear) sp.set('monthYear', monthYear);
    if (sort) sp.set('sort', sort);
    if (order) sp.set('order', order);
    return `/api/manpower-food-charges?${sp.toString()}`;
  }, [page, perPage, search, siteId, monthYear, sort, order]);

  const { data, error, isLoading, mutate } = useSWR<ManpowerFoodChargesResponse>(query, apiGet);

  const { can } = usePermissions();

  const canReadSites = can(PERMISSIONS.READ_SITES) || can(PERMISSIONS.VIEW_SITES);
  const { data: sitesData } = useSWR<SitesResponse>(
    canReadSites ? '/api/sites?perPage=100' : null,
    apiGet
  );

  const siteOptions = (sitesData?.data || []).map((s) => ({
    value: String(s.id),
    label: s.site,
  }));

  if (error) {
    toast.error((error as Error).message || 'Failed to load Manpower Food Charges');
  }

  function toggleSort(field: string) {
    if (sort === field) {
      setQp({ order: order === 'asc' ? 'desc' : 'asc' });
    } else {
      setQp({ sort: field, order: 'asc' });
    }
  }

  const columns: Column<ManpowerFoodChargesListItem>[] = [
    {
      key: 'monthYear',
      header: 'Month',
      sortable: true,
      accessor: (r) => r.monthYear || '—',
      className: 'whitespace-nowrap',
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
      await apiDelete(`/api/manpower-food-charges/${id}`);
      toast.success('Manpower Food Charges deleted');
      await mutate();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <AppCard>
      <AppCard.Header>
        <AppCard.Title>Manpower Food Charges</AppCard.Title>
        <AppCard.Description>Manage Manpower food charges.</AppCard.Description>
        {can(PERMISSIONS.CREATE_MANPOWER_FOOD_CHARGES) && (
          <AppCard.Action>
            <Link href='/manpower-food-charges/new'>
              <AppButton size='sm' iconName='Plus' type='button'>
                Add
              </AppButton>
            </Link>
          </AppCard.Action>
        )}
      </AppCard.Header>
      <AppCard.Content>
        <FilterBar title='Search & Filter'>
          {canReadSites ? (
            <AppSelect
              label='Site'
              value={siteIdDraft}
              onValueChange={(v) => setSiteIdDraft(v === ALL_VALUE ? '' : v)}
              placeholder='All Sites'
              triggerClassName='h-9 min-w-[180px]'
            >
              <AppSelect.Item value={ALL_VALUE}>All Sites</AppSelect.Item>
              {siteOptions.map((opt) => (
                <AppSelect.Item key={opt.value} value={opt.value}>
                  {opt.label}
                </AppSelect.Item>
              ))}
            </AppSelect>
          ) : null}

          <AppSelect
            label='Month'
            value={monthYearDraft}
            onValueChange={(v) => {
              const next = v === ALL_VALUE ? '' : v;
              setMonthYearDraft(next);
            }}
            placeholder='All Months'
            triggerClassName='h-9 min-w-[160px]'
          >
            <AppSelect.Item value={ALL_VALUE}>All Months</AppSelect.Item>
            {monthOptions.map((opt) => (
              <AppSelect.Item key={opt.value} value={opt.value}>
                {opt.label}
              </AppSelect.Item>
            ))}
          </AppSelect>

          <div className="flex items-end pb-0.5 space-x-2">
            <AppButton
              size='sm'
              onClick={applyFilters}
              disabled={!filtersDirty}
              className='min-w-[160px] h-9'
            >
              Filter
            </AppButton>
            {(filtersDirty || siteId || monthYear || siteIdDraft || monthYearDraft) && (
              <AppButton
                variant='secondary'
                size='sm'
                onClick={resetFilters}
                className='min-w-[160px] h-9'
              >
                Reset
              </AppButton>
            )}
          </div>
        </FilterBar>
        <DataTable
          columns={columns}
          data={data?.data || []}
          loading={isLoading}
          sort={sortState}
          onSortChange={(s) => toggleSort(s.field)}
          stickyColumns={1}
          renderRowActions={(row) => {
            if (!can(PERMISSIONS.EDIT_MANPOWER_FOOD_CHARGES) && !can(PERMISSIONS.DELETE_MANPOWER_FOOD_CHARGES)) return null;
            return (
              <div className='flex'>
                <Link href={`/manpower-food-charges/${row.id}/view`}>
                  <ViewButton tooltip='View Manpower Food Charges' aria-label='View Manpower Food Charges' />
                </Link>
                {can(PERMISSIONS.EDIT_MANPOWER_FOOD_CHARGES) && (
                  <Link href={`/manpower-food-charges/${row.id}/edit`}>
                    <EditButton tooltip='Edit Manpower Food Charges' aria-label='Edit Manpower Food Charges' />
                  </Link>
                )}
                {can(PERMISSIONS.DELETE_MANPOWER_FOOD_CHARGES) && (
                  <DeleteButton
                    onDelete={() => handleDelete(row.id)}
                    itemLabel='Manpower Food Charges'
                    title='Delete Manpower Food Charges?'
                    description={`This will permanently remove Manpower Food Charges. This action cannot be undone.`}
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
