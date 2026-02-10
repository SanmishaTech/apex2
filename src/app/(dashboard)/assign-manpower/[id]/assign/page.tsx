'use client';

import { use } from 'react';
import useSWR from 'swr';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useScrollRestoration } from '@/hooks/use-scroll-restoration';
import { AppCard } from '@/components/common/app-card';
import { FilterBar } from '@/components/common';
import { AppSelect } from '@/components/common/app-select';
import { NonFormTextInput } from '@/components/common/non-form-text-input';
import { AppButton } from '@/components/common/app-button';
import { DataTable, Column, SortState } from '@/components/common/data-table';
import { Pagination } from '@/components/common/pagination';
import { apiGet, apiPost } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { usePermissions } from '@/hooks/use-permissions';
import { PERMISSIONS } from '@/config/roles';
import { useQueryParamsState } from '@/hooks/use-query-params-state';

import type { AssignedManpowerItem, AssignManpowerRequestItem } from '@/types/manpower-assignments';
type AssignRow = AssignedManpowerItem & { __sr: string };
type AssignQ = { page: number; perPage: number; supplierId: string; name: string; sort: string; order: 'asc' | 'desc' };
type AssignDraft = {
  manpowerId: number;
  category?: string | null;
  skillSet?: string | null;
  wage?: number | string | null;
  minWage?: number | string | null;
  esic?: boolean | null;
  pf?: boolean | null;
  pt?: boolean | null;
  hra?: boolean | null;
  mlwf?: boolean | null;
  present?: boolean;
};

type PageProps = { params: Promise<{ id: string }> };

export default function AssignManpowerPage({ params }: PageProps) {
  const { id } = use(params);
  const siteId = Number(id);
  const { can } = usePermissions();
  const router = useRouter();
  const { pushWithScrollSave, pushAndRestoreKey } = useScrollRestoration('assign-manpower-assign');
  
  const goBack = () => {
    // Restore the list page with its saved URL (including query params)
    pushAndRestoreKey('assign-manpower-sites');
  };

  const [qp, setQp] = useQueryParamsState<AssignQ>({ page: 1, perPage: 10, supplierId: '', name: '', sort: 'firstName', order: 'asc' });
  const { page, perPage, supplierId, name, sort, order } = qp;

  const [supplierDraft, setSupplierDraft] = useState(supplierId);
  const [nameDraft, setNameDraft] = useState(name);
  useEffect(() => setSupplierDraft(supplierId), [supplierId]);
  useEffect(() => setNameDraft(name), [name]);

  const filtersDirty = supplierDraft !== supplierId || nameDraft !== name;

  const manpowerQuery = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set('mode', 'available');
    if (supplierId) sp.set('supplierId', supplierId);
    if (name) sp.set('search', name);
    sp.set('page', String(page));
    sp.set('perPage', String(perPage));
    sp.set('sort', sort);
    sp.set('order', order);
    return `/api/manpower-assignments?${sp.toString()}`;
  }, [supplierId, name, page, perPage, sort, order]);

  const { data, error, isLoading, mutate } = useSWR<{ data: AssignedManpowerItem[]; page: number; perPage: number; total: number; totalPages: number }>(manpowerQuery, apiGet);

  const { data: suppliers } = useSWR<{ data: { id: number; supplierName: string }[] }>(`/api/manpower-suppliers?perPage=1000`, apiGet);
  const { data: categories } = useSWR<{ data: { id: number; categoryName: string }[] }>(`/api/categories?perPage=1000`, apiGet);
  const { data: skillSets } = useSWR<{ data: { id: number; skillsetName: string }[] }>(`/api/skill-sets?perPage=1000`, apiGet);


  const [selected, setSelected] = useState<Record<number, AssignDraft>>({});

  useEffect(() => {
    // Clear selection on filter change/page change
    setSelected({});
  }, [manpowerQuery]);

  function applyFilters() {
    setQp({ page: 1, supplierId: supplierDraft, name: nameDraft.trim() });
  }
  function resetFilters() {
    setSupplierDraft('');
    setNameDraft('');
    setQp({ page: 1, supplierId: '', name: '' });
  }
  function toggleSort(field: string) { setQp(sort === field ? { order: order === 'asc' ? 'desc' : 'asc' } : { sort: field, order: 'asc' }); }

  function asBool(v: unknown): boolean {
    if (typeof v === 'boolean') return v;
    if (v == null) return false;
    const n = Number(v as any);
    return Number.isFinite(n) && n > 0;
  }

  function toggleSelect(row: AssignedManpowerItem, checked: boolean) {
    setSelected((prev) => {
      const copy = { ...prev };
      if (checked) {
        copy[row.id] = {
          manpowerId: row.id,
          category: row.category ?? undefined,
          skillSet: row.skillSet ?? undefined,
          wage: row.wage ?? undefined,
          minWage: row.minWage ?? undefined,
          esic: asBool(row.esic),
          pf: row.pf ?? false,
          pt: asBool(row.pt),
          hra: asBool(row.hra),
          mlwf: asBool(row.mlwf),
          present: true,
        };
      } else {
        delete copy[row.id];
      }
      return copy;
    });
  }

  function setField(id: number, key: keyof AssignDraft, value: any) {
    setSelected((prev) => {
      const existing = prev[id];
      if (!existing) {
        // Auto-add to selection when field is edited
        const row = rows.find(r => r.id === id);
        if (!row) return prev;
        return {
          ...prev,
          [id]: {
            manpowerId: id,
            category: row.category ?? undefined,
            skillSet: row.skillSet ?? undefined,
            wage: row.wage ?? undefined,
            minWage: row.minWage ?? undefined,
            esic: asBool(row.esic),
            pf: row.pf ?? false,
            pt: asBool(row.pt),
            hra: asBool(row.hra),
            mlwf: asBool(row.mlwf),
            present: true,
            [key]: value,
          },
        };
      }
      return { ...prev, [id]: { ...existing, [key]: value } };
    });
  }

  const rows = data?.data || [];
  const displayRows = rows.map((r, idx) => ({ ...r, __sr: String((page - 1) * perPage + idx + 1) }));

  const columns: Column<AssignRow>[] = [
    {
      key: 'select', header: 'Select', sortable: false, className: 'w-[72px] text-center', cellClassName: 'text-center',
      accessor: (r) => (
        <input
          type='checkbox'
          checked={!!selected[r.id]}
          onChange={(e) => toggleSelect(r, e.currentTarget.checked)}
        />
      ),
    },
    { key: '__sr', header: 'Sr. No.', sortable: false, className: 'whitespace-nowrap' },
    { key: 'firstName', header: 'Manpower', sortable: true, accessor: (r) => `${r.firstName}${r.middleName ? ' ' + r.middleName : ''} ${r.lastName}` },
    {
      key: 'present', header: 'Present', sortable: false, className: 'text-center', cellClassName: 'text-center',
      accessor: (r) => (
        <input
          type='checkbox'
          checked={!!selected[r.id]?.present}
          onChange={(e) => setField(r.id, 'present', e.currentTarget.checked)}
        />
      ),
    },
    {
      key: 'category', header: 'Category', sortable: false, accessor: (r) => (
        <AppSelect
          value={selected[r.id]?.category ?? r.category ?? ''}
          onValueChange={(v) => setField(r.id, 'category', v === '__none' ? '' : v)}
          placeholder='Select Category'
        >
          <AppSelect.Item value='__none'>Select</AppSelect.Item>
          {categories?.data?.map((c) => (
            <AppSelect.Item key={c.id} value={c.categoryName}>{c.categoryName}</AppSelect.Item>
          ))}
        </AppSelect>
      ),
      className: 'min-w-[200px]'
    },
    {
      key: 'skillSet', header: 'Skill Set', sortable: false, accessor: (r) => (
        <AppSelect
          value={selected[r.id]?.skillSet ?? r.skillSet ?? ''}
          onValueChange={(v) => setField(r.id, 'skillSet', v === '__none' ? '' : v)}
          placeholder='Select Skill Set'
        >
          <AppSelect.Item value='__none'>Select</AppSelect.Item>
          {skillSets?.data?.map((s) => (
            <AppSelect.Item key={s.id} value={s.skillsetName}>{s.skillsetName}</AppSelect.Item>
          ))}
        </AppSelect>
      ), className: 'min-w-[200px]'
    },
    {
      key: 'wage', header: 'Wage', sortable: false, className: 'text-right', cellClassName: 'text-right', accessor: (r) => (
        <input type='number' min='0' className='w-24 text-right border border-input bg-background text-foreground placeholder:text-muted-foreground rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring' value={String(selected[r.id]?.wage ?? r.wage ?? '')}
          onChange={(e) => setField(r.id, 'wage', e.currentTarget.value)} />
      )
    },
    {
      key: 'minWage', header: 'Min Wage', sortable: false, className: 'text-right', cellClassName: 'text-right', accessor: (r) => (
        <input type='number' min='0' className='w-24 text-right border border-input bg-background text-foreground placeholder:text-muted-foreground rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring' value={String(selected[r.id]?.minWage ?? r.minWage ?? '')}
          onChange={(e) => setField(r.id, 'minWage', e.currentTarget.value)} />
      )
    },
    {
      key: 'pf', header: 'PF', sortable: false, className: 'text-center', cellClassName: 'text-center', accessor: (r) => (
        <input type='checkbox' checked={selected[r.id]?.pf ?? r.pf ?? false} onChange={(e) => setField(r.id, 'pf', e.currentTarget.checked)} />
      )
    },
    {
      key: 'esic', header: 'ESIC', sortable: false, className: 'text-center', cellClassName: 'text-center', accessor: (r) => (
        <input type='checkbox' checked={selected[r.id]?.esic ?? asBool(r.esic)} onChange={(e) => setField(r.id, 'esic', e.currentTarget.checked)} />
      )
    },
    {
      key: 'hra', header: 'HRA', sortable: false, className: 'text-center', cellClassName: 'text-center', accessor: (r) => (
        <input type='checkbox' checked={selected[r.id]?.hra ?? asBool(r.hra)} onChange={(e) => setField(r.id, 'hra', e.currentTarget.checked)} />
      )
    },
    {
      key: 'pt', header: 'PT', sortable: false, className: 'text-center', cellClassName: 'text-center', accessor: (r) => (
        <input type='checkbox' checked={selected[r.id]?.pt ?? asBool(r.pt)} onChange={(e) => setField(r.id, 'pt', e.currentTarget.checked)} />
      )
    },
    {
      key: 'mlwf', header: 'MLWF', sortable: false, className: 'text-center', cellClassName: 'text-center', accessor: (r) => (
        <input type='checkbox' checked={selected[r.id]?.mlwf ?? asBool(r.mlwf)} onChange={(e) => setField(r.id, 'mlwf', e.currentTarget.checked)} />
      )
    },
    ];

  const sortState: SortState = { field: sort, order };

  async function handleAssign() {
    const items: AssignManpowerRequestItem[] = Object.values(selected).map(({ manpowerId, category, skillSet, wage, minWage, esic, pf, pt, hra, mlwf, present }) => ({
      manpowerId,
      category,
      skillSet,
      wage,
      minWage,
      esic: typeof esic === 'boolean' ? (esic ? 1 : null) : (esic as any),
      pf: pf ?? null,
      pt: typeof pt === 'boolean' ? (pt ? 1 : null) : (pt as any),
      hra: typeof hra === 'boolean' ? (hra ? 1 : null) : (hra as any),
      mlwf: typeof mlwf === 'boolean' ? (mlwf ? 1 : null) : (mlwf as any),
      present,
    }));
    if (items.length === 0) { toast.error('Select at least one manpower'); return; }
    try {
      await apiPost('/api/manpower-assignments', { siteId, items });
      toast.success('Manpower assigned');
      setSelected({});
      await mutate();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to assign');
    }
  }

  if (!can(PERMISSIONS.READ_MANPOWER_ASSIGNMENTS)) {
    return (
      <AppCard>
        <AppCard.Content>
          <div className='py-8 text-center text-muted-foreground'>You do not have permission to view this page.</div>
        </AppCard.Content>
      </AppCard>
    );
  }

  return (
    <AppCard>
      <AppCard.Header>
        <AppCard.Title>Assign Manpower</AppCard.Title>
        <AppCard.Description>Select available manpower to assign to this site.</AppCard.Description>
        <AppCard.Action>
          <AppButton size='sm' variant='secondary' onClick={goBack}>Back</AppButton>
        </AppCard.Action>
      </AppCard.Header>
      <AppCard.Content>
        <FilterBar title='Filters'>
          <AppSelect value={supplierDraft || '__all'} onValueChange={(v) => setSupplierDraft(v === '__all' ? '' : v)} placeholder='Supplier'>
            <AppSelect.Item value='__all'>All Suppliers</AppSelect.Item>
            {suppliers?.data?.map((s) => (
              <AppSelect.Item key={s.id} value={String(s.id)}>{s.supplierName}</AppSelect.Item>
            ))}
          </AppSelect>
          <NonFormTextInput aria-label='Labour name' placeholder='Labour name...' value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} containerClassName='w-full' />
          <AppButton size='sm' onClick={applyFilters} disabled={!filtersDirty && !supplierDraft && !nameDraft} className='min-w-[84px]'>Search</AppButton>
          {(supplierId || name) && (
            <AppButton variant='secondary' size='sm' onClick={resetFilters} className='min-w-[84px]'>Reset</AppButton>
          )}
        </FilterBar>

        <DataTable
          columns={columns}
          data={displayRows}
          loading={isLoading}
          sort={sortState}
          onSortChange={(s) => toggleSort(s.field)}
          stickyColumns={2}
          minTableWidth={1100}
        />
      </AppCard.Content>
      <AppCard.Footer className='justify-between flex-col sm:flex-row gap-4'>
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
        <div className='flex items-center justify-between w-full sm:w-auto gap-4'>
          <div className='text-sm text-muted-foreground'>Selected: {Object.keys(selected).length}</div>
          <div className='flex gap-2'>
            {can(PERMISSIONS.CREATE_MANPOWER_ASSIGNMENTS) && (
              <AppButton onClick={handleAssign} disabled={Object.keys(selected).length === 0}>
                Assign Selected
              </AppButton>
            )}
          </div>
        </div>
      </AppCard.Footer>
    </AppCard>
  );
}
