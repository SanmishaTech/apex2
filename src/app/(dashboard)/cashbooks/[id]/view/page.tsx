'use client';

import { useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { apiGet } from '@/lib/api-client';
import { AppCard } from '@/components/common/app-card';
import { AppButton } from '@/components/common/app-button';
import { FormRow, FormSection } from '@/components/common/app-form';
import { useProtectPage } from '@/hooks/use-protect-page';
import { usePermissions } from '@/hooks/use-permissions';
import { PERMISSIONS } from '@/config/roles';
import type { Cashbook } from '@/types/cashbooks';

export default function CashbookViewPage() {
  const params = useParams<{ id?: string }>();
  const router = useRouter();
  const cashbookId = params?.id as string | undefined;

  const { loading: pageGuardLoading } = useProtectPage({ manual: true });
  const { can } = usePermissions();

  useEffect(() => {
    if (pageGuardLoading) return;
    if (!can(PERMISSIONS.VIEW_CASHBOOKS)) {
      router.replace('/dashboard');
    }
  }, [pageGuardLoading, can, router]);

  const { data, error, isLoading } = useSWR<Cashbook>(
    cashbookId && can(PERMISSIONS.VIEW_CASHBOOKS) ? `/api/cashbooks/${cashbookId}` : null,
    apiGet
  );

  const resolveDocumentUrl = useMemo(() => {
    return (url: string | null | undefined) => {
      if (!url) return '#';
      if (url.startsWith('/uploads/')) return `/api${url}`;
      if (url.startsWith('http')) return url;
      return `/api/documents/${url}`;
    };
  }, []);

  if (pageGuardLoading || !can(PERMISSIONS.VIEW_CASHBOOKS)) return null;

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
          <AppCard.Title>Cashbook View</AppCard.Title>
          <AppCard.Description>Read-only view of this cashbook voucher.</AppCard.Description>
        </AppCard.Header>

        <AppCard.Content className="space-y-6">
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
          <AppButton variant="secondary" onClick={() => router.push('/cashbooks')}>
            Back
          </AppButton>
        </AppCard.Footer>
      </AppCard>
    </div>
  );
}
