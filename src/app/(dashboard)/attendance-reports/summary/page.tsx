'use client';

import { useState, useMemo, useEffect, Fragment } from 'react';
import useSWR from 'swr';
import { AppCard } from '@/components/common/app-card';
import { AppButton } from '@/components/common/app-button';
import { usePageAccess } from '@/hooks/use-page-access';
import { apiGet } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import {
  ManpowerAttendanceSummaryResponse,
  SiteOption,
  CategoryOption,
  SkillSetOption,
  ExportFormat,
} from '@/types/attendance-reports';
import { NonFormMultiSelect } from '@/components/common/non-form-multi-select';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function ManpowerAttendanceSummaryPage() {
  usePageAccess();

  // Filters
  const [selectedSiteIds, setSelectedSiteIds] = useState<number[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedSkillSet, setSelectedSkillSet] = useState<string>('');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('excel');

  // Initialize current month
  useEffect(() => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    setSelectedMonth(currentMonth);
  }, []);

  // Dropdown data
  const { data: sitesData } = useSWR<{ data: SiteOption[] }>(
    '/api/sites?perPage=1000',
    apiGet
  );
  const { data: categoriesData } = useSWR<{ data: CategoryOption[] }>(
    '/api/categories?perPage=1000',
    apiGet
  );
  const { data: skillSetsData } = useSWR<{ data: SkillSetOption[] }>(
    '/api/skill-sets?perPage=1000',
    apiGet
  );

  const sites = sitesData?.data;
  const categories = categoriesData?.data;
  const skillSets = skillSetsData?.data;

  // Build summary query
  const reportQuery = useMemo(() => {
    if (selectedSiteIds.length === 0 || !selectedMonth) return null;
    const params = new URLSearchParams();
    params.set('siteIds', selectedSiteIds.join(','));
    params.set('month', selectedMonth);
    if (selectedCategory) params.set('category', selectedCategory);
    if (selectedSkillSet) params.set('skillSet', selectedSkillSet);
    return `/api/attendance-reports/summary?${params.toString()}`;
  }, [selectedSiteIds, selectedMonth, selectedCategory, selectedSkillSet]);

  const { data: reportData, error, isLoading } = useSWR<ManpowerAttendanceSummaryResponse>(
    reportQuery,
    apiGet
  );

  if (error) {
    toast.error((error as Error).message || 'Failed to load summary report');
  }

  const handleExport = () => {
    if (!reportData || reportData.data.length === 0) {
      toast.error('No data to export');
      return;
    }
    if (exportFormat === 'excel') exportToExcel(reportData);
    else exportToPDF(reportData);
  };

  const exportToExcel = (data: ManpowerAttendanceSummaryResponse) => {
    try {
      let csv = 'Manpower Attendance Summary\n\n';
      csv += `Month: ${data.filters.month}\n`;
      csv += `Sites: ${selectedSiteIds
        .map((id) => sites?.find((s) => s.id === id)?.site || id)
        .join(', ')}\n`;
      if (data.filters.category) csv += `Category: ${data.filters.category}\n`;
      if (data.filters.skillSet) csv += `Skill Set: ${data.filters.skillSet}\n`;
      csv += '\n';

      // Header
      csv += 'Sr. No.,Manpower,Supplier,Category,Skill Set,Site,Present,Absent,Total OT,Idle\n';

      let serial = 1;
      data.data.forEach((siteGroup) => {
        // Site header
        csv += `\n"Site: ${siteGroup.siteName}"\n`;

        siteGroup.manpowerSummaries.forEach((r) => {
          csv += `${serial},"${r.manpowerName}","${r.supplierName}","${r.category || 'N/A'}","${
            r.skillSet || 'N/A'
          }","${r.siteName}",${r.totalPresent},${r.totalAbsent},${r.totalOT},${r.totalIdle}\n`;
          serial++;
        });

        // Site totals
        csv += `"Site Total (${siteGroup.manpowerSummaries.length} manpower)",,,,,,${siteGroup.siteTotals.totalPresent},${siteGroup.siteTotals.totalAbsent},${siteGroup.siteTotals.totalOT},${siteGroup.siteTotals.totalIdle}\n`;
      });

      // Grand total
      csv += `\n"GRAND TOTAL (${data.grandTotals.totalManpower} manpower)",,,,,,${data.grandTotals.totalPresent},${data.grandTotals.totalAbsent},${data.grandTotals.totalOT},${data.grandTotals.totalIdle}\n`;

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `manpower_attendance_summary_${data.filters.month}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('Summary exported successfully');
    } catch (e) {
      console.error('Export error:', e);
      toast.error('Failed to export summary');
    }
  };

  const exportToPDF = (data: ManpowerAttendanceSummaryResponse) => {
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      doc.setFontSize(16);
      doc.text('Manpower Attendance Summary', 14, 15);

      doc.setFontSize(10);
      doc.text(`Month: ${data.filters.month}`, 14, 22);
      const sitesLine = `Sites: ${selectedSiteIds
        .map((id) => sites?.find((s) => s.id === id)?.site || id)
        .join(', ')}`;
      const wrappedSites = doc.splitTextToSize(sitesLine, 260);
      doc.text(wrappedSites as unknown as string[], 14, 27);
      let cursorY = 27 + ((wrappedSites as unknown as string[]).length - 1) * 4 + 5;
      if (data.filters.category) {
        doc.text(`Category: ${data.filters.category}`, 14, cursorY);
        cursorY += 5;
      }
      if (data.filters.skillSet) {
        doc.text(`Skill Set: ${data.filters.skillSet}`, 14, cursorY);
        cursorY += 5;
      }

      const baseStartY = cursorY + 3;
      let startY = baseStartY;

      data.data.forEach((siteGroup, idx) => {
        if (idx === 0) {
          // Add a bit more space after the report header
          startY = baseStartY + 8;
        } else {
          const prev: any = (doc as any).lastAutoTable;
          if (prev && prev.finalY) startY = prev.finalY + 10;
        }

        doc.setFontSize(11);
        // Draw site label a bit above the table
        doc.text(`Site: ${siteGroup.siteName}`, 14, startY);

        const body = siteGroup.manpowerSummaries.map((r, i) => [
          i + 1,
          r.manpowerName,
          r.supplierName,
          r.category || 'N/A',
          r.skillSet || 'N/A',
          r.siteName,
          r.totalPresent,
          r.totalAbsent,
          r.totalOT,
          r.totalIdle,
        ]);

        // Site totals row
        body.push([
          '',
          'Site Total',
          '',
          '',
          '',
          '',
          siteGroup.siteTotals.totalPresent,
          siteGroup.siteTotals.totalAbsent,
          siteGroup.siteTotals.totalOT,
          siteGroup.siteTotals.totalIdle,
        ]);

        autoTable(doc, {
          head: [[
            'Sr.',
            'Manpower',
            'Supplier',
            'Category',
            'Skill Set',
            'Site',
            'Present',
            'Absent',
            'Total OT',
            'Idle',
          ]],
          body,
          startY: startY + 4,
          styles: { fontSize: 7, cellPadding: 1.5 },
          headStyles: { fillColor: [66, 139, 202], fontSize: 7 },
          columnStyles: {
            0: { cellWidth: 8 },
            1: { cellWidth: 40 },
            2: { cellWidth: 28 },
            3: { cellWidth: 20 },
            4: { cellWidth: 20 },
            5: { cellWidth: 28 },
          },
          didParseCell: (hookData: any) => {
            if (hookData.section === 'body' && hookData.row.index === body.length - 1) {
              hookData.cell.styles.fontStyle = 'bold';
              hookData.cell.styles.fillColor = [245, 245, 245];
            }
          },
        });
      });

      const prev: any = (doc as any).lastAutoTable;
      let y = prev && prev.finalY ? prev.finalY + 8 : startY + 8;
      doc.setFontSize(11);
      doc.text('Grand Totals', 14, y);
      y += 5;
      doc.setFontSize(9);
      doc.text(`Manpower: ${data.grandTotals.totalManpower}`, 14, y);
      doc.text(`Present: ${data.grandTotals.totalPresent}`, 60, y);
      doc.text(`Absent: ${data.grandTotals.totalAbsent}`, 110, y);
      doc.text(`Total OT: ${data.grandTotals.totalOT}`, 160, y);
      doc.text(`Idle: ${data.grandTotals.totalIdle}`, 200, y);

      doc.save(`manpower_attendance_summary_${data.filters.month}.pdf`);
      toast.success('PDF exported successfully');
    } catch (e) {
      console.error('PDF export error:', e);
      toast.error('Failed to export PDF');
    }
  };

  return (
    <AppCard>
      <AppCard.Header>
        <AppCard.Title>Manpower Attendance Summary</AppCard.Title>
        <AppCard.Description>
          Monthly totals of manpower attendance grouped by site.
        </AppCard.Description>
      </AppCard.Header>

      <AppCard.Content>
        {/* Filters */}
        <div className='space-y-6 mb-6'>
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
            {/* Month */}
            <div>
              <label className='block text-sm font-medium text-foreground mb-2'>
                Period (Month) <span className='text-red-500'>*</span>
              </label>
              <input
                type='month'
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className='w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:ring-ring focus:border-ring'
                required
              />
            </div>

            {/* Category */}
            <div>
              <label className='block text-sm font-medium text-foreground mb-2'>
                Category (Optional)
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className='w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:ring-ring focus:border-ring'
              >
                <option value=''>All Categories</option>
                {categories?.map((cat) => (
                  <option key={cat.id} value={cat.categoryName}>
                    {cat.categoryName}
                  </option>
                ))}
              </select>
            </div>

            {/* Skill Set */}
            <div>
              <label className='block text-sm font-medium text-foreground mb-2'>
                Skill Set (Optional)
              </label>
              <select
                value={selectedSkillSet}
                onChange={(e) => setSelectedSkillSet(e.target.value)}
                className='w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:ring-ring focus:border-ring'
              >
                <option value=''>All Skill Sets</option>
                {skillSets?.map((s) => (
                  <option key={s.id} value={s.skillsetName}>
                    {s.skillsetName}
                  </option>
                ))}
              </select>
            </div>

            {/* Export Format */}
            <div>
              <label className='block text-sm font-medium text-foreground mb-2'>
                Export Format
              </label>
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
                className='w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:ring-ring focus:border-ring'
              >
                <option value='excel'>Excel (CSV)</option>
                <option value='pdf'>PDF</option>
              </select>
            </div>
          </div>

          {/* Site Multi-Select */}
          <div>
            <NonFormMultiSelect
              label='Select Sites'
              required
              placeholder='Select one or more sites...'
              options={
                sites?.map((site) => ({
                  value: site.id,
                  label: site.shortName ? `${site.site} (${site.shortName})` : site.site,
                })) || []
              }
              value={selectedSiteIds}
              onChange={(values) => setSelectedSiteIds(values.map(Number))}
            />
          </div>

          {/* Export Button */}
          <div className='flex justify-end'>
            <AppButton onClick={handleExport} disabled={!reportData || isLoading} iconName='Download'>
              Export Summary
            </AppButton>
          </div>
        </div>

        {/* Content */}
        {isLoading && (
          <div className='p-6 text-center text-muted-foreground'>Loading summary...</div>
        )}

        {!isLoading && (!reportData || reportData.data.length === 0) && (
          <div className='p-6 text-center text-muted-foreground'>No data found for the selected filters</div>
        )}

        {!isLoading && reportData && reportData.data.length > 0 && (
          <div className='overflow-x-auto'>
            <div className='mb-4 p-4 bg-muted/30 rounded-md'>
              <h3 className='font-semibold text-foreground mb-2'>Report Summary</h3>
              <div className='grid grid-cols-2 md:grid-cols-4 gap-4 text-sm'>
                <div>
                  <span className='text-muted-foreground'>Total Records:</span>{' '}
                  <span className='font-medium text-foreground'>{reportData.totalRecords}</span>
                </div>
                <div>
                  <span className='text-muted-foreground'>Month:</span>{' '}
                  <span className='font-medium text-foreground'>{reportData.filters.month}</span>
                </div>
                <div>
                  <span className='text-muted-foreground'>Sites:</span>{' '}
                  <span className='font-medium text-foreground'>{selectedSiteIds.length}</span>
                </div>
                <div>
                  <span className='text-muted-foreground'>Grand Present:</span>{' '}
                  <span className='font-medium text-foreground'>{reportData.grandTotals.totalPresent}</span>
                </div>
              </div>
            </div>

            <table className='min-w-full divide-y divide-border'>
              <thead className='bg-muted/50 sticky top-0'>
                <tr>
                  <th className='px-3 py-3 text-left text-xs font-medium text-foreground uppercase tracking-wider border-r border-border'>
                    Sr.
                  </th>
                  <th className='px-3 py-3 text-left text-xs font-medium text-foreground uppercase tracking-wider border-r border-border min-w-[160px]'>
                    Manpower
                  </th>
                  <th className='px-3 py-3 text-left text-xs font-medium text-foreground uppercase tracking-wider border-r border-border min-w-[120px]'>
                    Supplier
                  </th>
                  <th className='px-3 py-3 text-left text-xs font-medium text-foreground uppercase tracking-wider border-r border-border'>
                    Category
                  </th>
                  <th className='px-3 py-3 text-left text-xs font-medium text-foreground uppercase tracking-wider border-r border-border'>
                    Skill Set
                  </th>
                  <th className='px-3 py-3 text-left text-xs font-medium text-foreground uppercase tracking-wider border-r border-border min-w-[120px]'>
                    Site
                  </th>
                  <th className='px-3 py-3 text-center text-xs font-medium text-foreground uppercase tracking-wider border-r border-border bg-blue-50 dark:bg-blue-950/30'>
                    Present
                  </th>
                  <th className='px-3 py-3 text-center text-xs font-medium text-foreground uppercase tracking-wider border-r border-border bg-red-50 dark:bg-red-950/30'>
                    Absent
                  </th>
                  <th className='px-3 py-3 text-center text-xs font-medium text-foreground uppercase tracking-wider border-r border-border bg-green-50 dark:bg-green-950/30'>
                    Total OT
                  </th>
                  <th className='px-3 py-3 text-center text-xs font-medium text-foreground uppercase tracking-wider bg-orange-50 dark:bg-orange-950/30'>
                    Idle
                  </th>
                </tr>
              </thead>
              <tbody className='bg-background divide-y divide-border'>
                {reportData.data.map((siteGroup, sgIndex) => (
                  <Fragment key={`sg-${siteGroup.siteId}`}>
                    {/* Site header */}
                    <tr className='bg-muted/50'>
                      <td colSpan={10} className='px-3 py-2 text-sm font-semibold text-foreground'>
                        Site: {siteGroup.siteName} — Present: {siteGroup.siteTotals.totalPresent}, Absent: {siteGroup.siteTotals.totalAbsent}, OT: {siteGroup.siteTotals.totalOT}, Idle: {siteGroup.siteTotals.totalIdle}
                      </td>
                    </tr>

                    {siteGroup.manpowerSummaries.map((r, idx) => {
                      const serial = reportData.data
                        .slice(0, sgIndex)
                        .reduce((sum, g) => sum + g.manpowerSummaries.length, 0) + (idx + 1);
                      return (
                        <tr key={r.manpowerId} className='hover:bg-muted/30'>
                          <td className='px-3 py-2 text-sm text-foreground border-r border-border'>{serial}</td>
                          <td className='px-3 py-2 text-sm text-foreground border-r border-border font-medium'>{r.manpowerName}</td>
                          <td className='px-3 py-2 text-sm text-muted-foreground border-r border-border'>{r.supplierName}</td>
                          <td className='px-3 py-2 text-sm text-muted-foreground border-r border-border'>{r.category || '-'}</td>
                          <td className='px-3 py-2 text-sm text-muted-foreground border-r border-border'>{r.skillSet || '-'}</td>
                          <td className='px-3 py-2 text-sm text-muted-foreground border-r border-border'>{r.siteName}</td>
                          <td className='px-3 py-2 text-sm text-center font-semibold text-blue-600 dark:text-blue-400 border-r border-border bg-blue-50 dark:bg-blue-950/20'>{r.totalPresent}</td>
                          <td className='px-3 py-2 text-sm text-center font-semibold text-red-600 dark:text-red-400 border-r border-border bg-red-50 dark:bg-red-950/20'>{r.totalAbsent}</td>
                          <td className='px-3 py-2 text-sm text-center font-semibold text-green-600 dark:text-green-400 border-r border-border bg-green-50 dark:bg-green-950/20'>{r.totalOT}</td>
                          <td className='px-3 py-2 text-sm text-center font-semibold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/20'>{r.totalIdle}</td>
                        </tr>
                      );
                    })}

                    {/* Site totals */}
                    <tr className='bg-muted/30'>
                      <td className='px-3 py-2 text-sm text-muted-foreground border-r border-border' colSpan={6}>
                        Site Total ({siteGroup.manpowerSummaries.length} manpower)
                      </td>
                      <td className='px-3 py-2 text-sm text-center font-semibold text-blue-600 dark:text-blue-400 border-r border-border bg-blue-50 dark:bg-blue-950/20'>
                        {siteGroup.siteTotals.totalPresent}
                      </td>
                      <td className='px-3 py-2 text-sm text-center font-semibold text-red-600 dark:text-red-400 border-r border-border bg-red-50 dark:bg-red-950/20'>
                        {siteGroup.siteTotals.totalAbsent}
                      </td>
                      <td className='px-3 py-2 text-sm text-center font-semibold text-green-600 dark:text-green-400 border-r border-border bg-green-50 dark:bg-green-950/20'>
                        {siteGroup.siteTotals.totalOT}
                      </td>
                      <td className='px-3 py-2 text-sm text-center font-semibold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/20'>
                        {siteGroup.siteTotals.totalIdle}
                      </td>
                    </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AppCard.Content>
    </AppCard>
  );
}
