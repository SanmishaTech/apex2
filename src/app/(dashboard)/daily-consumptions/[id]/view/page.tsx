'use client';

import useSWR from 'swr';
import { useParams, useRouter } from 'next/navigation';
import { AppCard } from '@/components/common/app-card';
import { AppButton } from '@/components/common';
import { apiGet } from '@/lib/api-client';
import { formatDate } from '@/lib/utils';
import { usePermissions } from '@/hooks/use-permissions';
import { PERMISSIONS } from '@/config/roles';

export default function ViewDailyConsumptionPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params?.id);
  const { can } = usePermissions();

  const { data, isLoading } = useSWR<any>(Number.isFinite(id) ? `/api/daily-consumptions/${id}` : null, apiGet);
  const dc = data;

  if (!can(PERMISSIONS.VIEW_DAILY_CONSUMPTIONS)) {
    return (
      <AppCard>
        <AppCard.Header>
          <AppCard.Title>Daily Consumption</AppCard.Title>
          <AppCard.Description>Access denied</AppCard.Description>
          <AppCard.Action>
            <AppButton variant='secondary' size='sm' iconName='ArrowLeft' onClick={() => router.push('/daily-consumptions')}>
              Back
            </AppButton>
          </AppCard.Action>
        </AppCard.Header>
        <AppCard.Content>
          <div className='text-sm text-muted-foreground'>You do not have permission to view this page.</div>
        </AppCard.Content>
      </AppCard>
    );
  }

  return (
    <AppCard>
      <AppCard.Header>
        <AppCard.Title>Daily Consumption</AppCard.Title>
        <AppCard.Description>Read-only view</AppCard.Description>
        <AppCard.Action>
          <AppButton variant='secondary' size='sm' iconName='ArrowLeft' onClick={() => router.push('/daily-consumptions')}>
            Back
          </AppButton>
        </AppCard.Action>
      </AppCard.Header>
      <AppCard.Content>
        {isLoading ? (
          <div className='text-sm text-muted-foreground'>Loading...</div>
        ) : dc ? (
          <div className='space-y-6'>
            <div className='grid grid-cols-3 gap-4'>
              <div>
                <div className='text-xs text-muted-foreground'>Daily Consumption Number</div>
                <div className='font-medium'>{dc.dailyConsumptionNo}</div>
              </div>
              <div>
                <div className='text-xs text-muted-foreground'>Daily Consumption Date</div>
                <div className='font-medium'>{formatDate(dc.dailyConsumptionDate)}</div>
              </div>
              <div>
                <div className='text-xs text-muted-foreground'>Site</div>
                <div className='font-medium'>{dc.site?.site || '-'}</div>
              </div>
              <div>
                <div className='text-xs text-muted-foreground'>Total Amount</div>
                <div className='font-medium'>{Number(dc.totalAmount || 0).toFixed(2)}</div>
              </div>
              <div>
                <div className='text-xs text-muted-foreground'>Prepared By</div>
                <div className='font-medium'>{dc.createdBy?.name || '-'}</div>
              </div>
            </div>

            <div className='rounded-xl border bg-background p-4 shadow-sm'>
              <div className='text-base font-semibold mb-3'>Consumption Details</div>
              <div className='grid grid-cols-12 gap-3 text-sm font-medium text-muted-foreground'>
                <div className='col-span-1'>Sr No</div>
                <div className='col-span-5'>Item</div>
                <div className='col-span-2'>Unit</div>
                <div className='col-span-2'>Qty</div>
                <div className='col-span-2'>Amount</div>
              </div>
              {(dc.dailyConsumptionDetails || []).map((d: any, idx: number) => (
                <div key={d.id} className='grid grid-cols-12 gap-3 items-center py-2 border-b'>
                  <div className='col-span-1'>{idx + 1}</div>
                  <div className='col-span-5 truncate'>{d.item?.item || '-'}</div>
                  <div className='col-span-2'>{d.item?.unit?.unitName || '-'}</div>
                  <div className='col-span-2'>{Number(d.qty || 0).toFixed(4)}</div>
                  <div className='col-span-2'>{Number(d.amount || 0).toFixed(2)}</div>
                </div>
              ))}
              {(!dc.dailyConsumptionDetails || dc.dailyConsumptionDetails.length === 0) && (
                <div className='text-sm text-muted-foreground py-3'>No details</div>
              )}
            </div>
          </div>
        ) : (
          <div className='text-sm text-muted-foreground'>Not found</div>
        )}
      </AppCard.Content>
    </AppCard>
  );
}
