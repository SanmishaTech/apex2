'use client';

import useSWR from 'swr';
import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { AppButton, AppCard } from '@/components/common';
import { DataTable, Column } from '@/components/common/data-table';
import { apiGet } from '@/lib/api-client';
import { toast } from '@/lib/toast';

interface ReportRowDayCell { date: string; received: number; issued: number }
interface ReportRow {
  itemId: number;
  item: string;
  unit: string | null;
  opening: number;
  perDay: ReportRowDayCell[];
  closing: number;
}
interface ReportResponse {
  site: { id: number; site: string };
  days: string[]; // ISO date strings (yyyy-mm-dd)
  rows: ReportRow[];
}

function formatYMDLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function ViewStockReportPage() {
  const params = useParams();
  const id = Number(params?.id);

  const { defaultFrom, defaultTo } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const from = new Date(today);
    from.setDate(today.getDate() - 6);
    return { defaultFrom: formatYMDLocal(from), defaultTo: formatYMDLocal(today) };
  }, []);

  const [fromDate, setFromDate] = useState<string>(defaultFrom);
  const [toDate, setToDate] = useState<string>(defaultTo);

  const reportUrl = useMemo(() => {
    if (!Number.isFinite(id)) return null;
    const from = (fromDate || '').trim();
    const to = (toDate || '').trim();
    const qs = new URLSearchParams();
    if (from) qs.set('fromDate', from);
    if (to) qs.set('toDate', to);
    const q = qs.toString();
    return q ? `/api/stocks/sites/${id}?${q}` : `/api/stocks/sites/${id}`;
  }, [id, fromDate, toDate]);

  const { data, error, isLoading } = useSWR<ReportResponse>(
    reportUrl,
    apiGet
  );

  if (error) toast.error((error as Error).message || 'Failed to load stock report');

  const columns: Column<ReportRow>[] = useMemo(() => {
    const base: Column<ReportRow>[] = [
      { key: 'item', header: 'Item', accessor: (r) => r.item, className: 'whitespace-nowrap' },
      { key: 'unit', header: 'Unit', accessor: (r) => r.unit || '-', className: 'whitespace-nowrap' },
      {
        key: 'opening',
        header: 'Opening Stock',
        accessor: (r) => Number(r.opening).toFixed(2),
        className: 'whitespace-nowrap text-right border-l border-border',
        cellClassName: 'whitespace-nowrap text-right border-l border-border',
      },
    ];
    const dayCols: Column<ReportRow>[] = (data?.days || []).map((d, idx) => ({
      key: `day_${d}`,
      header: new Date(d).toLocaleDateString('en-GB'),
      className: 'whitespace-nowrap text-center border-l border-border',
      cellClassName: 'whitespace-nowrap text-center border-l border-border',
      accessor: (r: ReportRow) => (
        <div className='text-xs leading-tight'>
          <div>Rec: {Number(r.perDay[idx]?.received || 0).toFixed(2)}</div>
          <div>Iss: {Number(r.perDay[idx]?.issued || 0).toFixed(2)}</div>
        </div>
      ),
    }));
    const tail: Column<ReportRow>[] = [
      {
        key: 'closing',
        header: 'Closing Stock',
        accessor: (r) => Number(r.closing).toFixed(2),
        className: 'whitespace-nowrap text-right border-l border-border',
        cellClassName: 'whitespace-nowrap text-right border-l border-border',
      },
    ];
    return [...base, ...dayCols, ...tail];
  }, [data?.days]);

  return (
    <AppCard>
      <AppCard.Header>
        <AppCard.Title>
          Stock Report for {data?.site?.site || ''}
        </AppCard.Title>
        <AppCard.Description>
          <div className='flex flex-col gap-2 md:flex-row md:items-end'>
            <div className='flex flex-col gap-1'>
              <div className='text-xs font-medium'>From Date</div>
              <input
                type='date'
                className='h-9 rounded-md border bg-background px-3 text-sm'
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div className='flex flex-col gap-1'>
              <div className='text-xs font-medium'>To Date</div>
              <input
                type='date'
                className='h-9 rounded-md border bg-background px-3 text-sm'
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
          </div>
        </AppCard.Description>
      </AppCard.Header>
      <AppCard.Content>
        <DataTable
          data={data?.rows || []}
          columns={columns}
          loading={isLoading}
          emptyMessage='No stock movements found'
          stickyColumns={2}
        />
      </AppCard.Content>
    </AppCard>
  );
}
