'use client';

import useSWR from 'swr';
import Link from 'next/link';
import { useMemo, useState, useEffect } from 'react';
import { apiGet, apiDelete } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { AppCard } from '@/components/common/app-card';
import { AppButton } from '@/components/common/app-button';
import { FilterBar } from '@/components/common';
import { NonFormTextInput } from '@/components/common/non-form-text-input';
import { DataTable, Column, SortState } from '@/components/common/data-table';
import { DeleteButton } from '@/components/common/delete-button';
import { EditButton } from '@/components/common/icon-button';
import { Pagination } from '@/components/common/pagination';
import { usePermissions } from '@/hooks/use-permissions';
import { PERMISSIONS } from '@/config/roles';
import { useQueryParamsState } from '@/hooks/use-query-params-state';
import { useScrollRestoration } from '@/hooks/use-scroll-restoration';
import { BulkManpowerUploadDialog } from '@/components/common/bulk-manpower-upload-dialog';
import * as XLSX from 'xlsx';

export type ManpowerListItem = {
  id: number;
  firstName: string;
  middleName: string | null;
  lastName: string;
  supplierId: number;
  manpowerSupplier: { id: number; supplierName: string } | null;
  mobileNumber: string | null;
  wage: string | null; // Prisma Decimal serialized
  createdAt: string;
  updatedAt: string;
};

export type ManpowerResponse = {
  data: ManpowerListItem[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
};

export default function ManpowerPage() {
  const { pushWithScrollSave } = useScrollRestoration('manpower-list');
  
  const [qp, setQp] = useQueryParamsState({ page: 1, perPage: 10, search: '', sort: 'firstName', order: 'asc' });
  const { page, perPage, search, sort, order } = qp as unknown as { page: number; perPage: number; search: string; sort: string; order: 'asc' | 'desc' };

  const [searchDraft, setSearchDraft] = useState(search);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  useEffect(() => { setSearchDraft(search); }, [search]);
  const filtersDirty = searchDraft !== search;

  const query = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set('page', String(page));
    sp.set('perPage', String(perPage));
    if (search) sp.set('search', search);
    if (sort) sp.set('sort', sort);
    if (order) sp.set('order', order);
    return `/api/manpower?${sp.toString()}`;
  }, [page, perPage, search, sort, order]);

  const { data, error, isLoading, mutate } = useSWR<ManpowerResponse>(query, apiGet);
  const { can } = usePermissions();

  if (error) toast.error((error as Error).message || 'Failed to load manpower');

  function applyFilters() { setQp({ page: 1, search: searchDraft.trim() }); }
  function resetFilters() { setSearchDraft(''); setQp({ page: 1, search: '' }); }
  function toggleSort(field: string) { setQp(sort === field ? { order: order === 'asc' ? 'desc' : 'asc' } : { sort: field, order: 'asc' }); }

  const columns: Column<ManpowerListItem>[] = [
    {
      key: 'firstName', header: 'Name', sortable: true, accessor: (r) => `${r.firstName}${r.middleName ? ' ' + r.middleName : ''} ${r.lastName}`,
      className: 'whitespace-nowrap', cellClassName: 'font-medium whitespace-nowrap',
    },
    { key: 'manpowerSupplier', header: 'Supplier', sortable: false, accessor: (r) => r.manpowerSupplier?.supplierName || '-', className: 'whitespace-nowrap' },
    { key: 'mobileNumber', header: 'Mobile', sortable: false, className: 'whitespace-nowrap' },
    { key: 'wage', header: 'Wage', sortable: true, className: 'text-right whitespace-nowrap', cellClassName: 'text-right tabular-nums whitespace-nowrap' },
    { key: 'createdAt', header: 'Created', sortable: true, className: 'whitespace-nowrap' },
  ];

  const sortState: SortState = { field: sort, order };

  async function handleDelete(id: number) {
    try {
      await apiDelete(`/api/manpower/${id}`);
      toast.success('Deleted');
      await mutate();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function handleExport() {
    try {
      // Fetch all manpower without pagination
      const exportQuery = `/api/manpower?perPage=10000${search ? `&search=${search}` : ''}`;
      const exportData = await apiGet(exportQuery) as ManpowerResponse;
      
      // Prepare data for Excel export
      const excelData = exportData.data.map((item) => ({
        'First Name': item.firstName,
        'Middle Name': item.middleName || '',
        'Last Name': item.lastName,
        'Full Name': `${item.firstName}${item.middleName ? ' ' + item.middleName : ''} ${item.lastName}`,
        'Supplier': item.manpowerSupplier?.supplierName || '',
        'Mobile Number': item.mobileNumber || '',
        'Wage': item.wage || '',
        'Created Date': new Date(item.createdAt).toLocaleDateString(),
        'Updated Date': new Date(item.updatedAt).toLocaleDateString(),
      }));

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);
      
      // Set column widths for better readability
      const colWidths = [
        { wch: 15 }, // First Name
        { wch: 15 }, // Middle Name
        { wch: 15 }, // Last Name
        { wch: 30 }, // Full Name
        { wch: 25 }, // Supplier
        { wch: 15 }, // Mobile Number
        { wch: 12 }, // Wage
        { wch: 15 }, // Created Date
        { wch: 15 }, // Updated Date
      ];
      ws['!cols'] = colWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Manpower');

      // Generate filename with current date
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD format
      const filename = `manpower_export_${dateStr}.xlsx`;

      // Save the file
      XLSX.writeFile(wb, filename);
      
      toast.success(`Exported ${exportData.data.length} manpower records`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export manpower');
    }
  }

  return (
    <AppCard>
      <AppCard.Header>
        <AppCard.Title>Manpower</AppCard.Title>
        <AppCard.Description>Manage manpower workers.</AppCard.Description>
        {can(PERMISSIONS.EDIT_MANPOWER) && (
          <AppCard.Action>
            <AppButton 
              size='sm' 
              iconName='Plus' 
              type='button'
              onClick={() => pushWithScrollSave('/manpower/new')}
            >
              Add
            </AppButton>
          </AppCard.Action>
        )}
      </AppCard.Header>
      <AppCard.Content>
        <FilterBar title='Search'>
          <NonFormTextInput aria-label='Search' placeholder='Search by name, mobile, supplier...' value={searchDraft} onChange={(e) => setSearchDraft(e.target.value)} containerClassName='w-full' />
          <AppButton size='sm' onClick={applyFilters} disabled={!filtersDirty && !searchDraft} className='min-w-[84px]'>Filter</AppButton>
          {can(PERMISSIONS.EDIT_MANPOWER) && (
            <AppButton variant='outline' size='sm' onClick={() => setUploadDialogOpen(true)} iconName='Upload' className='min-w-[84px]'>Upload</AppButton>
          )}
          <AppButton variant='outline' size='sm' onClick={handleExport} iconName='Download' className='min-w-[84px]'>Export</AppButton>
          {search && (
            <AppButton variant='secondary' size='sm' onClick={resetFilters} className='min-w-[84px]'>Reset</AppButton>
          )}
        </FilterBar>
        <BulkManpowerUploadDialog 
          open={uploadDialogOpen} 
          onOpenChange={setUploadDialogOpen}
          onUploadSuccess={() => mutate()}
        />
        <DataTable
          columns={columns}
          data={data?.data || []}
          loading={isLoading}
          sort={sortState}
          onSortChange={(s) => toggleSort(s.field)}
          stickyColumns={1}
          renderRowActions={(row) => {
            if (!can(PERMISSIONS.EDIT_MANPOWER) && !can(PERMISSIONS.DELETE_MANPOWER)) return null;
            return (
              <div className='flex'>
                {can(PERMISSIONS.EDIT_MANPOWER) && (
                  <EditButton 
                    tooltip='Edit' 
                    aria-label='Edit' 
                    onClick={() => pushWithScrollSave(`/manpower/${row.id}/edit`)}
                  />
                )}
                {can(PERMISSIONS.DELETE_MANPOWER) && (
                  <DeleteButton onDelete={() => handleDelete(row.id)} itemLabel='manpower' title='Delete manpower?' description={`This will permanently remove ${row.firstName} ${row.lastName}.`} />
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
