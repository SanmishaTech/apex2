'use client';

import { useState, useMemo, useEffect, Fragment } from 'react';
import useSWR from 'swr';
import { AppCard } from '@/components/common/app-card';
import { AppButton } from '@/components/common/app-button';
import { usePageAccess } from '@/hooks/use-page-access';
import { apiGet } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import {
  AttendanceReportResponse,
  SiteOption,
  CategoryOption,
  SkillSetOption,
  ExportFormat,
} from '@/types/attendance-reports';
// Removed unused lucide-react icon imports
import { NonFormMultiSelect } from '@/components/common/non-form-multi-select';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function AttendanceReportsPage() {
  usePageAccess();

  // Filter state
  const [selectedSiteIds, setSelectedSiteIds] = useState<number[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedSkillSet, setSelectedSkillSet] = useState<string>('');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('excel');

  // Initialize with current month
  useEffect(() => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    setSelectedMonth(currentMonth);
  }, []);

  // Fetch dropdown data
  const { data: sitesData } = useSWR<{ data: SiteOption[] }>('/api/sites?perPage=1000', apiGet);
  const { data: categoriesData } = useSWR<{ data: CategoryOption[] }>('/api/categories?perPage=1000', apiGet);
  const { data: skillSetsData } = useSWR<{ data: SkillSetOption[] }>('/api/skill-sets?perPage=1000', apiGet);

  const sites = sitesData?.data;
  const categories = categoriesData?.data;
  const skillSets = skillSetsData?.data;

  // Build query for report
  const reportQuery = useMemo(() => {
    if (selectedSiteIds.length === 0 || !selectedMonth) return null;

    const params = new URLSearchParams();
    params.set('siteIds', selectedSiteIds.join(','));
    params.set('month', selectedMonth);
    if (selectedCategory) params.set('category', selectedCategory);
    if (selectedSkillSet) params.set('skillSet', selectedSkillSet);

    return `/api/attendance-reports?${params.toString()}`;
  }, [selectedSiteIds, selectedMonth, selectedCategory, selectedSkillSet]);

  const { data: reportData, error, isLoading } = useSWR<AttendanceReportResponse>(
    reportQuery,
    apiGet
  );

  if (error) {
    toast.error((error as Error).message || 'Failed to load attendance report');
  }

  const handleSiteToggle = (siteId: number) => {
    setSelectedSiteIds((prev) =>
      prev.includes(siteId) ? prev.filter((id) => id !== siteId) : [...prev, siteId]
    );
  };

  const handleSelectAllSites = () => {
    if (sites) {
      setSelectedSiteIds(sites.map((s) => s.id));
    }
  };

  const handleClearSites = () => {
    setSelectedSiteIds([]);
  };

  const handleExport = () => {
    if (!reportData || reportData.data.length === 0) {
      toast.error('No data to export');
      return;
    }

    if (exportFormat === 'excel') {
      exportToExcel(reportData);
    } else {
      exportToPDF(reportData);
    }
  };

  const exportToExcel = (data: AttendanceReportResponse) => {
    try {
      // Get days in month
      const [year, month] = data.filters.month.split('-').map(Number);
      const daysInMonth = new Date(year, month, 0).getDate();

      // Create CSV content
      let csv = 'Attendance Report\n\n';
      csv += `Month: ${data.filters.month}\n`;
      csv += `Sites: ${selectedSiteIds.map((id) => sites?.find((s) => s.id === id)?.site || id).join(', ')}\n`;
      if (data.filters.category) csv += `Category: ${data.filters.category}\n`;
      if (data.filters.skillSet) csv += `Skill Set: ${data.filters.skillSet}\n`;
      csv += '\n';

      // Header row
      csv += 'Sr. No.,Manpower Name,Supplier,Category,Skill Set,Site,';
      for (let day = 1; day <= daysInMonth; day++) {
        csv += `Day ${day},OT ${day},`;
      }
      csv += 'Total Present,Total Absent,Total OT,Total Idle\n';

      // Data rows grouped by site
      let serialNo = 1;
      data.data.forEach((siteGroup) => {
        // Site header row
        csv += `\n"Site: ${siteGroup.siteName}"\n`;
        
        siteGroup.manpowerRecords.forEach((record) => {
          csv += `${serialNo},"${record.manpowerName}","${record.supplierName}","${record.category || 'N/A'}","${record.skillSet || 'N/A'}","${record.siteName}",`;
          
          // Create a map of attendance by date for quick lookup
          const attendanceByDate = new Map(
            record.dailyAttendance.map((att) => [new Date(att.date).getDate(), att])
          );

          // Fill in all days of the month
          for (let day = 1; day <= daysInMonth; day++) {
            const att = attendanceByDate.get(day);
            if (att) {
              csv += `${att.isPresent ? 'P' : 'A'},${att.isPresent && att.ot > 0 ? att.ot : ''},`;
            } else {
              csv += '-,,'; // No attendance record for this day
            }
          }

          csv += `${record.totalPresent},${record.totalAbsent},${record.totalOT},${record.totalIdle}\n`;
          serialNo++;
        });

        // Site totals row
        csv += `"Site Total (${siteGroup.manpowerRecords.length} manpower)",,,,,,`;
        for (let day = 1; day <= daysInMonth; day++) {
          csv += ',,'; // Skip daily columns
        }
        csv += `${siteGroup.siteTotals.totalPresent},${siteGroup.siteTotals.totalAbsent},${siteGroup.siteTotals.totalOT},${siteGroup.siteTotals.totalIdle}\n`;
      });

      // Grand totals row
      csv += `\n"GRAND TOTAL (${data.grandTotals.totalManpower} manpower)",,,,,,`;
      for (let day = 1; day <= daysInMonth; day++) {
        csv += ',,'; // Skip daily columns
      }
      csv += `${data.grandTotals.totalPresent},${data.grandTotals.totalAbsent},${data.grandTotals.totalOT},${data.grandTotals.totalIdle}\n`;

      // Download
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `attendance_report_${data.filters.month}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('Report exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export report');
    }
  };

  const exportToPDF = (data: AttendanceReportResponse) => {
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

      // Add title
      doc.setFontSize(16);
      doc.text('Attendance Report', 14, 15);

      // Add report details
      doc.setFontSize(10);
      doc.text(`Month: ${data.filters.month}`, 14, 22);
      doc.text(`Sites: ${selectedSiteIds.map((id) => sites?.find((s) => s.id === id)?.site || id).join(', ')}`, 14, 27);
      if (data.filters.category) doc.text(`Category: ${data.filters.category}`, 14, 32);
      if (data.filters.skillSet) doc.text(`Skill Set: ${data.filters.skillSet}`, 14, 37);

      // Get days in month for headers
      const [year, month] = data.filters.month.split('-').map(Number);
      const daysInMonth = new Date(year, month, 0).getDate();
      const dayHeaders = Array.from({ length: daysInMonth }, (_, i) => String(i + 1));

      const baseStartY = data.filters.skillSet ? 42 : (data.filters.category ? 37 : 32);
      let startY = baseStartY;

      data.data.forEach((siteGroup, sgIndex) => {
        if (sgIndex === 0) {
          // Add more space below the header block before first site group
          startY = baseStartY + 8;
        } else {
          const prev: any = (doc as any).lastAutoTable;
          if (prev && prev.finalY) startY = prev.finalY + 10;
        }

        // Site label
        doc.setFontSize(11);
        doc.text(`Site: ${siteGroup.siteName}`, 14, startY);

        // Build table body for this site
        const tableBody = siteGroup.manpowerRecords.map((record, idx) => {
          const row: any[] = [
            idx + 1,
            record.manpowerName,
            record.supplierName,
            record.category || 'N/A',
            record.skillSet || 'N/A',
            record.siteName,
          ];

          const attendanceByDay: Record<number, { present: boolean; ot: number }> = {};
          record.dailyAttendance.forEach((att) => {
            const d = new Date(att.date).getDate();
            attendanceByDay[d] = { present: att.isPresent, ot: att.ot };
          });

          for (let d = 1; d <= daysInMonth; d++) {
            const dayData = attendanceByDay[d];
            if (dayData) row.push(dayData.present ? (dayData.ot > 0 ? `P+${dayData.ot}` : 'P') : 'A');
            else row.push('-');
          }

          row.push(record.totalPresent, record.totalAbsent, record.totalOT, record.totalIdle);
          return row;
        });

        // Site totals row
        const totalsRow: any[] = ['', 'Site Total', '', '', '', ''];
        for (let d = 1; d <= daysInMonth; d++) totalsRow.push('-');
        totalsRow.push(
          siteGroup.siteTotals.totalPresent,
          siteGroup.siteTotals.totalAbsent,
          siteGroup.siteTotals.totalOT,
          siteGroup.siteTotals.totalIdle
        );
        tableBody.push(totalsRow);

        autoTable(doc, {
          head: [[
            'Sr.',
            'Manpower',
            'Supplier',
            'Category',
            'Skill Set',
            'Site',
            ...dayHeaders,
            'Present',
            'Absent',
            'Total OT',
            'Idle',
          ]],
          body: tableBody,
          startY: startY + 4,
          styles: { fontSize: 6, cellPadding: 1 },
          headStyles: { fillColor: [66, 139, 202], fontSize: 6 },
          columnStyles: {
            0: { cellWidth: 8 },
            1: { cellWidth: 25 },
            2: { cellWidth: 20 },
            3: { cellWidth: 15 },
            4: { cellWidth: 15 },
            5: { cellWidth: 20 },
          },
          didParseCell: (hookData: any) => {
            // Color code attendance cells
            if (hookData.section === 'body' && hookData.column.index >= 6 && hookData.column.index < 6 + daysInMonth) {
              const cellValue = hookData.cell.text[0];
              if (cellValue === 'P') {
                hookData.cell.styles.fillColor = [173, 216, 230];
              } else if (cellValue && typeof cellValue === 'string' && cellValue.startsWith('P+')) {
                hookData.cell.styles.fillColor = [144, 238, 144];
              } else if (cellValue === 'A') {
                hookData.cell.styles.fillColor = [255, 182, 193];
              }
            }
            // Style totals row
            if (hookData.section === 'body' && hookData.row.index === tableBody.length - 1) {
              hookData.cell.styles.fontStyle = 'bold';
              hookData.cell.styles.fillColor = [245, 245, 245];
            }
          },
        });
      });

      // Grand totals summary
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

      // Save the PDF
      doc.save(`attendance_report_${data.filters.month}.pdf`);
      toast.success('PDF exported successfully');
    } catch (error) {
      console.error('PDF export error:', error);
      toast.error('Failed to export PDF');
    }
  };

  // Get days array for the selected month
  const getDaysArray = () => {
    if (!selectedMonth) return [];
    const [year, month] = selectedMonth.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => i + 1);
  };

  const daysArray = getDaysArray();

  // Create a map to track which days have any attendance records
  const daysWithRecords = useMemo(() => {
    if (!reportData) return new Set<number>();
    const days = new Set<number>();
    reportData.data.forEach((siteGroup) => {
      siteGroup.manpowerRecords.forEach((record) => {
        record.dailyAttendance.forEach((att) => {
          const day = new Date(att.date).getDate();
          days.add(day);
        });
      });
    });
    return days;
  }, [reportData]);

  // Visible days and total columns (6 fixed + visible days + 4 totals)
  const visibleDays = daysArray.filter((d) => daysWithRecords.has(d));
  const totalColumns = 6 + visibleDays.length + 4;

  return (
    <AppCard>
      <AppCard.Header>
        <AppCard.Title>Attendance Reports</AppCard.Title>
        <AppCard.Description>
          Generate and export attendance reports for selected sites and period.
        </AppCard.Description>
      </AppCard.Header>

      <AppCard.Content>
        {/* Filters Section */}
        <div className='space-y-6 mb-6'>
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
            {/* Month Selection */}
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

            {/* Category Filter */}
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

            {/* Skill Set Filter */}
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
                {skillSets?.map((skill) => (
                  <option key={skill.id} value={skill.skillsetName}>
                    {skill.skillsetName}
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
            <AppButton
              onClick={handleExport}
              disabled={!reportData || reportData.data.length === 0 || isLoading}
              iconName='Download'
            >
              Export Report
            </AppButton>
          </div>
        </div>

        {/* Report Display */}
        {isLoading && (
          <div className='p-6 text-center text-muted-foreground'>
            Loading report data...
          </div>
        )}

        {!isLoading && selectedSiteIds.length === 0 && (
          <div className='p-6 text-center text-muted-foreground'>
            Please select at least one site to generate the report
          </div>
        )}

        {!isLoading && selectedSiteIds.length > 0 && !selectedMonth && (
          <div className='p-6 text-center text-muted-foreground'>
            Please select a month to generate the report
          </div>
        )}

        {!isLoading && reportData && reportData.data.length === 0 && (
          <div className='p-6 text-center text-muted-foreground'>
            No attendance data found for the selected filters
          </div>
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
                  <span className='text-muted-foreground'>Days:</span>{' '}
                  <span className='font-medium text-foreground'>{daysArray.length}</span>
                </div>
              </div>
            </div>

            <table className='min-w-full divide-y divide-border'>
              <thead className='bg-muted/50 sticky top-0'>
                <tr>
                  <th className='px-3 py-3 text-left text-xs font-medium text-foreground uppercase tracking-wider border-r border-border'>
                    Sr.
                  </th>
                  <th className='px-3 py-3 text-left text-xs font-medium text-foreground uppercase tracking-wider border-r border-border min-w-[150px]'>
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
                  {visibleDays.map((day) => (
                    <th
                      key={day}
                      className='px-2 py-3 text-center text-xs font-medium text-foreground uppercase tracking-wider border-r border-border'
                    >
                      {day}
                    </th>
                  ))}
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
                    {/* Site header row */}
                    <tr className='bg-muted/50'>
                      <td colSpan={totalColumns} className='px-3 py-2 text-sm font-semibold text-foreground'>
                        Site: {siteGroup.siteName} — Present: {siteGroup.siteTotals.totalPresent}, Absent: {siteGroup.siteTotals.totalAbsent}, OT: {siteGroup.siteTotals.totalOT}, Idle: {siteGroup.siteTotals.totalIdle}
                      </td>
                    </tr>

                    {siteGroup.manpowerRecords.map((record, idx) => {
                      const serial = reportData.data
                        .slice(0, sgIndex)
                        .reduce((sum, g) => sum + g.manpowerRecords.length, 0) + (idx + 1);

                      return (
                        <tr key={record.manpowerId} className='hover:bg-muted/30'>
                          <td className='px-3 py-2 text-sm text-foreground border-r border-border'>
                            {serial}
                          </td>
                          <td className='px-3 py-2 text-sm text-foreground border-r border-border font-medium'>
                            {record.manpowerName}
                          </td>
                          <td className='px-3 py-2 text-sm text-muted-foreground border-r border-border'>
                            {record.supplierName}
                          </td>
                          <td className='px-3 py-2 text-sm text-muted-foreground border-r border-border'>
                            {record.category || '-'}
                          </td>
                          <td className='px-3 py-2 text-sm text-muted-foreground border-r border-border'>
                            {record.skillSet || '-'}
                          </td>
                          <td className='px-3 py-2 text-sm text-muted-foreground border-r border-border'>
                            {record.siteName}
                          </td>
                          {visibleDays.map((day) => {
                            const att = record.dailyAttendance.find(
                              (a) => new Date(a.date).getDate() === day
                            );

                            if (!att) {
                              return (
                                <td
                                  key={day}
                                  className='px-2 py-2 text-sm text-center border-r border-border text-muted-foreground'
                                >
                                  -
                                </td>
                              );
                            }

                            return (
                              <td
                                key={day}
                                className={`px-2 py-2 text-sm text-center border-r border-border ${
                                  att.isPresent
                                    ? att.isIdle
                                      ? 'bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300'
                                      : att.ot > 0
                                      ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                                      : 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                                    : 'bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400'
                                }`}
                                title={
                                  att.isPresent
                                    ? `Present${att.ot > 0 ? ` | OT: ${att.ot}h` : ''}${
                                        att.isIdle ? ' | Idle' : ''
                                      }`
                                    : 'Absent'
                                }
                              >
                                {att.isPresent ? (att.ot > 0 ? `P+${att.ot}` : 'P') : 'A'}
                              </td>
                            );
                          })}
                          <td className='px-3 py-2 text-sm text-center font-semibold text-blue-600 dark:text-blue-400 border-r border-border bg-blue-50 dark:bg-blue-950/20'>
                            {record.totalPresent}
                          </td>
                          <td className='px-3 py-2 text-sm text-center font-semibold text-red-600 dark:text-red-400 border-r border-border bg-red-50 dark:bg-red-950/20'>
                            {record.totalAbsent}
                          </td>
                          <td className='px-3 py-2 text-sm text-center font-semibold text-green-600 dark:text-green-400 border-r border-border bg-green-50 dark:bg-green-950/20'>
                            {record.totalOT}
                          </td>
                          <td className='px-3 py-2 text-sm text-center font-semibold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/20'>
                            {record.totalIdle}
                          </td>
                        </tr>
                      );
                    })}

                    {/* Site totals row aligned with last columns */}
                    <tr className='bg-muted/30'>
                      <td className='px-3 py-2 text-sm text-muted-foreground border-r border-border' colSpan={6 + visibleDays.length}>
                        Site Total ({siteGroup.manpowerRecords.length} manpower)
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

            {/* Legend */}
            <div className='mt-4 p-4 bg-muted/30 rounded-md'>
              <h4 className='text-sm font-semibold text-foreground mb-2'>Legend:</h4>
              <div className='flex flex-wrap gap-4 text-sm'>
                <div className='flex items-center gap-2'>
                  <span className='px-2 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded'>
                    P
                  </span>
                  <span className='text-muted-foreground'>Present</span>
                </div>
                <div className='flex items-center gap-2'>
                  <span className='px-2 py-1 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 rounded'>
                    A
                  </span>
                  <span className='text-muted-foreground'>Absent</span>
                </div>
                <div className='flex items-center gap-2'>
                  <span className='px-2 py-1 bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded'>
                    P+2
                  </span>
                  <span className='text-muted-foreground'>Present with Overtime (hours)</span>
                </div>
                <div className='flex items-center gap-2'>
                  <span className='px-2 py-1 bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 rounded'>
                    P (Idle)
                  </span>
                  <span className='text-muted-foreground'>Present but Idle</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </AppCard.Content>
    </AppCard>
  );
}
