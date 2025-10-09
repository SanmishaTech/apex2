'use client';

import useSWR from 'swr';
import { useMemo, useState, useEffect, useCallback } from 'react';
import { apiGet, apiDelete, apiPatch } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { Pagination } from '@/components/common/pagination';
import { NonFormTextInput } from '@/components/common/non-form-text-input';
import { AppSelect } from '@/components/common/app-select';
import { FilterBar } from '@/components/common'; // filter layout wrapper
import { AppCard } from '@/components/common/app-card';
import { AppButton } from '@/components/common/app-button';
import { DataTable, SortState, Column } from '@/components/common/data-table';
import { DeleteButton } from '@/components/common/delete-button';
import { usePermissions } from '@/hooks/use-permissions';
import { PERMISSIONS } from '@/config/roles';
import { formatDate } from '@/lib/locales';
import { useQueryParamsState } from '@/hooks/use-query-params-state';
import { useSearchParams } from 'next/navigation';
import { useScrollRestoration } from '@/hooks/use-scroll-restoration';
import { EditButton } from '@/components/common/icon-button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import type { Indent, IndentsResponse } from '@/types/indents';
import type { SitesResponse } from '@/types/sites';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { formatDateForInput } from '@/lib/locales';

export default function IndentsPage() {
  const searchParams = useSearchParams();
  const { pushWithScrollSave } = useScrollRestoration('indents-list');
  const [qp, setQp] = useQueryParamsState({
    page: 1,
    perPage: 10,
    search: '',
    site: '',
    sort: 'indentDate',
    order: 'desc',
  });
  const { page, perPage, search, site, sort, order } =
    qp as unknown as {
      page: number;
      perPage: number;
      search: string;
      site: string;
      sort: string;
      order: 'asc' | 'desc';
    };

  // Local filter draft state (only applied when clicking Filter)
  const [searchDraft, setSearchDraft] = useState(search);
  const [siteDraft, setSiteDraft] = useState(site);

  // Sync drafts when query params change externally (e.g., back navigation)
  useEffect(() => {
    setSearchDraft(search);
  }, [search]);
  useEffect(() => {
    setSiteDraft(site);
  }, [site]);

  const filtersDirty =
    searchDraft !== search || siteDraft !== site;

  function applyFilters() {
    setQp({
      search: searchDraft.trim(),
      site: siteDraft,
    });
  }

  function prettyStatus(s?: string) {
    switch (s) {
      case 'APPROVED_1':
        return 'Approved 1';
      case 'APPROVED_2':
        return 'Approved 2';
      case 'COMPLETED':
        return 'Completed';
      case 'SUSPENDED':
        return 'Suspended';
      default:
        return 'Draft';
    }
  }

  function getAvailableActions(s?: string): { key: 'approve1' | 'approve2' | 'complete' | 'suspend'; label: string }[] {
    if (s === 'COMPLETED' || s === 'SUSPENDED') return [];
    if (s === 'DRAFT' || !s) return [
      { key: 'approve1', label: 'Approve 1' },
      { key: 'suspend', label: 'Suspend' },
    ];
    if (s === 'APPROVED_1') return [
      { key: 'approve2', label: 'Approve 2' },
      { key: 'suspend', label: 'Suspend' },
    ];
    if (s === 'APPROVED_2') return [
      { key: 'complete', label: 'Mark Completed' },
      { key: 'suspend', label: 'Suspend' },
    ];
    return [];
  }

  function resetFilters() {
    setSearchDraft('');
    setSiteDraft('');
    setQp({ page: 1, search: '', site: '' });
  }

  const query = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set('page', String(page));
    sp.set('perPage', String(perPage));
    if (search) sp.set('search', search);
    if (site) sp.set('site', site);
    if (sort) sp.set('sort', sort);
    if (order) sp.set('order', order);
    return `/api/indents?${sp.toString()}`;
  }, [page, perPage, search, site, sort, order]);

  const { data, error, isLoading, mutate } = useSWR<IndentsResponse>(
    query,
    apiGet
  );

  // Debug: Log when perPage or pagination data changes
  useEffect(() => {
    if (data?.meta) {
      console.log('Indents Pagination Debug:', {
        requestedPerPage: perPage,
        responsePerPage: data.meta.perPage,
        total: data.meta.total,
        totalPages: data.meta.totalPages,
        currentPage: data.meta.page,
        query
      });
    }
  }, [data?.meta, perPage, query]);

  // Fetch sites for filter dropdown
  const { data: sitesData } = useSWR<SitesResponse>(
    '/api/sites?perPage=100',
    apiGet
  );

  const { can } = usePermissions();

  if (error) {
    toast.error((error as Error).message || 'Failed to load indents');
  }

  function toggleSort(field: string) {
    if (sort === field) {
      setQp({ order: order === 'asc' ? 'desc' : 'asc' });
    } else {
      setQp({ sort: field, order: 'asc' });
    }
  }

  const columns: Column<Indent>[] = [
    {
      key: 'indentNo',
      header: 'Indent No',
      sortable: true,
      accessor: (r) => r.indentNo || '—',
      cellClassName: 'font-medium whitespace-nowrap',
    },
    {
      key: 'indentDate',
      header: 'Indent Date',
      sortable: true,
      className: 'whitespace-nowrap',
      cellClassName: 'whitespace-nowrap',
      accessor: (r) => formatDate(r.indentDate),
    },
    {
      key: 'approvalStatus',
      header: 'Status',
      sortable: false,
      className: 'whitespace-nowrap',
      cellClassName: 'whitespace-nowrap',
      accessor: (r) => prettyStatus(r.approvalStatus),
    },
    {
      key: 'site',
      header: 'Site',
      sortable: false,
      accessor: (r) => r.site?.site || '—',
      cellClassName: 'whitespace-nowrap',
    },
    {
      key: 'itemsCount',
      header: 'Items',
      sortable: false,
      className: 'text-center',
      cellClassName: 'text-center text-muted-foreground',
      accessor: (r) => r.indentItems?.length || 0,
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
      await apiDelete(`/api/indents/${id}`);
      toast.success('Indent deleted');
      await mutate();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  // Pre-approval dialog state
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [approvalIndentId, setApprovalIndentId] = useState<number | null>(null);
  const [approvalAction, setApprovalAction] = useState<'approve1' | 'approve2' | 'complete' | 'suspend' | null>(null);

  // Load target indent when dialog opens
  const { data: approvalIndent, isLoading: approvalLoading } = useSWR<Indent>(
    approvalOpen && approvalIndentId ? `/api/indents/${approvalIndentId}` : null,
    apiGet
  );

  // Editable fields per item
  type EditFields = { indentQty: number; approvedQty?: number; deliveryDate: string; remark?: string };
  const [itemEdits, setItemEdits] = useState<Record<number, EditFields>>({});

  useEffect(() => {
    if (approvalIndent?.indentItems) {
      const next: Record<number, EditFields> = {};
      for (const it of approvalIndent.indentItems) {
        next[it.id] = {
          indentQty: Number(it.indentQty || 0),
          approvedQty: typeof it.approvedQty === 'number' ? Number(it.approvedQty) : (it.approvedQty ? Number(it.approvedQty) : Number((it as any).indentQty || 0)),
          deliveryDate: formatDateForInput(it.deliveryDate),
          remark: it.remark || ''
        };
      }
      setItemEdits(next);
    }
  }, [approvalIndent?.indentItems]);

  function openApproval(id: number, action: 'approve1' | 'approve2' | 'complete' | 'suspend') {
    setApprovalIndentId(id);
    setApprovalAction(action);
    setApprovalOpen(true);
  }

  const MAX_DEC = 9999999999.99; // MySQL DECIMAL(12,2)
  const clampDec = (n: number) => Math.min(Math.max(0, n), MAX_DEC);
  const setEdit = useCallback((id: number, field: keyof EditFields, value: string) => {
    setItemEdits(prev => {
      let next: any;
      if (field === 'indentQty') {
        next = value === '' ? 0 : clampDec(Number(value));
      } else if (field === 'approvedQty') {
        next = value === '' ? undefined : clampDec(Number(value));
      } else {
        next = value;
      }
      return {
        ...prev,
        [id]: {
          ...prev[id],
          [field]: next,
        },
      };
    });
  }, []);

  async function handleApproveConfirm() {
    if (!approvalIndent || !approvalIndentId || !approvalAction) return;
    try {
      // Require approvedQty for all items when not suspending
      if (approvalAction !== 'suspend') {
        for (const it of approvalIndent.indentItems || []) {
          const aq = itemEdits[it.id]?.approvedQty ?? (typeof it.approvedQty === 'number' ? Number(it.approvedQty) : NaN);
          if (aq == null || Number.isNaN(aq)) {
            toast.error('Approved quantity is required for all items');
            return;
          }
        }
      }
      // Build payload with only allowed editable fields; other required fields kept as-is
      const includeItems = approvalAction !== 'suspend';
      const payload = {
        indentItems: includeItems ? (approvalIndent.indentItems?.map((it) => ({
          // Ensure numeric fields are numbers (API zod expects number, GET may return strings for decimals)
          itemId: Number(it.itemId!),
          closingStock: Number((it as any).closingStock ?? 0),
          unitId: Number(it.unitId!),
          remark: itemEdits[it.id]?.remark || it.remark || undefined,
          indentQty: clampDec(itemEdits[it.id]?.indentQty ?? Number((it as any).indentQty || 0)),
          approvedQty:
            itemEdits[it.id]?.approvedQty != null
              ? clampDec(Number(itemEdits[it.id]!.approvedQty))
              : clampDec(Number((it as any).approvedQty ?? (it as any).indentQty ?? 0)),
          deliveryDate: itemEdits[it.id]?.deliveryDate || formatDateForInput(it.deliveryDate),
        })) || []) : undefined,
        statusAction: approvalAction,
      } as any;

      await apiPatch(`/api/indents/${approvalIndentId}`, payload);
      toast.success('Indent updated');
      setApprovalOpen(false);
      setApprovalIndentId(null);
      setApprovalAction(null);
      await mutate();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update indent');
    }
  }

  return (
    <>
      <AppCard>
        <AppCard.Header>
          <AppCard.Title>Indents</AppCard.Title>
          <AppCard.Description>Manage application indents.</AppCard.Description>
          {can(PERMISSIONS.CREATE_INDENTS) && (
            <AppCard.Action>
              <AppButton
                size='sm'
                iconName='Plus'
                type='button'
                onClick={() => pushWithScrollSave('/indents/new')}
              >
                Add
              </AppButton>
            </AppCard.Action>
          )}
        </AppCard.Header>
        <AppCard.Content>
          <FilterBar title='Search & Filter'>
            <NonFormTextInput
              aria-label='Search indents'
              placeholder='Search indents...'
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              containerClassName='w-full'
            />
            <AppSelect
              value={siteDraft || '__all'}
              onValueChange={(v) => setSiteDraft(v === '__all' ? '' : v)}
              placeholder='Site'
            >
              <AppSelect.Item value='__all'>All Sites</AppSelect.Item>
              {sitesData?.data?.map((site) => (
                <AppSelect.Item key={site.id} value={String(site.id)}>
                  {site.site}
                </AppSelect.Item>
              ))}
            </AppSelect>
            <AppButton
              size='sm'
              onClick={applyFilters}
              disabled={
                !filtersDirty && !searchDraft && !siteDraft
              }
              className='min-w-[84px]'
            >
              Filter
            </AppButton>
            {(search || site) && (
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
          {/* Horizontal scroll wrapper for mobile */}
          <DataTable
            columns={columns}
            data={data?.data || []}
            loading={isLoading}
            sort={sortState}
            onSortChange={(s) => toggleSort(s.field)}
            stickyColumns={1}
            renderRowActions={(indent) => 
              !can(PERMISSIONS.EDIT_INDENTS) && !can(PERMISSIONS.DELETE_INDENTS) ? null : (
                <div className='flex gap-2'>
                  {can(PERMISSIONS.EDIT_INDENTS) && (
                    <EditButton
                      tooltip='Edit Indent'
                      aria-label='Edit Indent'
                      onClick={() => pushWithScrollSave(`/indents/${indent.id}/edit?${searchParams.toString()}`)}
                    />
                  )}
                  {can(PERMISSIONS.EDIT_INDENTS) && getAvailableActions(indent.approvalStatus).length > 0 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <AppButton size='sm' variant='secondary'>Status</AppButton>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {getAvailableActions(indent.approvalStatus).map(a => (
                          <DropdownMenuItem key={a.key} onSelect={() => openApproval(indent.id, a.key)}>
                            {a.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                  {can(PERMISSIONS.DELETE_INDENTS) && (
                    <DeleteButton
                      onDelete={() => handleDelete(indent.id)}
                      itemLabel='indent'
                      title='Delete indent?'
                      description={`This will permanently remove indent ${indent.indentNo}. This action cannot be undone.`}
                    />
                  )}
                </div>
              )
            }
          />
        </AppCard.Content>
        <AppCard.Footer className='justify-end'>
          <Pagination
            page={data?.meta?.page || page}
            totalPages={data?.meta?.totalPages || 1}
            total={data?.meta?.total}
            perPage={data?.meta?.perPage || perPage}
            onPerPageChange={(val) => {
              console.log('Changing perPage from', perPage, 'to', val);
              setQp({ page: 1, perPage: val });
            }}
            onPageChange={(p) => {
              console.log('Changing page from', page, 'to', p);
              setQp({ page: p });
            }}
            showPageNumbers
            maxButtons={5}
            disabled={isLoading}
          />
        </AppCard.Footer>
      </AppCard>

      {/* Pre-approval Dialog */}
      <Dialog open={approvalOpen} onOpenChange={setApprovalOpen}>
        <DialogContent className="sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Review and Approve Indent</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {approvalLoading || !approvalIndent ? (
              <div className="p-4 text-sm text-muted-foreground">Loading...</div>
            ) : (
              <div className="border rounded-lg overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-3">Item</th>
                      <th className="text-left p-3">Unit</th>
                      <th className="text-left p-3">Qty</th>
                      <th className="text-left p-3">Approved Qty</th>
                      <th className="text-left p-3">Delivery Date</th>
                      <th className="text-left p-3">Remark</th>
                    </tr>
                  </thead>
                  <tbody>
                    {approvalIndent.indentItems?.map((it) => (
                      <tr key={it.id} className="border-t">
                        <td className="p-3 whitespace-nowrap">{it.item?.item} ({it.item?.itemCode})</td>
                        <td className="p-3 whitespace-nowrap">{it.unit?.unitName}</td>
                        <td className="p-3 w-[120px]">
                          <Input
                            type="number"
                            step="0.01"
                            min={0}
                            max={MAX_DEC}
                            value={itemEdits[it.id]?.indentQty ?? Number(it.indentQty || 0)}
                            onChange={(e) => setEdit(it.id, 'indentQty', e.target.value)}
                          />
                        </td>
                        <td className="p-3 w-[140px]">
                          <Input
                            type="number"
                            step="0.01"
                            min={0}
                            max={MAX_DEC}
                            required
                            value={itemEdits[it.id]?.approvedQty ?? (typeof it.approvedQty === 'number' ? it.approvedQty : Number(it.indentQty || 0))}
                            onChange={(e) => setEdit(it.id, 'approvedQty', e.target.value)}
                          />
                        </td>
                        <td className="p-3 w-[160px]">
                          <Input
                            type="date"
                            value={itemEdits[it.id]?.deliveryDate || formatDateForInput(it.deliveryDate)}
                            onChange={(e) => setEdit(it.id, 'deliveryDate', e.target.value)}
                          />
                        </td>
                        <td className="p-3 w-[320px]">
                          <Textarea
                            value={itemEdits[it.id]?.remark ?? (it.remark ?? '')}
                            onChange={(e) => setEdit(it.id, 'remark', e.target.value)}
                            rows={2}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <DialogFooter>
            <AppButton variant='secondary' onClick={() => setApprovalOpen(false)}>Cancel</AppButton>
            <AppButton onClick={handleApproveConfirm} disabled={approvalLoading || !approvalIndent}>
              {approvalAction === 'approve1' ? 'Approve 1' : approvalAction === 'approve2' ? 'Approve 2' : approvalAction === 'complete' ? 'Complete' : 'Suspend'}
            </AppButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

