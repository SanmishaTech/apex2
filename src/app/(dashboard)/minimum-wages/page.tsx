'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { useProtectPage } from '@/hooks/use-protect-page';
import { AppCard } from '@/components/common/app-card';
import { AppButton } from '@/components/common/app-button';
import { DataTable, type Column, type SortState } from '@/components/common/data-table';
import { FilterBar } from '@/components/common';
import { NonFormTextInput } from '@/components/common/non-form-text-input';
import { Pagination } from '@/components/common/pagination';
import { apiGet, apiDelete } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { usePermissions } from '@/hooks/use-permissions';
import { PERMISSIONS } from '@/config/roles';
import { formatDate, formatRelativeTime } from '@/lib/locales';
import { useQueryParamsState } from '@/hooks/use-query-params-state';
import { EditButton } from '@/components/common/icon-button';
import { DeleteButton } from '@/components/common/delete-button';

interface Row {
  id: number;
  site?: { id: number; site: string; shortName?: string | null } | null;
  category?: { id: number; categoryName: string } | null;
  skillSet?: { id: number; skillsetName: string } | null;
  minWage: string;
  createdAt: string;
  updatedAt: string;
}

export type ListResponse = {
  data: Row[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
};

export default function MinimumWagesPage() {
  useProtectPage();

  const [qp, setQp] = useQueryParamsState({
    page: 1,
    perPage: 10,
    search: '',
    sort: 'createdAt',
    order: 'desc',
  });
  const { page, perPage, search, sort, order } = (qp as unknown) as {
    page: number;
    perPage: number;
    search: string;
    sort: string;
    order: 'asc' | 'desc';
  };

  const [searchDraft, setSearchDraft] = useState(search);
  useEffect(() => { setSearchDraft(search); }, [search]);
  const filtersDirty = searchDraft !== search;
  function applyFilters() { setQp({ page: 1, search: searchDraft.trim() }); }
  function resetFilters() { setSearchDraft(''); setQp({ page: 1, search: '' }); }

  const sp = new URLSearchParams();
  sp.set('page', String(page));
  sp.set('perPage', String(perPage));
  if (search) sp.set('search', search);
  if (sort) sp.set('sort', sort);
  if (order) sp.set('order', order);
  const query = `/api/minimum-wages?${sp.toString()}`;

  const { data, error, isLoading, mutate } = useSWR<ListResponse>(query, apiGet);
  if (error) toast.error((error as Error).message || 'Failed to load minimum wages');

  const { can } = usePermissions();

  function toggleSort(field: string) {
    if (sort === field) setQp({ order: order === 'asc' ? 'desc' : 'asc' });
    else setQp({ sort: field, order: 'asc' });
  }

  const columns: Column<Row>[] = [
    { key: 'site', header: 'Site', sortable: true, accessor: (r) => r.site?.shortName ? `${r.site.shortName} (${r.site.site})` : (r.site?.site || '—'), className: 'whitespace-nowrap' },
    { key: 'category', header: 'Category', sortable: true, accessor: (r) => r.category?.categoryName || '—', className: 'whitespace-nowrap' },
    { key: 'skillSet', header: 'Skill Set', sortable: true, accessor: (r) => r.skillSet?.skillsetName || '—', className: 'whitespace-nowrap' },
    { key: 'minWage', header: 'Min Wage', sortable: true, accessor: (r) => r.minWage, className: 'whitespace-nowrap tabular-nums' },
    { key: 'createdAt', header: 'Created', sortable: true, accessor: (r: any) => formatDate((r as any).createdAt), className: 'whitespace-nowrap', cellClassName: 'text-muted-foreground whitespace-nowrap' },
    { key: 'updatedAt', header: 'Updated', sortable: true, accessor: (r: any) => formatRelativeTime((r as any).updatedAt), className: 'whitespace-nowrap', cellClassName: 'text-muted-foreground whitespace-nowrap' },
  ];
  const sortState: SortState = { field: sort, order };

  async function onDelete(id: number) {
    try {
      await apiDelete(`/api/minimum-wages/${id}`);
      toast.success('Minimum wage deleted');
      await mutate();
    } catch (e) {
      toast.error((e as Error).message || 'Failed');
    }
  }

  return (
    <AppCard>
      <AppCard.Header>
        <AppCard.Title>Minimum Wages</AppCard.Title>
        <AppCard.Description>Manage minimum wages.</AppCard.Description>
        {can(PERMISSIONS.EDIT_MIN_WAGES) && (
          <AppCard.Action>
            <Link href='/minimum-wages/new'>
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
            aria-label='Search minimum wages'
            placeholder='Search by site/category/skill set…'
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            containerClassName='w-full'
          />
          <AppButton size='sm' onClick={applyFilters} disabled={!filtersDirty && !searchDraft} className='min-w-[84px]'>
            Filter
          </AppButton>
          {search && (
            <AppButton variant='secondary' size='sm' onClick={resetFilters} className='min-w-[84px]'>
              Reset
            </AppButton>
          )}
        </FilterBar>
        <DataTable<Row>
          columns={columns}
          data={data?.data || []}
          loading={isLoading}
          sort={sortState}
          onSortChange={(s) => toggleSort(s.field)}
          stickyColumns={1}
          renderRowActions={(row) => {
            if (!can(PERMISSIONS.EDIT_MIN_WAGES) && !can(PERMISSIONS.DELETE_MIN_WAGES)) return null;
            return (
              <div className='flex'>
                {can(PERMISSIONS.EDIT_MIN_WAGES) && (
                  <Link href={`/minimum-wages/${row.id}/edit`}>
                    <EditButton tooltip='Edit Minimum Wage' aria-label='Edit Minimum Wage' />
                  </Link>
                )}
                {can(PERMISSIONS.DELETE_MIN_WAGES) && (
                  <DeleteButton
                    onDelete={() => onDelete(row.id)}
                    itemLabel='minimum wage'
                    title='Delete minimum wage?'
                    description='This will permanently remove the minimum wage record. This action cannot be undone.'
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
