'use client';

import useSWR from 'swr';
import { useParams, useRouter } from 'next/navigation';
import { AppCard } from '@/components/common/app-card';
import { AppButton } from '@/components/common';
import { apiGet } from '@/lib/api-client';
import { formatDate } from '@/lib/utils';
import { usePermissions } from '@/hooks/use-permissions';
import { PERMISSIONS } from '@/config/roles';

const fmtINR0to2 = new Intl.NumberFormat('en-IN', {
  useGrouping: true,
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const fmtINR2 = new Intl.NumberFormat('en-IN', {
  useGrouping: true,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function n(v: any) {
  const num = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(num) ? num : 0;
}

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
                <div className='font-medium'>{fmtINR2.format(n(dc.totalAmount || 0))}</div>
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
              {(dc.dailyConsumptionDetails || []).map((d: any, idx: number) => {
                const batches: any[] = Array.isArray(d.dailyConsumptionDetailBatch)
                  ? d.dailyConsumptionDetailBatch
                  : [];
                return (
                  <div key={d.id} className='border-b'>
                    <div className='grid grid-cols-12 gap-3 items-center py-2'>
                      <div className='col-span-1'>{idx + 1}</div>
                      <div className='col-span-5 truncate'>{d.item?.item || '-'}</div>
                      <div className='col-span-2'>{d.item?.unit?.unitName || '-'}</div>
                      <div className='col-span-2'>{fmtINR0to2.format(n(d.qty || 0))}</div>
                      <div className='col-span-2'>{fmtINR2.format(n(d.amount || 0))}</div>
                    </div>

                    {batches.length > 0 ? (
                      <div className='px-3 pb-3'>
                        <div className='rounded-md border bg-muted/20'>
                          <div className='grid grid-cols-12 gap-3 px-3 py-2 text-[11px] font-medium text-muted-foreground'>
                            <div className='col-span-4'>Batch No.</div>
                            <div className='col-span-3'>Expiry</div>
                            <div className='col-span-2'>Qty</div>
                            <div className='col-span-1 text-right'>Rate</div>
                            <div className='col-span-2 text-right'>Amount</div>
                          </div>
                          {batches.map((b: any) => (
                            <div
                              key={b.id}
                              className='grid grid-cols-12 gap-3 px-3 py-2 border-t text-xs'
                            >
                              <div className='col-span-4 font-medium'>
                                {b.batchNumber || '-'}
                              </div>
                              <div className='col-span-3'>{b.expiryDate || '-'}</div>
                              <div className='col-span-2'>{fmtINR0to2.format(n(b.qty || 0))}</div>
                              <div className='col-span-1 text-right'>
                                {fmtINR2.format(n(b.unitRate || 0))}
                              </div>
                              <div className='col-span-2 text-right'>
                                {fmtINR2.format(n(b.amount || 0))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
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
