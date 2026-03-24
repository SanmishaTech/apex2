"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import useSWR from "swr";
import { Form } from "@/components/ui/form";
import { AppCard } from "@/components/common/app-card";
import { AppButton } from "@/components/common/app-button";
import { ComboboxInput } from "@/components/common/combobox-input";
import { apiGet } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { usePermissions } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/config/roles";
import { formatNumber } from "@/lib/locales";

type FormValues = {
  boqId: string;
};

type BoqListResponse = {
  data: Array<{ id: number; boqNo: string | null; workName?: string | null; site?: { site?: string | null } | null }>;
};

type OverallBudgetQueryResponse = {
  meta: { boqNo: string; workName: string; siteName: string };
  budgetItemIds: number[];
  budgetItemLabels: Record<number, string>;
  budgetItemUnits: Record<number, string>;
  closingQtyMap: Record<number, number>;
  averageRates: Record<number, number>;
  totalAmounts: Record<number, number>;
  rows: Array<{
    activityId: string;
    boqItemName: string;
    boqQty: number;
    unitName: string;
    qtyMap: Record<number, number>;
  }>;
  totals: Record<number, number>;
};

const fmt = (n: number) => formatNumber(Number(n) || 0, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function OverallBudgetReportPage() {
  const { can } = usePermissions();
  if (!can(PERMISSIONS.VIEW_OVERALL_BUDGET_REPORT)) {
    return (
      <div className="text-muted-foreground">
        You do not have access to Overall Budget reports.
      </div>
    );
  }

  const form = useForm<FormValues>({
    mode: "onChange",
    defaultValues: { boqId: "" },
  });
  const { control, getValues, watch } = form;

  const { data: boqsData, isLoading: boqsLoading } = useSWR<BoqListResponse>(
    "/api/boqs?perPage=1000&sort=boqNo&order=desc",
    apiGet
  );

  const boqOptions = useMemo(() => {
    return (boqsData?.data || []).map((b) => {
      const boqNo = b.boqNo || "—";
      const siteName = b.site?.site ? ` - ${b.site.site}` : "";
      return { value: String(b.id), label: `${boqNo}${siteName}` };
    });
  }, [boqsData]);

  const selectedBoqId = watch("boqId");
  const selectedBoqLabel = useMemo(() => {
    const opt = boqOptions.find((o) => o.value === selectedBoqId);
    return opt?.label || "boq";
  }, [boqOptions, selectedBoqId]);

  const [searchParams, setSearchParams] = useState<{ boqId: string } | null>(null);

  const { data: reportData, isLoading: reportLoading } = useSWR<OverallBudgetQueryResponse>(
    searchParams ? `/api/reports/overall-budget?boqId=${searchParams.boqId}` : null,
    apiGet
  );

  const [downloading, setDownloading] = useState(false);

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

  function handleSearch() {
    const vals = getValues();
    if (!vals.boqId) {
      toast.error("Please select a BOQ first");
      return;
    }
    setSearchParams({ boqId: vals.boqId });
  }

  function handleReset() {
    form.reset({ boqId: "" });
    setSearchParams(null);
  }

  async function handleGenerate() {
    const boqId = searchParams?.boqId;
    if (!boqId) {
      toast.error("Please select a BOQ and Search first");
      return;
    }

    setDownloading(true);
    try {
      const url = `/api/reports/site-budget-excel?boqId=${encodeURIComponent(boqId)}`;
      const today = new Date().toISOString().slice(0, 10);
      const safeBoq = selectedBoqLabel
        .replace(/[^a-z0-9\- _]/gi, "")
        .replace(/\s+/g, "-");
      const filename = `overall-budget-report-${safeBoq}-${today}.xlsx`;
      await downloadFile(url, filename);
    } catch (e: any) {
      toast.error(e?.message || "Failed to generate report");
    } finally {
      setDownloading(false);
    }
  }

  const { budgetItemIds = [], budgetItemLabels = {}, rows = [], totals = {}, meta } = reportData || {};

  return (
    <div className="space-y-6">
      <Form {...form}>
        <AppCard>
          <AppCard.Header>
            <AppCard.Title>Overall Budget Report</AppCard.Title>
            <AppCard.Description>Select BOQ to view and export the overall site budget data.</AppCard.Description>
          </AppCard.Header>
          <AppCard.Content>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div className="md:col-span-2">
                <ComboboxInput
                  control={control}
                  name="boqId"
                  label="BOQ"
                  required
                  options={boqOptions}
                  placeholder={boqsLoading ? "Loading..." : "Select BOQ"}
                />
              </div>
              <div className="flex gap-2 justify-end md:justify-start">
                <AppButton type="button" onClick={handleSearch} disabled={boqsLoading}>Search</AppButton>
                <AppButton type="button" variant="outline" onClick={handleReset} disabled={boqsLoading}>Reset</AppButton>
                <AppButton
                  type="button"
                  variant="secondary"
                  onClick={handleGenerate}
                  disabled={downloading || !searchParams}
                  isLoading={downloading}
                >
                  Generate Excel
                </AppButton>
              </div>
            </div>
          </AppCard.Content>
        </AppCard>
      </Form>

        <AppCard>
          <AppCard.Header>
            <AppCard.Title>Report Data</AppCard.Title>
            <AppCard.Description>
              {searchParams ? (meta ? `BOQ: ${meta.boqNo} | Site: ${meta.siteName}` : "Loading report...") : "Select BOQ and search to view data."}
            </AppCard.Description>
          </AppCard.Header>
          <AppCard.Content>
            {!searchParams ? null : reportLoading ? (
              <div className="text-center py-6 text-muted-foreground animate-pulse">Loading data...</div>
            ) : (
              <>
                <div className="border rounded-lg overflow-x-auto">
                  <table className="w-full min-w-300 text-xs border-collapse border border-slate-300 dark:border-slate-700">
                    <thead>
                      <tr className="bg-sky-700 dark:bg-sky-900 text-white">
                        <th className="border border-sky-600 dark:border-sky-800 text-left p-3 font-medium">Activity ID</th>
                        <th className="border border-sky-600 dark:border-sky-800 text-left p-3 font-medium">BOQ Item</th>
                        <th className="border border-sky-600 dark:border-sky-800 text-right p-3 font-medium">BOQ Qty</th>
                        <th className="border border-sky-600 dark:border-sky-800 text-left p-3 font-medium">Unit</th>
                        {budgetItemIds.map((id) => (
                          <th key={id} className="border border-sky-600 dark:border-sky-800 text-right p-3 font-medium whitespace-nowrap">
                            {budgetItemLabels[id] || id}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.length === 0 ? (
                        <tr>
                          <td colSpan={100} className="p-4 text-center text-muted-foreground border border-slate-300 dark:border-slate-700">
                            No records found.
                          </td>
                        </tr>
                      ) : (
                        <>
                          {rows.map((row, i) => (
                            <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                              <td className="border border-slate-300 dark:border-slate-700 p-3 whitespace-nowrap">{row.activityId}</td>
                              <td className="border border-slate-300 dark:border-slate-700 p-3 max-w-sm truncate" title={row.boqItemName}>{row.boqItemName}</td>
                              <td className="border border-slate-300 dark:border-slate-700 p-3 text-right font-medium">{fmt(row.boqQty)}</td>
                              <td className="border border-slate-300 dark:border-slate-700 p-3 text-left">{row.unitName}</td>
                              {budgetItemIds.map((id) => (
                                <td key={id} className="border border-slate-300 dark:border-slate-700 p-3 text-right">
                                  {row.qtyMap[id] ? fmt(row.qtyMap[id]) : ""}
                                </td>
                              ))}
                            </tr>
                          ))}
                          <tr className="bg-slate-100 dark:bg-slate-800 font-bold">
                            <td colSpan={4} className="border border-slate-300 dark:border-slate-700 p-3 text-right">TOTAL</td>
                            {budgetItemIds.map((id) => (
                              <td key={id} className="border border-slate-300 dark:border-slate-700 p-3 text-right">
                                {totals[id] ? fmt(totals[id]) : ""}
                              </td>
                            ))}
                          </tr>
                        </>
                      )}
                    </tbody>
                  </table>
                </div>

                {budgetItemIds.length > 0 && (
                  <div className="border rounded-lg overflow-x-auto mt-8 inline-block">
                    <table className="text-xs border-collapse border border-slate-300 dark:border-slate-700">
                      <thead>
                        <tr className="bg-sky-700 dark:bg-sky-900 text-white">
                          <th className="border border-sky-600 dark:border-sky-800 text-left p-3 font-medium">Sr No</th>
                          <th className="border border-sky-600 dark:border-sky-800 text-left p-3 font-medium">Item Name</th>
                          <th className="border border-sky-600 dark:border-sky-800 text-left p-3 font-medium">Unit</th>
                          <th className="border border-sky-600 dark:border-sky-800 text-right p-3 font-medium">Total Qty</th>
                          <th className="border border-sky-600 dark:border-sky-800 text-right p-3 font-medium">Average Rate</th>
                          <th className="border border-sky-600 dark:border-sky-800 text-right p-3 font-medium">Total Amount</th>
                          <th className="border border-sky-600 dark:border-sky-800 text-right p-3 font-medium">Closing Qty</th>
                        </tr>
                      </thead>
                      <tbody>
                        {budgetItemIds.map((id, idx) => (
                          <tr key={id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="border border-slate-300 dark:border-slate-700 p-3">{idx + 1}</td>
                            <td className="border border-slate-300 dark:border-slate-700 p-3">{budgetItemLabels[id] || id}</td>
                            <td className="border border-slate-300 dark:border-slate-700 p-3">{reportData?.budgetItemUnits?.[id] || ""}</td>
                            <td className="border border-slate-300 dark:border-slate-700 p-3 text-right font-bold">{totals[id] ? fmt(totals[id]) : "0.00"}</td>
                            <td className="border border-slate-300 dark:border-slate-700 p-3 text-right font-medium">
                              {reportData?.averageRates?.[id] ? fmt(reportData.averageRates[id]) : "0.00"}
                            </td>
                            <td className="border border-slate-300 dark:border-slate-700 p-3 text-right font-bold text-sky-700 dark:text-sky-400">
                              {reportData?.totalAmounts?.[id] ? fmt(reportData.totalAmounts[id]) : "0.00"}
                            </td>
                            <td className="border border-slate-300 dark:border-slate-700 p-3 text-right font-medium text-emerald-600 dark:text-emerald-400">
                              {reportData?.closingQtyMap?.[id] ? fmt(reportData.closingQtyMap[id]) : "0.00"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </AppCard.Content>
        </AppCard>
    </div>
  );
}
