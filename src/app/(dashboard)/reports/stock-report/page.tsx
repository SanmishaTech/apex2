"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import useSWR from "swr";
import { Form } from "@/components/ui/form";
import { AppCard } from "@/components/common/app-card";
import { AppButton } from "@/components/common/app-button";
import { MultiSelectInput } from "@/components/common/multi-select-input";
import { apiGet } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { usePermissions } from "@/hooks/use-permissions";
import { formatNumber } from "@/lib/locales";
import { PERMISSIONS } from "@/config/roles";
import { Search, RotateCcw, FileDown } from "lucide-react";

type FormValues = {
  siteIds: string[];
  itemIds: string[];
  expiryDates: string[];
};

type FilterOptionsResponse = {
  sites: { value: string; label: string }[];
  items: { value: string; label: string }[];
  expiryDates: { value: string; label: string }[];
};

type StockReportRow = {
  id: number;
  zone: string;
  siteName: string;
  itemName: string;
  unitName: string;
  totalQty: number;
  totalValue: number;
  nextLotOrderDate?: string | null;
  expiryRange: string;
  expiries: Record<string, number>;
};

type SiteSummary = {
  site: string;
  good: number;
  expired: number;
  total: number;
};

type StockReportResponse = {
  rows: StockReportRow[];
  expiryColumns: { value: string; label: string }[];
  summaries: SiteSummary[];
};

export default function StockReportPage() {
  const { can } = usePermissions();
  if (!can(PERMISSIONS.VIEW_STOCK_REPORT)) {
    return (
      <div className="text-muted-foreground p-4">
        You do not have access to Stock Report.
      </div>
    );
  }

  const form = useForm<FormValues>({
    defaultValues: {
      siteIds: [],
      itemIds: [],
      expiryDates: [],
    },
  });

  const { control, getValues, reset } = form;

  const { data: filterOptions, isLoading: filtersLoading } = useSWR<FilterOptionsResponse>(
    "/api/reports/stock-report?type=filters",
    apiGet
  );

  const [appliedFilters, setAppliedFilters] = useState<FormValues | null>(null);
  const [searchNonce, setSearchNonce] = useState(0);
  const [downloading, setDownloading] = useState(false);

  const reportUrl = useMemo(() => {
    if (!appliedFilters) return null;
    const params = new URLSearchParams();
    if (appliedFilters.siteIds.length > 0) params.set("siteIds", appliedFilters.siteIds.join(","));
    if (appliedFilters.itemIds.length > 0) params.set("itemIds", appliedFilters.itemIds.join(","));
    if (appliedFilters.expiryDates.length > 0) params.set("expiryDates", appliedFilters.expiryDates.join(","));
    params.set("_ts", String(searchNonce));
    return `/api/reports/stock-report?${params.toString()}`;
  }, [appliedFilters, searchNonce]);

  const { data: report, isLoading: reportLoading, mutate: mutateReport } = useSWR<StockReportResponse>(
    reportUrl,
    apiGet,
    { revalidateOnFocus: false, revalidateOnReconnect: false }
  );

  async function handleSearch() {
    const values = getValues();
    setAppliedFilters(values);
    setSearchNonce(Date.now());
    await mutateReport();
  }

  function handleReset() {
    reset({ siteIds: [], itemIds: [], expiryDates: [] });
    setAppliedFilters(null);
    setSearchNonce(0);
  }

  async function downloadFile(url: string, filename: string) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      toast.error(`Download failed (${res.status})`);
      return;
    }
    const blob = await res.blob();
    const link = document.createElement("a");
    const objectUrl = URL.createObjectURL(blob);
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  }

  async function handleExportExcel() {
    const values = getValues();
    setDownloading(true);
    try {
      const params = new URLSearchParams();
      if (values.siteIds.length > 0) params.set("siteIds", values.siteIds.join(","));
      if (values.itemIds.length > 0) params.set("itemIds", values.itemIds.join(","));
      if (values.expiryDates.length > 0) params.set("expiryDates", values.expiryDates.join(","));
      
      const url = `/api/reports/stock-report-excel?${params.toString()}`;
      const today = new Date().toISOString().slice(0, 10);
      await downloadFile(url, `stock-report-${today}.xlsx`);
    } catch (e: any) {
      toast.error(e?.message || "Failed to generate Excel report");
    } finally {
      setDownloading(false);
    }
  }

  const rows = report?.rows || [];
  const expiryColumns = report?.expiryColumns || [];
  const summaries = report?.summaries || [];

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextMonth = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, "0")}`;

  function getExpiryClasses(expiryDate: string) {
    if (!expiryDate || expiryDate === "—") return "";
    if (expiryDate < currentMonth) return "bg-red-600 text-white font-bold";
    if (expiryDate === currentMonth || expiryDate === nextMonth) return "bg-yellow-400 text-black font-bold";
    return "";
  }

  function getNextLotDateClasses(dateStr: string | null | undefined) {
    if (!dateStr || dateStr === "—" || dateStr === "<Asset>") return "";
    const d = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const fiveDaysFromNow = new Date(today);
    fiveDaysFromNow.setDate(today.getDate() + 5);
    
    if (d >= today && d <= fiveDaysFromNow) {
      return "bg-blue-600 text-white font-bold";
    }
    return "";
  }

  const grandTotals = useMemo(() => {
    return summaries.reduce(
      (acc, s) => ({
        good: acc.good + s.good,
        expired: acc.expired + s.expired,
        total: acc.total + s.total,
      }),
      { good: 0, expired: 0, total: 0 }
    );
  }, [summaries]);

  return (
    <div className="space-y-4 p-4">
      <Form {...form}>
        <AppCard>
          <AppCard.Header>
            <AppCard.Title>Stock Report</AppCard.Title>
            <AppCard.Description>
              Filter by Site, Items, and Expiry Date to view stock levels.
            </AppCard.Description>
          </AppCard.Header>
          <AppCard.Content>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <MultiSelectInput
                control={control}
                name="siteIds"
                label="Sites"
                placeholder="Select Sites..."
                options={filterOptions?.sites || []}
                disabled={filtersLoading}
                size="sm"
              />
              <MultiSelectInput
                control={control}
                name="itemIds"
                label="Items"
                placeholder="Select Items..."
                options={filterOptions?.items || []}
                disabled={filtersLoading}
                size="sm"
              />
              <MultiSelectInput
                control={control}
                name="expiryDates"
                label="Expiry Dates"
                placeholder="Select Expiry Dates..."
                options={filterOptions?.expiryDates || []}
                disabled={filtersLoading}
                size="sm"
              />
              <div className="flex items-center gap-2 justify-end">
                <AppButton
                  size="sm"
                  variant="default"
                  onClick={handleSearch}
                  disabled={reportLoading}
                >
                  Search
                </AppButton>
                <AppButton
                  size="sm"
                  variant="outline"
                  onClick={handleReset}
                  disabled={reportLoading}
                >
                  Reset
                </AppButton>
                <AppButton
                  size="sm"
                  variant="default"
                  onClick={handleExportExcel}
                  disabled={downloading || rows.length === 0}
                  isLoading={downloading}
                >
                  Excel
                </AppButton>
              </div>
            </div>
          </AppCard.Content>
        </AppCard>
      </Form>

      {appliedFilters && (
        <>
          <AppCard>
            <AppCard.Header>
              <AppCard.Title>Report</AppCard.Title>
            </AppCard.Header>
            <AppCard.Content>
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full border-collapse text-[10px] border border-slate-300 dark:border-slate-700">
                  <thead>
                    <tr className="bg-sky-700 dark:bg-sky-900 text-white">
                      <th className="p-2 text-left font-medium border border-sky-600 dark:border-sky-800 w-8">Sr No</th>
                      <th className="p-2 text-left font-medium border border-sky-600 dark:border-sky-800">Site</th>
                      <th className="p-2 text-left font-medium border border-sky-600 dark:border-sky-800">Item Name</th>
                      <th className="p-2 text-right font-medium border border-sky-600 dark:border-sky-800">Qty</th>
                      <th className="p-2 text-left font-medium border border-sky-600 dark:border-sky-800">Unit</th>
                      <th className="p-2 text-right font-medium border border-sky-600 dark:border-sky-800">Amount</th>
                      <th className="p-2 text-left font-medium border border-sky-600 dark:border-sky-800 min-w-[120px]">Next lot order date</th>
                      <th className="p-2 text-left font-medium border border-sky-600 dark:border-sky-800">Expiry Range</th>
                      {expiryColumns.map(col => (
                        <th key={col.value} className="p-2 text-right font-medium border border-sky-600 dark:border-sky-800 min-w-[50px]">
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {reportLoading ? (
                      <tr>
                        <td colSpan={8 + expiryColumns.length} className="p-8 text-center text-muted-foreground animate-pulse">
                          Loading...
                        </td>
                      </tr>
                    ) : rows.length === 0 ? (
                      <tr>
                        <td colSpan={8 + expiryColumns.length} className="p-8 text-center text-muted-foreground">
                          No data.
                        </td>
                      </tr>
                    ) : (
                      rows.map((row, idx) => (
                        <tr 
                          key={idx} 
                          className={
                              "hover:bg-muted/30 " +
                              (idx % 2 === 0
                                ? "bg-white dark:bg-slate-900"
                                : "bg-slate-50 dark:bg-slate-800/50")
                            }
                        >
                          <td className="p-2 border border-slate-300 dark:border-slate-700 text-center">{idx + 1}</td>
                          <td className="p-2 border border-slate-300 dark:border-slate-700 font-medium">{row.siteName}</td>
                          <td className="p-2 border border-slate-300 dark:border-slate-700">{row.itemName}</td>
                          <td className="p-2 border border-slate-300 dark:border-slate-700 text-right font-semibold">
                            {formatNumber(row.totalQty, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-2 border border-slate-300 dark:border-slate-700 text-muted-foreground">{row.unitName}</td>
                          <td className="p-2 border border-slate-300 dark:border-slate-700 text-right font-semibold">
                            {formatNumber(row.totalValue, { minimumFractionDigits: 2 })}
                          </td>
                          <td className={`p-2 border border-slate-300 dark:border-slate-700 text-left ${getNextLotDateClasses(row.nextLotOrderDate)}`}>
                            {row.nextLotOrderDate ? row.nextLotOrderDate : "—"}
                          </td>
                          <td className={`p-2 border border-slate-300 dark:border-slate-700 ${getExpiryClasses(row.expiryRange.split(" - ")[0])}`}>
                            {row.expiryRange}
                          </td>
                          {expiryColumns.map(col => (
                            <td 
                              key={col.value} 
                              className={`p-2 border border-slate-300 dark:border-slate-700 text-right ${row.expiries[col.value] ? getExpiryClasses(col.value) : ""}`}
                            >
                              {row.expiries[col.value] ? formatNumber(row.expiries[col.value], { minimumFractionDigits: 2 }) : "—"}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </AppCard.Content>
          </AppCard>

          <AppCard>
            <AppCard.Header>
              <AppCard.Title>Site-wise Summary</AppCard.Title>
            </AppCard.Header>
            <AppCard.Content>
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full border-collapse text-[11px] border border-slate-300 dark:border-slate-700">
                  <thead>
                    <tr className="bg-sky-700 dark:bg-sky-900 text-white">
                      <th className="p-2 text-left font-medium border border-sky-600 dark:border-sky-800 w-10">Sr No</th>
                      <th className="p-2 text-left font-medium border border-sky-600 dark:border-sky-800">Site Name</th>
                      <th className="p-2 text-right font-medium border border-sky-600 dark:border-sky-800">Good Items Amount</th>
                      <th className="p-2 text-right font-medium border border-sky-600 dark:border-sky-800 text-red-100">Expired Items Amount</th>
                      <th className="p-2 text-right font-medium border border-sky-600 dark:border-sky-800">Total Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportLoading ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center animate-pulse">Loading...</td>
                      </tr>
                    ) : summaries.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-muted-foreground">No data.</td>
                      </tr>
                    ) : (
                      <>
                        {summaries.map((s, idx) => (
                          <tr 
                            key={idx} 
                            className={idx % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50 dark:bg-slate-800/50"}
                          >
                            <td className="p-2 border border-slate-300 dark:border-slate-700 text-center">{idx + 1}</td>
                            <td className="p-2 border border-slate-300 dark:border-slate-700 font-semibold">{s.site}</td>
                            <td className="p-2 border border-slate-300 dark:border-slate-700 text-right">
                              {formatNumber(s.good, { minimumFractionDigits: 2 })}
                            </td>
                            <td className="p-2 border border-slate-300 dark:border-slate-700 text-right text-red-600 font-medium">
                              {formatNumber(s.expired, { minimumFractionDigits: 2 })}
                            </td>
                            <td className="p-2 border border-slate-300 dark:border-slate-700 text-right font-bold text-sky-700 dark:text-sky-400">
                              {formatNumber(s.total, { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-sky-50 dark:bg-sky-950/30 font-bold border-t-2 border-slate-400 text-[11px]">
                          <td className="p-2 border border-slate-300 dark:border-slate-700 text-center"></td>
                          <td className="p-2 border border-slate-300 dark:border-slate-700 text-right">Grand Total:</td>
                          <td className="p-2 border border-slate-300 dark:border-slate-700 text-right">
                            {formatNumber(grandTotals.good, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-2 border border-slate-300 dark:border-slate-700 text-right text-red-600">
                            {formatNumber(grandTotals.expired, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-2 border border-slate-300 dark:border-slate-700 text-right text-sky-700 dark:text-sky-400">
                            {formatNumber(grandTotals.total, { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            </AppCard.Content>
          </AppCard>
        </>
      )}
    </div>
  );
}
