"use client";

import { useMemo, useState, Fragment } from "react";
import { useForm } from "react-hook-form";
import useSWR from "swr";
import { Form } from "@/components/ui/form";
import { AppCard } from "@/components/common/app-card";
import { AppButton } from "@/components/common/app-button";
import { ComboboxInput } from "@/components/common/combobox-input";
import { MultiSelectInput } from "@/components/common/multi-select-input";
import { apiGet } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { usePermissions } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/config/roles";
import { formatNumber } from "@/lib/locales";

type FormValues = {
  zoneId: string;
  sites: string[];
  items: string[];
  months: string[];
  weeks: string[];
};

const fmt = (n: number) => formatNumber(Number(n) || 0, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function BudgetPlanningReportPage() {
  const { can } = usePermissions();
  if (!can(PERMISSIONS.READ_SITE_BUDGETS)) {
    return (
      <div className="text-muted-foreground p-6">
        You do not have access to Budget Planning reports.
      </div>
    );
  }

  const form = useForm<FormValues>({
    mode: "onChange",
    defaultValues: { zoneId: "", sites: [], items: [], months: [], weeks: [] },
  });
  const { control, getValues, watch } = form;

  const watchZoneId = watch("zoneId");

  const { data: zonesData, isLoading: zonesLoading } = useSWR<any>("/api/zones?perPage=1000", apiGet);
  const { data: sitesData, isLoading: sitesLoading } = useSWR<any>("/api/sites?perPage=1000", apiGet);
  const { data: itemsData, isLoading: itemsLoading } = useSWR<any>("/api/items?perPage=2000", apiGet);
  const { data: optionsData, isLoading: optionsLoading } = useSWR<any>("/api/reports/budget-planning/options", apiGet);

  const zoneOptions = useMemo(() => {
    return (zonesData?.data || []).map((z: any) => ({
      value: String(z.id),
      label: z.zoneName || String(z.id),
    }));
  }, [zonesData]);

  const siteOptions = useMemo(() => {
    let sites = sitesData?.data || [];
    if (watchZoneId) {
      sites = sites.filter((s: any) => String(s.zoneId) === watchZoneId);
    }
    return sites.map((s: any) => ({
      value: String(s.id),
      label: `${s.site} ${s.shortName ? `(${s.shortName})` : ''}`,
    }));
  }, [sitesData, watchZoneId]);

  const itemOptions = useMemo(() => {
    return (itemsData?.data || []).map((it: any) => ({
      value: String(it.id),
      label: `${it.itemCode ?? ""}${it.item ? " - " + it.item : ""}`.trim(),
    }));
  }, [itemsData]);

  const monthOptions = useMemo(() => {
    return (optionsData?.months || []).map((m: string) => ({ value: m, label: m }));
  }, [optionsData]);

  const weekOptions = useMemo(() => {
    return (optionsData?.weeks || []).map((w: string) => ({ value: w, label: w }));
  }, [optionsData]);

  const [searchParams, setSearchParams] = useState<any>(null);

  const { data: reportData, isLoading: reportLoading } = useSWR<any>(
    searchParams ? `/api/reports/budget-planning?` + new URLSearchParams(searchParams).toString() : null,
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
    const query: any = {};
    if (vals.zoneId) query.zoneId = vals.zoneId;
    if (vals.sites?.length) query.sites = vals.sites.join(",");
    if (vals.items?.length) query.items = vals.items.join(",");
    if (vals.months?.length) query.months = vals.months.join(",");
    if (vals.weeks?.length) query.weeks = vals.weeks.join(",");
    
    setSearchParams(query);
  }

  function handleReset() {
    form.reset({ zoneId: "", sites: [], items: [], months: [], weeks: [] });
    setSearchParams(null);
  }

  async function handleGenerate() {
    if (!searchParams) {
      toast.error("Please configure filters and click Search first");
      return;
    }

    setDownloading(true);
    try {
      const url = `/api/reports/budget-planning-excel?` + new URLSearchParams(searchParams).toString();
      const today = new Date().toISOString().slice(0, 10);
      const filename = `budget-planning-report-${today}.xlsx`;
      await downloadFile(url, filename);
    } catch (e: any) {
      toast.error(e?.message || "Failed to generate excel");
    } finally {
      setDownloading(false);
    }
  }

  const rows = reportData?.data || [];

  return (
    <div className="space-y-6">
      <Form {...form}>
        <AppCard>
          <AppCard.Header>
            <AppCard.Title>Budget Planning Report</AppCard.Title>
            <AppCard.Description>Filter site budgets globally by zone, sites, items, months, and weeks. Leaving a filter blank includes all underlying records.</AppCard.Description>
          </AppCard.Header>
          <AppCard.Content>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              <div>
                <ComboboxInput
                  control={control}
                  name="zoneId"
                  label="Zone"
                  options={zoneOptions}
                  placeholder={zonesLoading ? "Loading..." : "Select Zone"}
                />
              </div>
              <div>
                <MultiSelectInput
                  control={control}
                  name="sites"
                  label="Sites"
                  options={siteOptions}
                  placeholder={sitesLoading ? "Loading..." : "All Sites"}
                />
              </div>
              <div>
                <MultiSelectInput
                  control={control}
                  name="items"
                  label="Items"
                  options={itemOptions}
                  placeholder={itemsLoading ? "Loading..." : "All Items"}
                />
              </div>
              <div>
                <MultiSelectInput
                  control={control}
                  name="months"
                  label="Months"
                  options={monthOptions}
                  placeholder={optionsLoading ? "Loading..." : "All Months"}
                />
              </div>
              <div>
                <MultiSelectInput
                  control={control}
                  name="weeks"
                  label="Weeks"
                  options={weekOptions}
                  placeholder={optionsLoading ? "Loading..." : "All Weeks"}
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <AppButton type="button" onClick={handleSearch}>Search</AppButton>
              <AppButton type="button" variant="outline" onClick={handleReset}>Reset</AppButton>
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
          </AppCard.Content>
        </AppCard>
      </Form>

      {searchParams && (
        <AppCard>
          <AppCard.Header>
            <AppCard.Title>Report Data</AppCard.Title>
          </AppCard.Header>
          <AppCard.Content>
            {reportLoading ? (
              <div className="text-center py-6 text-muted-foreground animate-pulse">Loading data...</div>
            ) : (
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full min-w-[800px] text-xs border-collapse border border-slate-300 dark:border-slate-700">
                  <thead>
                    <tr className="bg-emerald-600 dark:bg-emerald-900 text-white">
                      <th className="border border-emerald-500 dark:border-emerald-800 text-left p-3 font-medium">Sr No</th>
                      <th className="border border-emerald-500 dark:border-emerald-800 text-left p-3 font-medium">Zone</th>
                      <th className="border border-emerald-500 dark:border-emerald-800 text-left p-3 font-medium">Site</th>
                      <th className="border border-emerald-500 dark:border-emerald-800 text-left p-3 font-medium">Item Name</th>
                      <th className="border border-emerald-500 dark:border-emerald-800 text-left p-3 font-medium">Unit</th>
                      <th className="border border-emerald-500 dark:border-emerald-800 text-right p-3 font-medium">Rate</th>
                      <th className="border border-emerald-500 dark:border-emerald-800 text-right p-3 font-medium">Closing Qty</th>
                      <th className="border border-emerald-500 dark:border-emerald-800 text-right p-3 font-medium whitespace-nowrap">Total Req. Qty</th>
                      <th className="border border-emerald-500 dark:border-emerald-800 text-right p-3 font-medium">Received</th>
                      <th className="border border-emerald-500 dark:border-emerald-800 text-right p-3 font-medium whitespace-nowrap">Balance To Be Sent</th>
                      {reportData?.meta?.selectedMonths?.map((m: string) => (
                        <Fragment key={m}>
                          <th className="border border-emerald-500 dark:border-emerald-800 text-right p-3 font-medium whitespace-nowrap">{m} Qty</th>
                          <th className="border border-emerald-500 dark:border-emerald-800 text-right p-3 font-medium whitespace-nowrap">{m} Amount</th>
                        </Fragment>
                      ))}
                      {reportData?.meta?.selectedWeeks?.map((w: string) => (
                        <Fragment key={w}>
                          <th className="border border-emerald-500 dark:border-emerald-800 text-right p-3 font-medium whitespace-nowrap">{w} Qty</th>
                          <th className="border border-emerald-500 dark:border-emerald-800 text-right p-3 font-medium whitespace-nowrap">{w} Amount</th>
                        </Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={20} className="p-4 text-center text-muted-foreground border border-slate-300 dark:border-slate-700">
                          No records found matching filters.
                        </td>
                      </tr>
                    ) : (
                      rows.map((row: any, i: number) => (
                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="border border-slate-300 dark:border-slate-700 p-3">{i + 1}</td>
                          <td className="border border-slate-300 dark:border-slate-700 p-3">{row.zone}</td>
                          <td className="border border-slate-300 dark:border-slate-700 p-3">{row.site}</td>
                          <td className="border border-slate-300 dark:border-slate-700 p-3 max-w-sm" title={row.itemName}>{row.itemName}</td>
                          <td className="border border-slate-300 dark:border-slate-700 p-3">{row.unit}</td>
                          <td className="border border-slate-300 dark:border-slate-700 p-3 text-right">{fmt(row.budgetRate)}</td>
                          <td className="border border-slate-300 dark:border-slate-700 p-3 text-right text-emerald-600 dark:text-emerald-400 font-medium">{fmt(row.closingQty)}</td>
                          <td className="border border-slate-300 dark:border-slate-700 p-3 text-right font-medium">{fmt(row.totalReqQty)}</td>
                          <td className="border border-slate-300 dark:border-slate-700 p-3 text-right text-emerald-600 dark:text-emerald-400 font-medium">{fmt(row.receivedQty)}</td>
                          <td className="border border-slate-300 dark:border-slate-700 p-3 text-right font-bold text-slate-900 dark:text-slate-100">{fmt(row.balance)}</td>
                          {reportData?.meta?.selectedMonths?.map((m: string) => (
                            <Fragment key={m}>
                              <td className="border border-slate-300 dark:border-slate-700 p-3 text-right">{fmt(row.monthProps[m]?.qty || 0)}</td>
                              <td className="border border-slate-300 dark:border-slate-700 p-3 text-right">{fmt(row.monthProps[m]?.amt || 0)}</td>
                            </Fragment>
                          ))}
                          {reportData?.meta?.selectedWeeks?.map((w: string) => (
                            <Fragment key={w}>
                              <td className="border border-slate-300 dark:border-slate-700 p-3 text-right">{fmt(row.weekProps[w]?.qty || 0)}</td>
                              <td className="border border-slate-300 dark:border-slate-700 p-3 text-right">{fmt(row.weekProps[w]?.amt || 0)}</td>
                            </Fragment>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </AppCard.Content>
        </AppCard>
      )}
    </div>
  );
}
