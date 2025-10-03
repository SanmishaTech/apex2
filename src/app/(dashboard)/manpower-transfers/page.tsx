'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useScrollRestoration } from '@/hooks/use-scroll-restoration';
import { useProtectPage } from '@/hooks/use-protect-page';
import { usePermissions } from '@/hooks/use-permissions';
import { PERMISSIONS } from '@/config/roles';
import { AppCard } from '@/components/common/app-card';
import { AppButton } from '@/components/common/app-button';
import { DataTable, type Column, type SortState } from '@/components/common/data-table';
import { formatDate } from '@/lib/locales';
import { Plus, Eye, MoreHorizontal, FileText, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import type { ManpowerTransfersResponse, ManpowerTransfer } from '@/types/manpower-transfers';

// API client function
async function fetchManpowerTransfers(url: string): Promise<ManpowerTransfersResponse> {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch manpower transfers');
  return res.json();
}

export default function ManpowerTransfersPage() {
  const { pushWithScrollSave } = useScrollRestoration('manpower-transfers-list');
  
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('createdAt');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  // Check permissions
  useProtectPage();
  const { can } = usePermissions();
  const canCreate = can(PERMISSIONS.CREATE_MANPOWER_TRANSFERS);
  const canApprove = can(PERMISSIONS.APPROVE_MANPOWER_TRANSFERS);

  // Build query string
  const queryParams = new URLSearchParams({
    page: page.toString(),
    perPage: perPage.toString(),
    search,
    sort,
    order,
  });

  // Data fetching with SWR
  const { data, error, isLoading, mutate } = useSWR(
    `/api/manpower-transfers?${queryParams}`,
    fetchManpowerTransfers,
    {
      keepPreviousData: true,
    }
  );

  // Handle search
  const handleSearch = (newSearch: string) => {
    setSearch(newSearch);
    setPage(1);
  };

  // Handle sort change
  const sortState: SortState = { field: sort, order };
  
  const handleSortChange = (newSort: SortState) => {
    setSort(newSort.field);
    setOrder(newSort.order);
    setPage(1);
  };

  // Navigation helpers
  const goToNew = () => {
    pushWithScrollSave('/manpower-transfers/new');
  };

  const goToView = (transfer: ManpowerTransfer) => {
    pushWithScrollSave(`/manpower-transfers/${transfer.id}`);
  };

  // Handle approve/reject
  const handleStatusUpdate = async (transfer: ManpowerTransfer, status: 'Accepted' | 'Rejected') => {
    setUpdatingId(transfer.id);
    try {
      const res = await fetch(`/api/manpower-transfers/${transfer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          status,
          approvedById: 1, // TODO: Get from user context
        }),
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to update transfer');
      }
      
      toast.success(`Transfer ${status.toLowerCase()} successfully`);
      mutate(); // Refresh the list
    } catch (error: any) {
      console.error('Status update error:', error);
      toast.error(error.message || `Failed to ${status.toLowerCase()} transfer`);
    } finally {
      setUpdatingId(null);
    }
  };

  // Status badge component
  const StatusBadge = ({ status }: { status: string }) => {
    const colors = {
      Pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
      Accepted: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      Rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    };
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800'}`}>
        {status}
      </span>
    );
  };

  // Table columns
  const columns: Column<ManpowerTransfer>[] = [
    {
      key: 'challanNo',
      header: 'Challan No',
      sortable: true,
      accessor: (transfer: ManpowerTransfer) => (
        <span className="font-mono text-sm">{transfer.challanNo}</span>
      ),
    },
    {
      key: 'challanDate',
      header: 'Challan Date',
      sortable: true,
      accessor: (transfer: ManpowerTransfer) => (
        <span>{formatDate(transfer.challanDate)}</span>
      ),
    },
    {
      key: 'fromSite',
      header: 'From Site',
      sortable: false,
      accessor: (transfer: ManpowerTransfer) => (
        <span className="font-medium">{transfer.fromSite.site}</span>
      ),
    },
    {
      key: 'toSite',
      header: 'To Site',
      sortable: false,
      accessor: (transfer: ManpowerTransfer) => (
        <span className="font-medium">{transfer.toSite.site}</span>
      ),
    },
    {
      key: 'transferItems',
      header: 'Manpower Count',
      sortable: false,
      accessor: (transfer: ManpowerTransfer) => (
        <span className="text-center block">{transfer.transferItems?.length || 0}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      accessor: (transfer: ManpowerTransfer) => (
        <StatusBadge status={transfer.status} />
      ),
    },
    {
      key: 'approvedBy',
      header: 'Approved By',
      sortable: false,
      accessor: (transfer: ManpowerTransfer) => (
        <span>{transfer.approvedBy?.name || '-'}</span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Created At',
      sortable: true,
      accessor: (transfer: ManpowerTransfer) => (
        <span>{formatDate(transfer.createdAt)}</span>
      ),
    },
  ];

  // Row actions
  const renderRowActions = (transfer: ManpowerTransfer) => {
    const isPending = transfer.status === 'Pending';
    
    return (
      <div className="flex items-center gap-1">
        <AppButton
          variant="ghost"
          size="sm"
          onClick={() => goToView(transfer)}
          title="View transfer details"
        >
          <Eye className="h-4 w-4" />
        </AppButton>
        {transfer.challanCopyUrl && (
          <AppButton
            variant="ghost"
            size="sm"
            onClick={() => window.open(`/api/documents/${transfer.challanCopyUrl.split('/').pop()}`, '_blank')}
            title="View challan copy"
          >
            <FileText className="h-4 w-4" />
          </AppButton>
        )}
        {isPending && canApprove && (
          <>
            <AppButton
              variant="ghost"
              size="sm"
              onClick={() => handleStatusUpdate(transfer, 'Accepted')}
              disabled={updatingId === transfer.id}
              title="Approve transfer"
              className="text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950/20"
            >
              <Check className="h-4 w-4" />
            </AppButton>
            <AppButton
              variant="ghost"
              size="sm"
              onClick={() => handleStatusUpdate(transfer, 'Rejected')}
              disabled={updatingId === transfer.id}
              title="Reject transfer"
              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
            >
              <X className="h-4 w-4" />
            </AppButton>
          </>
        )}
      </div>
    );
  };


  return (
    <AppCard>
      <AppCard.Header>
        <AppCard.Title>Manpower Transfers</AppCard.Title>
        <AppCard.Description>
          Manage manpower transfers between sites with approval workflow.
        </AppCard.Description>
        {canCreate && (
          <AppCard.Action>
            <AppButton size="sm" onClick={goToNew}>
              <Plus className="h-4 w-4 mr-2" />
              Create Transfer
            </AppButton>
          </AppCard.Action>
        )}
      </AppCard.Header>

      <AppCard.Content>
        {/* Search Bar */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search transfers..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full max-w-md px-3 py-2 border border-input rounded-md bg-background text-foreground focus:ring-ring focus:border-ring"
          />
        </div>
        
        <DataTable
          columns={columns}
          data={data?.data || []}
          loading={isLoading}
          sort={sortState}
          onSortChange={handleSortChange}
          renderRowActions={renderRowActions}
          emptyMessage="No manpower transfers found"
        />
        
        {/* Pagination */}
        {data && data.meta.totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              Showing {((data.meta.page - 1) * data.meta.perPage) + 1} to {Math.min(data.meta.page * data.meta.perPage, data.meta.total)} of {data.meta.total} transfers
            </div>
            <div className="flex items-center gap-2">
              <AppButton
                variant="outline"
                size="sm"
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
              >
                Previous
              </AppButton>
              <span className="text-sm">
                Page {page} of {data.meta.totalPages}
              </span>
              <AppButton
                variant="outline"
                size="sm"
                onClick={() => setPage(page + 1)}
                disabled={page >= data.meta.totalPages}
              >
                Next
              </AppButton>
            </div>
          </div>
        )}
      </AppCard.Content>
    </AppCard>
  );
}
