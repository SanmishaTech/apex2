'use client';

import useSWR from 'swr';
import { useMemo } from 'react';
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

export default function ViewStockReportPage() {
  const params = useParams();
  const id = Number(params?.id);

  const { data, error, isLoading } = useSWR<ReportResponse>(
    Number.isFinite(id) ? `/api/stocks/sites/${id}` : null,
    apiGet
  );

  if (error) toast.error((error as Error).message || 'Failed to load stock report');

  const columns: Column<ReportRow>[] = useMemo(() => {
    const base: Column<ReportRow>[] = [
      { key: 'item', header: 'Item', accessor: (r) => r.item, className: 'whitespace-nowrap' },
      { key: 'unit', header: 'Unit', accessor: (r) => r.unit || '-', className: 'whitespace-nowrap' },
      { key: 'opening', header: 'Opening Stock', accessor: (r) => Number(r.opening).toFixed(4), className: 'whitespace-nowrap text-right' },
    ];
    const dayCols: Column<ReportRow>[] = (data?.days || []).map((d, idx) => ({
      key: `day_${d}`,
      header: new Date(d).toLocaleDateString('en-GB'),
      className: 'whitespace-nowrap text-center',
      accessor: (r: ReportRow) => (
        <div className='text-xs leading-tight'>
          <div>Rec: {Number(r.perDay[idx]?.received || 0).toFixed(4)}</div>
          <div>Iss: {Number(r.perDay[idx]?.issued || 0).toFixed(4)}</div>
        </div>
      ),
    }));
    const tail: Column<ReportRow>[] = [
      { key: 'closing', header: 'Closing Stock', accessor: (r) => Number(r.closing).toFixed(4), className: 'whitespace-nowrap text-right' },
    ];
    return [...base, ...dayCols, ...tail];
  }, [data?.days]);

  return (
    <AppCard>
      <AppCard.Header>
        <AppCard.Title>
          Previous 7 Days Stock Report for {data?.site?.site || ''}
        </AppCard.Title>
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
