'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { apiGet } from '@/lib/api-client';
import { CashbookForm } from '../../cashbook-form';
import { useProtectPage } from '@/hooks/use-protect-page';
import type { Cashbook } from '@/types/cashbooks';
import { usePermissions } from '@/hooks/use-permissions';
import { PERMISSIONS } from '@/config/roles';
import { AppCard } from '@/components/common/app-card';
import { AppButton } from '@/components/common/app-button';
import { useRouter } from 'next/navigation';

export default function EditCashbookPage() {
  const params = useParams<{ id?: string }>();
  const cashbookId = params?.id as string | undefined;
  const router = useRouter();
  
  useProtectPage();
  const { can } = usePermissions();

  if (!can(PERMISSIONS.EDIT_CASHBOOKS)) {
    return (
      <div className="container mx-auto py-6">
        <AppCard>
          <AppCard.Content className="p-6">
            <div className="text-center text-muted-foreground">
              You do not have permission to edit cashbooks.
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

  // Fetch cashbook data
  const { data: cashbook, error, isLoading } = useSWR<Cashbook>(
    cashbookId ? `/api/cashbooks/${cashbookId}` : null,
    apiGet
  );

  useEffect(() => {
    if (!cashbookId) return;
    if (!cashbook) return;
    if (cashbook.isApproved1 || cashbook.isApproved2) {
      router.replace(`/cashbooks/${cashbookId}/view`);
    }
  }, [cashbookId, cashbook, router]);

  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading cashbook...</div>
        </div>
      </div>
    );
  }

  if (error || !cashbook) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg text-red-600">
            {error?.message || 'Cashbook not found'}
          </div>
        </div>
      </div>
    );
  }

  if (cashbook.isApproved1 || cashbook.isApproved2) return null;

  return (
    <div className="container mx-auto py-6">
      <CashbookForm 
        mode="edit" 
        initial={{
          id: cashbook.id,
          voucherNo: cashbook.voucherNo,
          voucherDate: cashbook.voucherDate,
          siteId: cashbook.siteId,
          boqId: cashbook.boqId,
          attachVoucherCopyUrl: cashbook.attachVoucherCopyUrl,
          cashbookDetails: cashbook.cashbookDetails || [],
        }}
      />
    </div>
  );
}
