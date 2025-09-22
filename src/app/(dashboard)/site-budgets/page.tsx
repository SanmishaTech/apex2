'use client';

import useSWR from 'swr';
import { useMemo, useState, useEffect } from 'react';
import { apiGet } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { Pagination } from '@/components/common/pagination';
import { NonFormTextInput } from '@/components/common/non-form-text-input';
import { FilterBar } from '@/components/common';
import { AppCard } from '@/components/common/app-card';
import { AppButton } from '@/components/common/app-button';
import { DataTable, SortState, Column } from '@/components/common/data-table';
import { usePermissions } from '@/hooks/use-permissions';
import { PERMISSIONS } from '@/config/roles';
import { formatDate } from '@/lib/locales';
import { useQueryParamsState } from '@/hooks/use-query-params-state';
import Link from 'next/link';

// Types
type SiteListItem = {
  id: number;
  site: string;
  shortName: string | null;
  company?: {
    id: number;
    company: string;
  } | null;
  _count?: {
    siteBudgets: number;
  };
  createdAt: string;
  updatedAt: string;
};

type SitesResponse = {
  data: SiteListItem[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
};

export default function SiteBudgetsPage() {
  const [qp, setQp] = useQueryParamsState({
    page: 1,
    perPage: 10,
    search: '',
    sort: 'site',
    order: 'asc',
  });
  const { page, perPage, search, sort, order } =
    qp as unknown as {
      page: number;
      perPage: number;
      search: string;
      sort: string;
      order: 'asc' | 'desc';
    };

  // Local filter draft state (only applied when clicking Filter)
  const [searchDraft, setSearchDraft] = useState(search);

  // Sync drafts when query params change externally (e.g., back navigation)
  useEffect(() => {
    setSearchDraft(search);
  }, [search]);

  const filtersDirty = searchDraft !== search;

  function applyFilters() {
    setQp({
      page: 1,
      search: searchDraft.trim(),
    });
  }

  function resetFilters() {
    setSearchDraft('');
    setQp({ page: 1, search: '' });
  }

  const query = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set('page', String(page));
    sp.set('perPage', String(perPage));
    if (search) sp.set('search', search);
    if (sort) sp.set('sort', sort);
    if (order) sp.set('order', order);
    return `/api/sites?${sp.toString()}`;
  }, [page, perPage, search, sort, order]);

  const { data, error, isLoading } = useSWR<SitesResponse>(query, apiGet);

  const { can } = usePermissions();

  if (error) {
    toast.error((error as Error).message || 'Failed to load sites');
  }

  function toggleSort(field: string) {
    if (sort === field) {
      setQp({ order: order === 'asc' ? 'desc' : 'asc' });
    } else {
      setQp({ sort: field, order: 'asc' });
    }
  }

  const columns: Column<SiteListItem>[] = [
    {
      key: 'site',
      header: 'Site',
      sortable: true,
      cellClassName: 'font-medium whitespace-nowrap',
    },
    {
      key: '_count',
      header: 'No Of Items',
      sortable: false,
      className: 'text-center',
      cellClassName: 'text-center font-medium',
      accessor: (r) => r._count?.siteBudgets || 0,
    },
  ];

  const sortState: SortState = { field: sort, order };

  const handleDownloadPDF = async (siteId: number, siteName: string) => {
    try {
      // Fetch the site budget data
      const response = await fetch(`/api/site-budgets?siteId=${siteId}&perPage=1000`);
      const budgetData = await response.json();
      
      // Fetch site details
      const siteResponse = await fetch(`/api/sites/${siteId}`);
      const site = await siteResponse.json();
      
      if (!budgetData.data || budgetData.data.length === 0) {
        toast.error('No budget data found for this site');
        return;
      }

      // Create and trigger download
      const printWindow = window.open('', '_blank', 'width=800,height=600');
      if (!printWindow) {
        toast.error('Please allow popups to download PDF');
        return;
      }

      // Calculate totals
      const totalBudgetValue = budgetData.data.reduce((sum: number, item: any) => sum + Number(item.budgetValue), 0);
      const totalOrderedValue = budgetData.data.reduce((sum: number, item: any) => sum + Number(item.orderedValue), 0);

      const currentDate = new Date();
      const formattedDate = currentDate.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
      const formattedTime = currentDate.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit'
      });

      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Site Budget Report - ${site.site}</title>
    <style>
        @page { size: A4; margin: 15mm; }
        body { font-family: Arial, sans-serif; margin: 0; padding: 0; font-size: 11px; line-height: 1.2; }
        .header-section { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px; border: 2px solid #000; padding: 8px; }
        .company-info { flex: 1; }
        .company-name { font-size: 13px; font-weight: bold; margin-bottom: 3px; }
        .report-subtitle { font-size: 11px; }
        .report-title { flex: 1; text-align: right; font-size: 16px; font-weight: bold; }
        .site-info { margin: 8px 0 15px 0; font-weight: bold; font-size: 12px; }
        .report-table { width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 15px; }
        .report-table th, .report-table td { border: 1px solid #000; padding: 4px 3px; text-align: center; vertical-align: middle; }
        .report-table th { background-color: #f5f5f5; font-weight: bold; font-size: 9px; }
        .text-left { text-align: left !important; }
        .text-right { text-align: right !important; }
        .total-row { font-weight: bold; background-color: #f9f9f9; }
        .grand-total-row { font-weight: bold; background-color: #e9e9e9; }
        .footer-info { display: flex; justify-content: space-between; margin-top: 20px; font-size: 9px; }
    </style>
</head>
<body>
    <div class="header-section">
        <div class="company-info">
            <div class="company-name">${site.company?.companyName || 'ABCD COMPANY LTD'}</div>
            <div class="report-subtitle">Report: Budget View</div>
        </div>
        <div class="report-title">APEX Constructions</div>
    </div>
    <div class="site-info">Site: ${site.site}</div>
    <table class="report-table">
        <thead>
            <tr>
                <th style="width: 25%">Item</th>
                <th style="width: 8%">Unit</th>
                <th style="width: 10%">Budget Qty</th>
                <th style="width: 12%">Budget Rate</th>
                <th style="width: 12%">Budget Value</th>
                <th style="width: 10%">Ordered Qty</th>
                <th style="width: 11%">Avg Rate</th>
                <th style="width: 12%">Ordered Value</th>
            </tr>
        </thead>
        <tbody>
            ${budgetData.data.map((item: any) => `
                <tr>
                    <td class="text-left">${item.item.item}</td>
                    <td>${item.item.unit?.unitName || '-'}</td>
                    <td class="text-right">${Number(item.budgetQty).toFixed(2)}</td>
                    <td class="text-right">${Number(item.budgetRate).toFixed(2)}</td>
                    <td class="text-right">${Number(item.budgetValue).toFixed(2)}</td>
                    <td class="text-right">${Number(item.orderedQty).toFixed(2)}</td>
                    <td class="text-right">${Number(item.avgRate).toFixed(2)}</td>
                    <td class="text-right">${Number(item.orderedValue).toFixed(2)}</td>
                </tr>
            `).join('')}
            <tr class="total-row">
                <td colspan="4" class="text-right">Total</td>
                <td class="text-right">${totalBudgetValue.toFixed(2)}</td>
                <td></td>
                <td></td>
                <td class="text-right">${totalOrderedValue.toFixed(2)}</td>
            </tr>
            <tr class="grand-total-row">
                <td colspan="4" class="text-right">Grand Total</td>
                <td class="text-right">${totalBudgetValue.toFixed(2)}</td>
                <td></td>
                <td></td>
                <td class="text-right">${totalOrderedValue.toFixed(2)}</td>
            </tr>
        </tbody>
    </table>
    <div class="footer-info">
        <div>APEX</div>
        <div>Printed on ${formattedDate} ${formattedTime}</div>
        <div>1/1</div>
    </div>
    <script>
        window.onload = function() {
            window.print();
            setTimeout(() => window.close(), 1000);
        }
    </script>
</body>
</html>`;

      printWindow.document.write(htmlContent);
      printWindow.document.close();
      
      toast.success('PDF download initiated');
    } catch (error) {
      console.error('PDF download error:', error);
      toast.error('Failed to download PDF');
    }
  };

  return (
    <AppCard>
      <AppCard.Header>
        <AppCard.Title>Site Budget</AppCard.Title>
        <AppCard.Description>Manage site budgets by selecting a site.</AppCard.Description>
      </AppCard.Header>
      <AppCard.Content>
        <FilterBar title='Search & Filter'>
          <NonFormTextInput
            aria-label='Search sites'
            placeholder='Search sites...'
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            containerClassName='w-full'
          />
          <AppButton
            size='sm'
            onClick={applyFilters}
            disabled={!filtersDirty && !searchDraft}
            className='min-w-[84px]'
          >
            Filter
          </AppButton>
          {search && (
            <AppButton
              variant='secondary'
              size='sm'
              onClick={resetFilters}
              className='min-w-[84px]'
            >
              Reset
            </AppButton>
          )}
        </FilterBar>
        <DataTable
          columns={columns}
          data={data?.data || []}
          loading={isLoading}
          sort={sortState}
          onSortChange={(s) => toggleSort(s.field)}
          stickyColumns={1}
          renderRowActions={(row) => {
            if (!can(PERMISSIONS.READ_SITE_BUDGETS)) return null;
            return (
              <div className='flex gap-2'>
                {can(PERMISSIONS.READ_SITE_BUDGETS) && (
                  <AppButton 
                    size='sm' 
                    variant='secondary' 
                    iconName='Download'
                    onClick={() => handleDownloadPDF(row.id, row.site)}
                  >
                    View Budget
                  </AppButton>
                )}
                {can(PERMISSIONS.CREATE_SITE_BUDGETS) && (
                  <Link href={`/site-budgets/${row.id}/manage`}>
                    <AppButton size='sm' iconName='Plus' className='ml-2'>
                      Add Budget
                    </AppButton>
                  </Link>
                )}
              </div>
            );
          }}
        />
      </AppCard.Content>
      <AppCard.Footer className='justify-end'>
        <Pagination
          page={data?.page || page}
          totalPages={data?.totalPages || 1}
          total={data?.total}
          perPage={perPage}
          onPerPageChange={(val) => setQp({ page: 1, perPage: val })}
          onPageChange={(p) => setQp({ page: p })}
          showPageNumbers
          maxButtons={5}
          disabled={isLoading}
        />
      </AppCard.Footer>
    </AppCard>
  );
}
