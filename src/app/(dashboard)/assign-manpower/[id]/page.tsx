'use client';

import { use } from 'react';
import useSWR from 'swr';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useScrollRestoration } from '@/hooks/use-scroll-restoration';
import { AppCard } from '@/components/common/app-card';
import { AppButton } from '@/components/common/app-button';
import { DataTable, Column, SortState } from '@/components/common/data-table';
import { FilterBar } from '@/components/common';
import { AppSelect } from '@/components/common/app-select';
import { NonFormTextInput } from '@/components/common/non-form-text-input';
import { Pagination } from '@/components/common/pagination';
import { apiGet, apiPatch } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { usePermissions } from '@/hooks/use-permissions';
import { PERMISSIONS } from '@/config/roles';
import { useQueryParamsState } from '@/hooks/use-query-params-state';

import type { AssignedManpowerItem, AssignManpowerRequestItem } from '@/types/manpower-assignments';
type ViewRow = AssignedManpowerItem & { __sr: string };
type ViewQ = { page: number; perPage: number; supplierId: string; name: string; sort: string; order: 'asc' | 'desc' };

type PageProps = { params: Promise<{ id: string }> };

export default function ViewAssignedManpowerPage({ params }: PageProps) {
  const { id } = use(params);
  const siteId = Number(id);
  const { can } = usePermissions();
  const router = useRouter();
  const { pushWithScrollSave, pushAndRestoreKey } = useScrollRestoration('assign-manpower-view');
  
  const goBack = () => {
    // Restore the list page with its saved URL (including query params)
    pushAndRestoreKey('assign-manpower-sites');
  };

  const [qp, setQp] = useQueryParamsState<ViewQ>({ page: 1, perPage: 10, supplierId: '', name: '', sort: 'firstName', order: 'asc' });
  const { page, perPage, supplierId, name, sort, order } = qp;

  const [supplierDraft, setSupplierDraft] = useState(supplierId);
  const [nameDraft, setNameDraft] = useState(name);
  useEffect(() => setSupplierDraft(supplierId), [supplierId]);
  useEffect(() => setNameDraft(name), [name]);

  const filtersDirty = supplierDraft !== supplierId || nameDraft !== name;

  const query = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set('mode', 'assigned');
    sp.set('siteId', String(siteId));
    if (supplierId) sp.set('supplierId', supplierId);
    if (name) sp.set('search', name);
    sp.set('page', String(page));
    sp.set('perPage', String(perPage));
    sp.set('sort', sort);
    sp.set('order', order);
    return `/api/manpower-assignments?${sp.toString()}`;
  }, [siteId, supplierId, name, page, perPage, sort, order]);

  const { data, error, isLoading, mutate } = useSWR<{ data: AssignedManpowerItem[]; page: number; perPage: number; total: number; totalPages: number }>(query, apiGet);
  const rows = data?.data || [];
  const displayRows = rows.map((r, idx) => ({ ...r, __sr: String((page - 1) * perPage + idx + 1) }));

  const { data: suppliers } = useSWR<{ data: { id: number; supplierName: string }[] }>(`/api/manpower-suppliers?perPage=1000`, apiGet);
  const { data: categories } = useSWR<{ data: { id: number; categoryName: string }[] }>(`/api/categories?perPage=1000`, apiGet);
  const { data: skillSets } = useSWR<{ data: { id: number; skillsetName: string }[] }>(`/api/skill-sets?perPage=1000`, apiGet);

  // Track edits per manpowerId
  type ViewEdit = Partial<AssignManpowerRequestItem> & { esic?: boolean | number | string | null; pt?: boolean | number | string | null; hra?: boolean | null; mlwf?: boolean | null };
  const [edits, setEdits] = useState<Record<number, ViewEdit>>({});
  const [selected, setSelected] = useState<Record<number, boolean>>({});

  useEffect(() => { setEdits({}); setSelected({}); }, [query]);

  function applyFilters() { setQp({ page: 1, supplierId: supplierDraft, name: nameDraft.trim() }); }
  function resetFilters() { setSupplierDraft(''); setNameDraft(''); setQp({ page: 1, supplierId: '', name: '' }); }
  function toggleSort(field: string) { setQp(sort === field ? { order: order === 'asc' ? 'desc' : 'asc' } : { sort: field, order: 'asc' }); }

  function setField(id: number, key: keyof ViewEdit, value: any) {
    setEdits((prev) => ({ ...prev, [id]: { ...(prev[id] || { manpowerId: id }), [key]: value } }));
  }

  function asBool(v: unknown): boolean {
    if (typeof v === 'boolean') return v;
    if (v == null) return false;
    const n = Number(v as any);
    return Number.isFinite(n) && n > 0;
  }

  const columns: Column<ViewRow>[] = [
    {
      key: 'select', header: 'Select', sortable: false, className: 'w-[72px] text-center', cellClassName: 'text-center',
      accessor: (r) => (
        <input
          type='checkbox'
          checked={!!selected[r.id]}
          onChange={(e) => {
            const checked = e.currentTarget.checked;
            setSelected((p) => ({ ...p, [r.id]: checked }));
          }}
        />
      )
    },
    { key: '__sr', header: 'Sr. No.', sortable: false, className: 'whitespace-nowrap' },
    { key: 'firstName', header: 'Manpower', sortable: true, accessor: (r) => `${r.firstName}${r.middleName ? ' ' + r.middleName : ''} ${r.lastName}` },
    {
      key: 'category', header: 'Category', sortable: false, accessor: (r) => (
        <AppSelect value={(edits[r.id]?.category as any) ?? r.category ?? ''} onValueChange={(v) => setField(r.id, 'category', v === '__none' ? '' : v)} placeholder='Select Category'>
          <AppSelect.Item value='__none'>Select</AppSelect.Item>
          {categories?.data?.map((c) => (
            <AppSelect.Item key={c.id} value={c.categoryName}>{c.categoryName}</AppSelect.Item>
          ))}
        </AppSelect>
      ), className: 'min-w-[200px]'
    },
    {
      key: 'skillSet', header: 'Skill Set', sortable: false, accessor: (r) => (
        <AppSelect value={(edits[r.id]?.skillSet as any) ?? r.skillSet ?? ''} onValueChange={(v) => setField(r.id, 'skillSet', v === '__none' ? '' : v)} placeholder='Select Skill Set'>
          <AppSelect.Item value='__none'>Select</AppSelect.Item>
          {skillSets?.data?.map((s) => (
            <AppSelect.Item key={s.id} value={s.skillsetName}>{s.skillsetName}</AppSelect.Item>
          ))}
        </AppSelect>
      ), className: 'min-w-[200px]'
    },
    {
      key: 'wage', header: 'Wage', sortable: false, className: 'text-right', cellClassName: 'text-right', accessor: (r) => (
        <input type='number' min='0' className='w-24 text-right border border-input bg-background text-foreground placeholder:text-muted-foreground rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring' value={String((edits[r.id]?.wage as any) ?? r.wage ?? '')}
          onChange={(e) => setField(r.id, 'wage', e.currentTarget.value)} />
      )
    },
    {
      key: 'minWage', header: 'Min Wage', sortable: false, className: 'text-right', cellClassName: 'text-right', accessor: (r) => (
        <input type='number' min='0' className='w-24 text-right border border-input bg-background text-foreground placeholder:text-muted-foreground rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring' value={String((edits[r.id]?.minWage as any) ?? r.minWage ?? '')}
          onChange={(e) => setField(r.id, 'minWage', e.currentTarget.value)} />
      )
    },
    {
      key: 'pf', header: 'PF', sortable: false, className: 'text-center', cellClassName: 'text-center', accessor: (r) => (
        <input type='checkbox' checked={!!(edits[r.id]?.pf ?? r.pf)} onChange={(e) => setField(r.id, 'pf', e.currentTarget.checked)} />
      )
    },
    {
      key: 'esic', header: 'ESIC', sortable: false, className: 'text-center', cellClassName: 'text-center', accessor: (r) => (
        <input type='checkbox' checked={asBool(edits[r.id]?.esic ?? r.esic)} onChange={(e) => setField(r.id, 'esic', e.currentTarget.checked)} />
      )
    },
    {
      key: 'hra', header: 'HRA', sortable: false, className: 'text-center', cellClassName: 'text-center', accessor: (r) => (
        <input type='checkbox' checked={asBool(edits[r.id]?.hra ?? r.hra)} onChange={(e) => setField(r.id, 'hra', e.currentTarget.checked)} />
      )
    },
    {
      key: 'pt', header: 'PT', sortable: false, className: 'text-center', cellClassName: 'text-center', accessor: (r) => (
        <input type='checkbox' checked={asBool(edits[r.id]?.pt ?? r.pt)} onChange={(e) => setField(r.id, 'pt', e.currentTarget.checked)} />
      )
    },
    {
      key: 'mlwf', header: 'MLWF', sortable: false, className: 'text-center', cellClassName: 'text-center', accessor: (r) => (
        <input type='checkbox' checked={asBool(edits[r.id]?.mlwf ?? r.mlwf)} onChange={(e) => setField(r.id, 'mlwf', e.currentTarget.checked)} />
      )
    },
    
  ];

  const sortState: SortState = { field: sort, order };

  async function saveAll() {
    const items = Object.entries(edits).map(([k, v]) => ({
      manpowerId: Number(k),
      category: v.category,
      skillSet: v.skillSet,
      wage: v.wage,
      minWage: v.minWage,
      pf: v.pf,
      esic: typeof v.esic === 'boolean' ? (v.esic ? 1 : null) : v.esic,
      pt: typeof v.pt === 'boolean' ? (v.pt ? 1 : null) : v.pt,
      hra: typeof v.hra === 'boolean' ? (v.hra ? 1 : null) : v.hra,
      mlwf: typeof v.mlwf === 'boolean' ? (v.mlwf ? 1 : null) : v.mlwf,
    }));
    if (items.length === 0) { toast.error('No changes to save'); return; }
    try {
      await apiPatch('/api/manpower-assignments', { siteId, items });
      toast.success('Assignments updated');
      setEdits({});
      await mutate();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update');
    }
  }

  async function unassignSelected() {
    const manpowerIds = Object.entries(selected).filter(([, v]) => v).map(([k]) => Number(k));
    if (manpowerIds.length === 0) { toast.error('Select at least one manpower'); return; }
    try {
      const res = await fetch('/api/manpower-assignments', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, manpowerIds }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as any)?.message || 'Failed to unassign manpower');
      }
      toast.success('Manpower unassigned');
      setSelected({});
      await mutate();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to unassign');
    }
  }

  if (error) toast.error((error as Error).message || 'Failed to load assigned manpower');

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
        <AppCard.Title>Assigned Manpower</AppCard.Title>
        <AppCard.Description>Manage manpower currently assigned to this site.</AppCard.Description>
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
          page={(data as any)?.page || page}
          totalPages={(data as any)?.totalPages || 1}
          total={(data as any)?.total}
          perPage={perPage}
          onPerPageChange={(val) => setQp({ page: 1, perPage: val })}
          onPageChange={(p) => setQp({ page: p })}
          showPageNumbers
          maxButtons={5}
          disabled={isLoading}
        />
        <div className='flex items-center justify-between w-full sm:w-auto gap-4'>
          <div className='text-sm text-muted-foreground'>Selected: {Object.values(selected).filter(Boolean).length} • Changes: {Object.keys(edits).length}</div>
          <div className='flex gap-2'>
            {can(PERMISSIONS.EDIT_MANPOWER_ASSIGNMENTS) && (
              <AppButton onClick={saveAll} disabled={Object.keys(edits).length === 0}>Save Changes</AppButton>
            )}
            {can(PERMISSIONS.DELETE_MANPOWER_ASSIGNMENTS) && (
              <AppButton variant='destructive' onClick={unassignSelected} disabled={Object.values(selected).filter(Boolean).length === 0}>Unassign Selected</AppButton>
            )}
          </div>
        </div>
      </AppCard.Footer>
    </AppCard>
  );
}
