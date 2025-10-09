'use client';

import { use } from 'react';
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
import Link from 'next/link';
import { EditButton } from '@/components/common/icon-button';

type ViewSiteBudgetPageProps = {
  params: Promise<{ siteId: string }>;
};

// Types
type SiteBudgetListItem = {
  id: number;
  siteId: number;
  itemId: number;
  budgetQty: number;
  budgetRate: number;
  purchaseRate: number;
  budgetValue: number;
  orderedQty: number;
  avgRate: number;
  orderedValue: number;
  qty50Alert: boolean;
  value50Alert: boolean;
  qty75Alert: boolean;
  value75Alert: boolean;
  createdAt: string;
  updatedAt: string;
  item: {
    id: number;
    item: string;
    itemCode: string;
    unit: {
      id: number;
      unitName: string;
    } | null;
  };
};

type SiteBudgetsResponse = {
  data: SiteBudgetListItem[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
};

export default function ViewSiteBudgetPage({ params }: ViewSiteBudgetPageProps) {
  const { siteId } = use(params);
  const siteIdNum = parseInt(siteId);

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
    sp.set('siteId', siteId);
    if (search) sp.set('search', search);
    if (sort) sp.set('sort', sort);
    if (order) sp.set('order', order);
    return `/api/site-budgets?${sp.toString()}`;
  }, [page, perPage, search, sort, order, siteId]);

  const { data, error, isLoading, mutate } = useSWR<SiteBudgetsResponse>(query, apiGet);

  // Fetch site details
  const { data: site } = useSWR(`/api/sites/${siteId}`, apiGet) as { data: any };

  const { can } = usePermissions();

  if (error) {
    toast.error((error as Error).message || 'Failed to load site budgets');
  }

  function toggleSort(field: string) {
    if (sort === field) {
      setQp({ order: order === 'asc' ? 'desc' : 'asc' });
    } else {
      setQp({ sort: field, order: 'asc' });
    }
  }

  const columns: Column<SiteBudgetListItem>[] = [
    {
      key: 'item',
      header: 'Item',
      sortable: false,
      cellClassName: 'font-medium',
      accessor: (r) => r.item.item,
    },
    {
      key: 'unit',
      header: 'Unit',
      sortable: false,
      cellClassName: 'text-center',
      accessor: (r) => r.item.unit?.unitName || '-',
    },
    {
      key: 'budgetQty',
      header: 'Budget Qty',
      sortable: true,
      className: 'text-right',
      cellClassName: 'text-right font-mono',
      accessor: (r) => Number(r.budgetQty).toFixed(2),
    },
    {
      key: 'budgetRate',
      header: 'Budget Rate',
      sortable: true,
      className: 'text-right',
      cellClassName: 'text-right font-mono',
      accessor: (r) => Number(r.budgetRate).toFixed(2),
    },
    {
      key: 'purchaseRate',
      header: 'Purchase Rate',
      sortable: true,
      className: 'text-right',
      cellClassName: 'text-right font-mono',
      accessor: (r) => Number(r.purchaseRate).toFixed(2),
    },
    {
      key: 'budgetValue',
      header: 'Budget Value',
      sortable: true,
      className: 'text-right',
      cellClassName: 'text-right font-mono font-medium',
      accessor: (r) => Number(r.budgetValue).toFixed(2),
    },
    {
      key: 'orderedQty',
      header: 'Ordered Qty',
      sortable: true,
      className: 'text-right',
      cellClassName: 'text-right font-mono',
      accessor: (r) => Number(r.orderedQty).toFixed(2),
    },
    {
      key: 'avgRate',
      header: 'Avg Rate',
      sortable: true,
      className: 'text-right',
      cellClassName: 'text-right font-mono',
      accessor: (r) => Number(r.avgRate).toFixed(2),
    },
    {
      key: 'orderedValue',
      header: 'Ordered Value',
      sortable: true,
      className: 'text-right',
      cellClassName: 'text-right font-mono font-medium',
      accessor: (r) => Number(r.orderedValue).toFixed(2),
    },
    {
      key: 'alerts',
      header: 'Alerts',
      sortable: false,
      className: 'text-center',
      cellClassName: 'text-center',
      accessor: (r) => {
        const alerts: { label: string; color: string }[] = [];
        if (r.qty50Alert) alerts.push({ label: '50% Qty', color: 'bg-orange-100 text-orange-800' });
        if (r.value50Alert) alerts.push({ label: '50% Value', color: 'bg-orange-100 text-orange-800' });
        if (r.qty75Alert) alerts.push({ label: '75% Qty', color: 'bg-red-100 text-red-800' });
        if (r.value75Alert) alerts.push({ label: '75% Value', color: 'bg-red-100 text-red-800' });
        return alerts.length > 0 ? (
          <div className='flex flex-wrap gap-1 justify-center'>
            {alerts.map((alert, idx) => (
              <span key={idx} className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${alert.color}`}>
                {alert.label}
              </span>
            ))}
          </div>
        ) : (
          <span className='inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800'>
            No Alerts
          </span>
        );
      },
    },
  ];

  const sortState: SortState = { field: sort, order };

  async function handleDelete(id: number) {
    try {
      await apiDelete(`/api/site-budgets/${id}`);
      toast.success('Budget item deleted');
      await mutate();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <AppCard>
      <AppCard.Header>
        <AppCard.Title>
          Site Budget - {site?.site || 'Loading...'}
        </AppCard.Title>
        <AppCard.Description>Manage budget items for this site.</AppCard.Description>
        {can(PERMISSIONS.CREATE_SITE_BUDGETS) && (
          <AppCard.Action>
            <Link href={`/site-budgets/${siteId}/add`}>
              <AppButton size='sm' iconName='Plus' type='button'>
                Add Budget
              </AppButton>
            </Link>
          </AppCard.Action>
        )}
      </AppCard.Header>
      <AppCard.Content>
        <FilterBar title='Search & Filter'>
          <NonFormTextInput
            aria-label='Search budget items'
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
            if (!can(PERMISSIONS.EDIT_SITE_BUDGETS) && !can(PERMISSIONS.DELETE_SITE_BUDGETS)) return null;
            return (
              <div className='flex'>
                {can(PERMISSIONS.EDIT_SITE_BUDGETS) && (
                  <Link href={`/site-budgets/${siteId}/edit/${row.id}`}>
                    <EditButton tooltip='Edit Budget Item' aria-label='Edit Budget Item' />
                  </Link>
                )}
                {can(PERMISSIONS.DELETE_SITE_BUDGETS) && (
                  <DeleteButton
                    onDelete={() => handleDelete(row.id)}
                    itemLabel='budget item'
                    title='Delete budget item?'
                    description={`This will permanently remove the budget for "${row.item.item}". This action cannot be undone.`}
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
