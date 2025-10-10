'use client';

import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { apiGet } from '@/lib/api-client';
import { CashbookForm } from '../../cashbook-form';
import { useProtectPage } from '@/hooks/use-protect-page';
import type { Cashbook } from '@/types/cashbooks';

export default function EditCashbookPage() {
  const params = useParams<{ id?: string }>();
  const cashbookId = params?.id as string | undefined;
  
  useProtectPage();

  // Fetch cashbook data
  const { data: cashbook, error, isLoading } = useSWR<Cashbook>(
    cashbookId ? `/api/cashbooks/${cashbookId}` : null,
    apiGet
  );

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
