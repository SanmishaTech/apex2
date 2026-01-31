'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { apiGet, apiPatch } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { AppCard } from '@/components/common/app-card';
import { AppButton } from '@/components/common/app-button';
import { FormRow, FormSection } from '@/components/common/app-form';
import { useProtectPage } from '@/hooks/use-protect-page';
import { usePermissions } from '@/hooks/use-permissions';
import { useCurrentUser } from '@/hooks/use-current-user';
import { PERMISSIONS } from '@/config/roles';
import type { Cashbook } from '@/types/cashbooks';

export default function CashbookApprove1Page() {
  const params = useParams<{ id?: string }>();
  const router = useRouter();
  const cashbookId = params?.id as string | undefined;

  useProtectPage();

  const { can } = usePermissions();
  const { user } = useCurrentUser();

  const [submitting, setSubmitting] = useState(false);

  const { data, error, isLoading, mutate } = useSWR<Cashbook>(
    cashbookId && can(PERMISSIONS.APPROVE_CASHBOOKS_L1)
      ? `/api/cashbooks/${cashbookId}`
      : null,
    apiGet
  );

  const canApprove = useMemo(() => {
    if (!data?.id) return false;
    if (!can(PERMISSIONS.APPROVE_CASHBOOKS_L1)) return false;
    if (data.isApproved1) return false;
    // creator cannot approve own cashbook
    if (typeof data.createdById === 'number' && typeof user?.id === 'number' && data.createdById === user.id) {
      return false;
    }
    return true;
  }, [can, data?.id, data?.isApproved1, data?.createdById, user?.id]);

  const resolveDocumentUrl = useMemo(() => {
    return (url: string | null | undefined) => {
      if (!url) return '#';
      if (url.startsWith('/uploads/')) return `/api${url}`;
      if (url.startsWith('http')) return url;
      return `/api/documents/${url}`;
    };
  }, []);

  const createdByText =
    data?.createdBy?.name || data?.createdBy?.email || (data?.createdById ? `User #${data.createdById}` : '-');
  const approved1ByText =
    data?.approved1By?.name || data?.approved1By?.email || (data?.approved1ById ? `User #${data.approved1ById}` : '-');
  const approved2ByText =
    data?.approved2By?.name || data?.approved2By?.email || (data?.approved2ById ? `User #${data.approved2ById}` : '-');

  async function handleApprove() {
    if (!data?.id) return;
    if (!canApprove) {
      toast.error('You cannot approve this cashbook');
      return;
    }
    setSubmitting(true);
    try {
      await apiPatch(`/api/cashbooks/${data.id}`, { statusAction: 'approve1' });
      toast.success('Cashbook approved (Level 1)');
      await mutate();
      router.push('/cashbooks');
    } catch (e) {
      toast.error((e as Error).message || 'Failed to approve cashbook');
    } finally {
      setSubmitting(false);
    }
  }

  if (!can(PERMISSIONS.APPROVE_CASHBOOKS_L1)) {
    return (
      <div className="container mx-auto py-6">
        <AppCard>
          <AppCard.Content className="p-6">
            <div className="text-center text-muted-foreground">
              You do not have permission to approve cashbook (Level 1).
            </div>
            <div className="mt-4 flex justify-center">
              <AppButton variant="secondary" onClick={() => router.push('/cashbooks')}>
                Back
              </AppButton>
            </div>
          </AppCard.Content>
        </AppCard>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading cashbook...</div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg text-red-600">
            {error instanceof Error ? error.message : 'Cashbook not found'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <AppCard>
        <AppCard.Header>
          <AppCard.Title>Approve Cashbook (Level 1)</AppCard.Title>
          <AppCard.Description>
            Review the cashbook details below (read-only) and approve.
          </AppCard.Description>
        </AppCard.Header>

        <AppCard.Content className="space-y-6">
          {!canApprove && (
            <div className="p-3 rounded border bg-muted text-sm text-muted-foreground">
              This cashbook cannot be approved right now (already approved, or you are not allowed to approve it).
            </div>
          )}

          <FormSection legend="Header">
            <FormRow cols={2}>
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">Voucher No</div>
                <div className="p-2 rounded border bg-muted">{data.voucherNo || '-'}</div>
              </div>
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">Voucher Date</div>
                <div className="p-2 rounded border bg-muted">{String(data.voucherDate).slice(0, 10)}</div>
              </div>
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">Site</div>
                <div className="p-2 rounded border bg-muted">{data.site?.site || '-'}</div>
              </div>
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">BOQ</div>
                <div className="p-2 rounded border bg-muted">{data.boq?.boqNo || '-'}</div>
              </div>
            </FormRow>

            <FormRow cols={1}>
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">Voucher Copy</div>
                <div className="p-2 rounded border bg-muted">
                  {data.attachVoucherCopyUrl ? (
                    <a
                      className="text-primary underline"
                      href={resolveDocumentUrl(data.attachVoucherCopyUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View attachment
                    </a>
                  ) : (
                    '-'
                  )}
                </div>
              </div>
            </FormRow>
          </FormSection>

          <FormSection legend="Approval / Audit">
            <FormRow cols={2}>
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">Created By</div>
                <div className="p-2 rounded border bg-muted">{createdByText}</div>
              </div>
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">Created At</div>
                <div className="p-2 rounded border bg-muted">{String(data.createdAt).replace('T', ' ').slice(0, 19)}</div>
              </div>
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">Approved 1 By</div>
                <div className="p-2 rounded border bg-muted">{approved1ByText}</div>
              </div>
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">Approved 1 At</div>
                <div className="p-2 rounded border bg-muted">{data.approved1At ? String(data.approved1At).replace('T', ' ').slice(0, 19) : '-'}</div>
              </div>
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">Approved 2 By</div>
                <div className="p-2 rounded border bg-muted">{approved2ByText}</div>
              </div>
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">Approved 2 At</div>
                <div className="p-2 rounded border bg-muted">{data.approved2At ? String(data.approved2At).replace('T', ' ').slice(0, 19) : '-'}</div>
              </div>
            </FormRow>
          </FormSection>

          <FormSection legend="Details">
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 dark:bg-gray-800">
                  <tr>
                    <th className="px-3 py-2 text-left">Head</th>
                    <th className="px-3 py-2 text-left">Description</th>
                    <th className="px-3 py-2 text-right">Opening</th>
                    <th className="px-3 py-2 text-right">Received</th>
                    <th className="px-3 py-2 text-right">Paid</th>
                    <th className="px-3 py-2 text-right">Closing</th>
                    <th className="px-3 py-2 text-left">Document</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.cashbookDetails || []).map((d, idx) => (
                    <tr key={d.id ?? idx} className="border-t dark:border-gray-700">
                      <td className="px-3 py-2">{d.cashbookHead?.cashbookHeadName || d.cashbookHeadId}</td>
                      <td className="px-3 py-2">{d.description || '-'}</td>
                      <td className="px-3 py-2 text-right font-mono">{d.openingBalance ?? '-'}</td>
                      <td className="px-3 py-2 text-right font-mono">{d.amountReceived ?? '-'}</td>
                      <td className="px-3 py-2 text-right font-mono">{d.amountPaid ?? '-'}</td>
                      <td className="px-3 py-2 text-right font-mono">{d.closingBalance ?? '-'}</td>
                      <td className="px-3 py-2">
                        {d.documentUrl ? (
                          <a
                            className="text-primary underline"
                            href={resolveDocumentUrl(d.documentUrl)}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            View
                          </a>
                        ) : (
                          '-'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </FormSection>
        </AppCard.Content>

        <AppCard.Footer className="justify-end space-x-3">
          <AppButton variant="secondary" onClick={() => router.push('/cashbooks')} disabled={submitting}>
            Back
          </AppButton>
          <AppButton
            onClick={handleApprove}
            isLoading={submitting}
            disabled={submitting || !canApprove}
            className="bg-green-600 hover:bg-green-700"
          >
            Approve 1
          </AppButton>
        </AppCard.Footer>
      </AppCard>
    </div>
  );
}
