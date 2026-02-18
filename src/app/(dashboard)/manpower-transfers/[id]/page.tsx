'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useParams, useRouter } from 'next/navigation';
import { useScrollRestoration } from '@/hooks/use-scroll-restoration';
import { useProtectPage } from '@/hooks/use-protect-page';
import { PERMISSIONS } from '@/config/roles';
import { AppCard } from '@/components/common/app-card';
import { AppButton } from '@/components/common/app-button';
import { FormSection, FormRow } from '@/components/common/app-form';
import { DataTable } from '@/components/common/data-table';
import { toast } from 'sonner';
import { ArrowLeft, Check, X, FileText, Users, MapPin, Calendar, User, MessageSquare, Clock } from 'lucide-react';
import { formatCurrency, formatDate, formatDateForInput } from '@/lib/locales';
import type { ManpowerTransfer, ManpowerTransferItem, UpdateManpowerTransferRequest } from '@/types/manpower-transfers';

// API client functions
const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch data');
  return res.json();
};

const apiPatch = async (url: string, data: any) => {
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Request failed');
  }
  return res.json();
};

export default function ViewManpowerTransferPage() {
  const params = useParams();
  const router = useRouter();
  const { pushAndRestoreKey } = useScrollRestoration('manpower-transfer-view');
  
  const transferId = params?.id as string;

  // Check permissions
  const { loading: pageLoading } = useProtectPage();
  // TODO: Implement permission check for approval when hasPermission is available

  const [updating, setUpdating] = useState(false);

  // Fetch transfer data
  const { data: transfer, error, isLoading, mutate } = useSWR<ManpowerTransfer>(
    transferId ? `/api/manpower-transfers/${transferId}` : null,
    fetcher
  );

  // Handle approval/rejection
  const handleStatusUpdate = async (status: 'Accepted' | 'Rejected') => {
    if (!transfer) return;

    setUpdating(true);
    try {
      const request: UpdateManpowerTransferRequest = {
        status,
        approvedById: 1, // TODO: Get from user context
      };

      await apiPatch(`/api/manpower-transfers/${transferId}`, request);
      toast.success(`Transfer ${status.toLowerCase()} successfully`);
      mutate(); // Refresh data
    } catch (error: any) {
      console.error('Update transfer error:', error);
      toast.error(error.message || `Failed to ${status.toLowerCase()} transfer`);
    } finally {
      setUpdating(false);
    }
  };

  // Navigation
  const goBack = () => {
    pushAndRestoreKey('manpower-transfers-list');
  };

  // Status badge component
  const StatusBadge = ({ status }: { status: string }) => {
    const colors = {
      Pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
      Accepted: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      Rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    };
    
    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800'}`}>
        {status}
      </span>
    );
  };

  // Table columns for transfer items
  const columns = [
    {
      key: 'name',
      header: 'Manpower Name',
      accessor: (row: ManpowerTransferItem) => (
        <span className="font-medium">
          {`${row.firstName} ${row.middleName || ''} ${row.lastName}`.trim()}
        </span>
      ),
      sortable: false,
    },
    {
      key: 'supplier',
      header: 'Supplier',
      accessor: (row: ManpowerTransferItem) => (
        <span>{row.manpowerSupplier?.supplierName || '-'}</span>
      ),
      sortable: false,
    },
    {
      key: 'category',
      header: 'Category',
      accessor: (row: ManpowerTransferItem) => (
        <span>{row.category || '-'}</span>
      ),
      sortable: false,
    },
    {
      key: 'skillSet',
      header: 'Skill Set',
      accessor: (row: ManpowerTransferItem) => (
        <span>{row.skillSet || '-'}</span>
      ),
      sortable: false,
    },
    {
      key: 'wage',
      header: 'Wage (₹)',
      accessor: (row: ManpowerTransferItem) => (
        <span>{row.wage ? formatCurrency(Number(row.wage)) : '-'}</span>
      ),
      sortable: false,
    },
    {
      key: 'minWage',
      header: 'Min Wage (₹)',
      accessor: (row: ManpowerTransferItem) => (
        <span>{row.minWage ? formatCurrency(Number(row.minWage)) : '-'}</span>
      ),
      sortable: false,
    },
    {
      key: 'mobileNumber',
      header: 'Mobile',
      accessor: (row: ManpowerTransferItem) => (
        <span className="font-mono text-sm">{row.mobileNumber || '-'}</span>
      ),
      sortable: false,
    },
  ];

  if (pageLoading) {
    return <div className="p-6">Loading...</div>;
  }

  if (isLoading) {
    return <div className="p-6">Loading transfer details...</div>;
  }

  if (error || !transfer) {
    return (
      <div className="p-6">
        <div className="text-center text-red-600">
          {error?.message || 'Transfer not found'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Transfer Header with Status Banner */}
      {transfer.status === 'Pending' && (
        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-950/20 dark:to-orange-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-yellow-500/10 rounded-full">
                <Clock className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-foreground mb-1">Pending Approval</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  This transfer request is awaiting your approval. Review the manpower details below and take action.
                </p>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Transfer</span>
                  <span className="font-semibold text-primary">{transfer.transferItems.length} workers</span>
                  <span className="text-muted-foreground">from</span>
                  <span className="font-semibold">{transfer.fromSite.site}</span>
                  <ArrowLeft className="h-4 w-4 rotate-180 text-muted-foreground" />
                  <span className="font-semibold">{transfer.toSite.site}</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <AppButton 
                onClick={() => handleStatusUpdate('Accepted')}
                disabled={updating}
                isLoading={updating}
                className="bg-green-600 hover:bg-green-700 text-white min-w-[120px]"
              >
                <Check className="h-4 w-4 mr-2" />
                Approve Transfer
              </AppButton>
              <AppButton 
                variant="outline"
                onClick={() => handleStatusUpdate('Rejected')}
                disabled={updating}
                className="text-red-600 border-red-300 hover:bg-red-50 dark:hover:bg-red-950/20"
              >
                <X className="h-4 w-4 mr-2" />
                Reject
              </AppButton>
            </div>
          </div>
        </div>
      )}

      {transfer.status === 'Accepted' && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border border-green-200 dark:border-green-800 rounded-lg p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-500/10 rounded-full">
              <Check className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-foreground mb-1">Transfer Approved</h3>
              <p className="text-sm text-muted-foreground">
                This transfer was approved by <strong>{transfer.approvedBy?.name}</strong> on {transfer.approvedAt ? formatDate(transfer.approvedAt) : 'N/A'}.
                All manpower have been successfully transferred to {transfer.toSite.site}.
              </p>
            </div>
          </div>
        </div>
      )}

      {transfer.status === 'Rejected' && (
        <div className="bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-950/20 dark:to-rose-950/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-500/10 rounded-full">
              <X className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-foreground mb-1">Transfer Rejected</h3>
              <p className="text-sm text-muted-foreground">
                This transfer was rejected by <strong>{transfer.approvedBy?.name}</strong> on {transfer.approvedAt ? formatDate(transfer.approvedAt) : 'N/A'}.
                No changes were made to manpower assignments.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Header */}
      <AppCard>
        <AppCard.Header>
          <div className="flex items-center gap-4">
            <AppButton variant="ghost" size="sm" onClick={goBack}>
              <ArrowLeft className="h-4 w-4" />
            </AppButton>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <AppCard.Title>Transfer {transfer.challanNo}</AppCard.Title>
                <StatusBadge status={transfer.status} />
              </div>
              <AppCard.Description>
                Created on {formatDate(transfer.createdAt)}
              </AppCard.Description>
            </div>
          </div>
        </AppCard.Header>

        <AppCard.Content>
          <FormSection title="Transfer Information">
            <FormRow>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  <Calendar className="h-4 w-4 mr-2 inline" />
                  Date
                </label>
                <div className="text-foreground font-medium">
                  {formatDate(transfer.challanDate)}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  <MapPin className="h-4 w-4 mr-2 inline" />
                  From Site
                </label>
                <div className="text-foreground font-medium">
                  {transfer.fromSite.site}
                </div>
              </div>
            </FormRow>

            <FormRow>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  <MapPin className="h-4 w-4 mr-2 inline" />
                  To Site
                </label>
                <div className="text-foreground font-medium">
                  {transfer.toSite.site}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  <Users className="h-4 w-4 mr-2 inline" />
                  Manpower Count
                </label>
                <div className="text-foreground font-medium">
                  {transfer.transferItems.length} Workers
                </div>
              </div>
            </FormRow>

            {transfer.approvedBy && (
              <FormRow>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">
                    <User className="h-4 w-4 mr-2 inline" />
                    Approved By
                  </label>
                  <div className="text-foreground font-medium">
                    {transfer.approvedBy.name}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">
                    <Calendar className="h-4 w-4 mr-2 inline" />
                    Approved At
                  </label>
                  <div className="text-foreground font-medium">
                    {transfer.approvedAt ? formatDate(transfer.approvedAt) : '-'}
                  </div>
                </div>
              </FormRow>
            )}

            {transfer.remarks && (
              <FormRow>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-muted-foreground mb-1">
                    <MessageSquare className="h-4 w-4 mr-2 inline" />
                    Remarks
                  </label>
                  <div className="text-foreground bg-muted p-3 rounded-md">
                    {transfer.remarks}
                  </div>
                </div>
              </FormRow>
            )}
          </FormSection>
        </AppCard.Content>
      </AppCard>

      {/* Transfer Items */}
      <AppCard>
        <AppCard.Header>
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <AppCard.Title>Manpower Details</AppCard.Title>
                <AppCard.Description>
                  {transfer.transferItems.length} {transfer.transferItems.length === 1 ? 'worker' : 'workers'} included in this transfer
                </AppCard.Description>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-primary">{transfer.transferItems.length}</div>
              <div className="text-xs text-muted-foreground">Total Workers</div>
            </div>
          </div>
        </AppCard.Header>

        <AppCard.Content className="p-0">
          <DataTable
            columns={columns}
            data={transfer.transferItems || []}
            loading={false}
            emptyMessage="No manpower in this transfer"
          />
        </AppCard.Content>
      </AppCard>
    </div>
  );
}
