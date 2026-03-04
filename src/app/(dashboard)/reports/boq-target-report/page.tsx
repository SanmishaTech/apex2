"use client";

import { Fragment, useMemo, useState } from "react";
import useSWR from "swr";
import { useForm } from "react-hook-form";
import { Form } from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AppCard } from "@/components/common/app-card";
import { AppButton } from "@/components/common/app-button";
import { AppSelect } from "@/components/common/app-select";
import { ComboboxInput } from "@/components/common/combobox-input";
import { apiGet } from "@/lib/api-client";
import { formatCurrency, formatNumber } from "@/lib/locales";
import { toast } from "@/lib/toast";
import { usePermissions } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/config/roles";

type ReportResponse = {
  meta: {
    title: string;
    boqId: number;
    boqNo: string;
    workName?: string;
    site: string;
    month: string;
    generatedOn: string;
  };
  table1: {
    headerRow1: string[];
    headerRow2: string[];
    rows: Array<{ isGroup: boolean; cells: Array<string | number> }>;
    totalRow: Array<string | number>;
  };
  table2: {
    header: string[];
    rows: Array<Array<string | number>>;
  };
};

type FormValues = {
  boqId: string;
  month: string;
};

type BoqListResponse = {
  data: Array<{
    id: number;
    boqNo: string | null;
    site?: { id: number; site: string } | null;
  }>;
};

function buildMonthYearOptions(): Array<{ value: string; label: string }> {
  const now = new Date();
  const years = [now.getFullYear(), now.getFullYear() + 1];
  const names = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const opts: Array<{ value: string; label: string }> = [];
  for (const y of years) {
    for (const m of names) {
      const label = `${m} ${y}`;
      opts.push({ value: label, label });
    }
  }
  return opts;
}

export default function BoqTargetReportPage() {
  const { can } = usePermissions();
  if (!can(PERMISSIONS.READ_BOQS)) {
    return <div className="text-muted-foreground">You do not have access to BOQ Target report.</div>;
  }

  function toNum(v: unknown) {
    if (typeof v === "number") return v;
    if (typeof v === "string") {
      const cleaned = v.replace(/,/g, "").trim();
      const n = Number(cleaned);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  }

  function fmtQty(v: unknown) {
    const n = toNum(v);
    if (n == null) return v as any;
    return formatNumber(n, { useGrouping: true, minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  function fmtInr(v: unknown) {
    const n = toNum(v);
    if (n == null) return v as any;
    return formatCurrency(n);
  }

  function renderTable1Cell(cell: unknown, colIndex: number) {
    // Fixed columns (10):
    // 0 Activity ID, 1 BOQ Item, 2 BOQ Qty, 3 Unit, 4 Executed Qty, 5 Remaining Qty,
    // 6 Rate, 7 BOQ Amount, 8 Executed Amount, 9 Remaining Amount
    const fixedCount = 10;

    if (colIndex === 0 || colIndex === 1 || colIndex === 3) return cell as any;

    if (colIndex === 2 || colIndex === 4 || colIndex === 5) return fmtQty(cell);
    if (colIndex === 6 || colIndex === 7 || colIndex === 8 || colIndex === 9) return fmtInr(cell);

    // Dynamic columns: Month span 2 (qty, qty) + weeks each 4 (qty, amount, qty, amount)
    const dynIdx = colIndex - fixedCount;
    if (dynIdx < 0) return cell as any;

    if (dynIdx === 0 || dynIdx === 1) return fmtQty(cell);

    const withinWeek = (dynIdx - 2) % 4;
    if (withinWeek === 0 || withinWeek === 2) return fmtQty(cell);
    if (withinWeek === 1 || withinWeek === 3) return fmtInr(cell);
    return cell as any;
  }

  function renderAmountWithPct(cell: unknown) {
    // Expected input like: "12345.67 (10.00%)" (from API total row)
    const raw = String(cell ?? "").trim();
    const m = raw.match(/^\s*([\d.,-]+)\s*\(([^)]+)\)\s*$/);
    if (!m) return cell as any;
    const amount = toNum(m[1]);
    const pct = m[2];
    return (
      <span className="whitespace-nowrap">
        <span>{amount == null ? m[1] : fmtInr(amount)}</span>
        <span className="ml-1 text-xs text-slate-700">({pct})</span>
      </span>
    );
  }

  function renderTable2Cell(cell: unknown, colIndex: number, totalCols: number) {
    // 0 Activity ID, 1 BOQ Item, 2 BOQ Qty, 3 Executed Qty, 4 Remaining Qty, ...days..., Total Qty, Total Amount
    if (colIndex === 0 || colIndex === 1) return cell as any;
    const lastIdx = totalCols - 1;
    if (colIndex === lastIdx) return fmtInr(cell);
    return fmtQty(cell);
  }

  function splitWords(s: unknown) {
    return String(s || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
  }

  function truncateWords(s: unknown, maxWords: number) {
    const words = splitWords(s);
    if (words.length <= maxWords) return { short: String(s || ""), full: String(s || ""), hasMore: false };
    return {
      short: `${words.slice(0, maxWords).join(" ")}`,
      full: words.join(" "),
      hasMore: true,
    };
  }

  const form = useForm<FormValues>({
    mode: "onChange",
    defaultValues: { boqId: "", month: "" },
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

  const monthOptions = useMemo(() => buildMonthYearOptions(), []);

  const selectedBoqId = watch("boqId");
  const selectedBoqLabel = useMemo(() => {
    const opt = boqOptions.find((o) => o.value === selectedBoqId);
    return opt?.label || "boq";
  }, [boqOptions, selectedBoqId]);

  const selectedMonth = watch("month");

  const [downloading, setDownloading] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState<{ boqId: string; month: string } | null>(null);
  const [searchNonce, setSearchNonce] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);
  const [moreTitle, setMoreTitle] = useState<string>("");
  const [moreText, setMoreText] = useState<string>("");

  const reportKey = useMemo(() => {
    if (!appliedFilters?.boqId || !appliedFilters?.month) return null;
    const url = `/api/reports/boq-target-report?boqId=${encodeURIComponent(
      appliedFilters.boqId
    )}&month=${encodeURIComponent(appliedFilters.month)}&_ts=${searchNonce}`;
    return url;
  }, [appliedFilters, searchNonce]);

  const {
    data: report,
    error: reportError,
    isLoading: reportLoading,
    mutate: mutateReport,
  } = useSWR<ReportResponse>(
    reportKey,
    (url: string) => apiGet(url, { headers: { "Cache-Control": "no-store" } }),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 0,
      revalidateIfStale: true,
      shouldRetryOnError: false,
    }
  );

  async function handleSearch() {
    const { boqId, month } = getValues();
    if (!boqId) {
      toast.error("Please select a BOQ");
      return;
    }
    if (!month) {
      toast.error("Please select a month");
      return;
    }

    // Force fresh fetch every time (cache-buster + revalidate)
    setAppliedFilters({ boqId, month });
    setSearchNonce(Date.now());
    // If already applied, explicitly revalidate as well.
    await mutateReport();
  }

  function handleReset() {
    form.reset({ boqId: "", month: "" });
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

  async function handleGenerate() {
    const { boqId, month } = getValues();
    if (!boqId) {
      toast.error("Please select a BOQ");
      return;
    }
    if (!month) {
      toast.error("Please select a month");
      return;
    }

    setDownloading(true);
    try {
      const url = `/api/reports/boq-target-report-excel?boqId=${encodeURIComponent(boqId)}&month=${encodeURIComponent(month)}`;
      const today = new Date().toISOString().slice(0, 10);
      const safeBoq = selectedBoqLabel.replace(/[^a-z0-9\- _]/gi, "").replace(/\s+/g, "-");
      const safeMonth = String(month).replace(/[^a-z0-9\- _]/gi, "").replace(/\s+/g, "-");
      const filename = `boq-target-report-${safeBoq}-${safeMonth}-${today}.xlsx`;
      await downloadFile(url, filename);
    } catch (e: any) {
      toast.error(e?.message || "Failed to generate report");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Form {...form}>
      <AppCard>
        <AppCard.Header>
          <AppCard.Title>BOQ Target Report</AppCard.Title>
          <AppCard.Description>Select BOQ and Month and generate Excel report.</AppCard.Description>
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

            <div>
              <AppSelect
                control={control}
                name="month"
                label="Month"
                placeholder="Select month"
                triggerClassName="h-9 w-full"
              >
                {monthOptions.map((opt) => (
                  <AppSelect.Item key={opt.value} value={opt.value}>
                    {opt.label}
                  </AppSelect.Item>
                ))}
              </AppSelect>
            </div>

            <div className="md:col-span-3 flex flex-wrap justify-end gap-2">
              <AppButton
                type="button"
                onClick={handleSearch}
                disabled={boqsLoading || !selectedBoqId || !selectedMonth}
              >
                Search
              </AppButton>
              <AppButton
                type="button"
                variant="secondary"
                onClick={handleReset}
                disabled={boqsLoading || (!selectedBoqId && !selectedMonth && !appliedFilters)}
              >
                Reset
              </AppButton>

              <AppButton
                type="button"
                onClick={handleGenerate}
                disabled={downloading || boqsLoading || !selectedBoqId || !selectedMonth}
                isLoading={downloading}
              >
                Generate Excel
              </AppButton>
            </div>
          </div>

          {appliedFilters ? (
            <div className="mt-6 space-y-6">
              {reportError ? (
                <div className="text-sm text-destructive">
                  {(reportError as any)?.message || "Failed to load report"}
                </div>
              ) : reportLoading || !report ? (
                <div className="text-sm text-muted-foreground">Loading report...</div>
              ) : (
                <>
                  <div className="space-y-1">
                    <div className="text-sm font-medium">{report.meta.title}</div>
                    <div className="text-xs text-muted-foreground whitespace-normal break-words">
                      BOQ: {report.meta.boqNo}
                      {report.meta.workName ? ` - ${report.meta.workName}` : ""}
                    </div>
                    <div className="text-xs text-muted-foreground">Site: {report.meta.site}</div>
                    <div className="text-xs text-muted-foreground">Month: {report.meta.month}</div>
                    <div className="text-xs text-muted-foreground">
                      Generated On: {report.meta.generatedOn}
                    </div>
                  </div>

                  <div className="w-full overflow-x-auto rounded-md border border-slate-200 dark:border-slate-700">
                    <table className="w-full border-collapse text-xs bg-white dark:bg-slate-950">
                      <thead>
                        {(() => {
                          const fixedCount = 10;
                          const monthSpan = 2;
                          const totalCols = report.table1.headerRow2.length;
                          const weekCount = Math.max(0, (totalCols - fixedCount - monthSpan) / 4);
                          const monthLabel = report.table1.headerRow1[fixedCount] || "Month";
                          const weekLabels = Array.from({ length: weekCount }).map((_, i) =>
                            report.table1.headerRow1[fixedCount + monthSpan + i * 4] || `Week ${i + 1}`
                          );
                          const monthSub1 = report.table1.headerRow2[fixedCount] || "Total Target Qty";
                          const monthSub2 = report.table1.headerRow2[fixedCount + 1] || "Total Executed Qty";
                          const weekSubHeaders = ["Target Qty", "Target Amount", "Executed Qty", "Executed Amount"];

                          return (
                            <>
                              <tr>
                                {report.table1.headerRow1.slice(0, fixedCount).map((h, idx) => (
                                  <th
                                    key={`fx-${idx}`}
                                    rowSpan={2}
                                    className={`border border-slate-200 dark:border-slate-700 px-2 py-2 text-left whitespace-nowrap font-semibold text-white bg-blue-600 ${
                                      idx === 0 ? "sticky left-0 z-40" : ""
                                    }`}
                                  >
                                    {h}
                                  </th>
                                ))}

                                <th
                                  colSpan={2}
                                  className="border border-slate-200 dark:border-slate-700 px-2 py-2 text-center whitespace-nowrap font-semibold text-slate-900 bg-yellow-300"
                                >
                                  {monthLabel}
                                </th>

                                {weekLabels.map((w, i) => (
                                  <th
                                    key={`wk-${i}`}
                                    colSpan={4}
                                    className="border border-slate-200 dark:border-slate-700 px-2 py-2 text-center whitespace-nowrap font-semibold text-slate-900 bg-yellow-300"
                                  >
                                    {w}
                                  </th>
                                ))}
                              </tr>

                              <tr>
                                <th className="border border-slate-200 dark:border-slate-700 px-2 py-2 text-left whitespace-nowrap font-semibold text-slate-900 bg-yellow-200">
                                  {monthSub1}
                                </th>
                                <th className="border border-slate-200 dark:border-slate-700 px-2 py-2 text-left whitespace-nowrap font-semibold text-slate-900 bg-yellow-200">
                                  {monthSub2}
                                </th>
                                {Array.from({ length: weekCount }).map((_, wi) => (
                                  <Fragment key={`wkshg-${wi}`}>
                                    {weekSubHeaders.map((sh, si) => (
                                      <th
                                        key={`wksh-${wi}-${si}`}
                                        className="border border-slate-200 dark:border-slate-700 px-2 py-2 text-left whitespace-nowrap font-semibold text-slate-900 bg-yellow-200"
                                      >
                                        {sh}
                                      </th>
                                    ))}
                                  </Fragment>
                                ))}
                              </tr>
                            </>
                          );
                        })()}
                      </thead>
                      <tbody>
                        {report.table1.rows.map((r, rIdx) => (
                          <tr
                            key={`r-${rIdx}`}
                            className={r.isGroup ? "bg-yellow-50" : rIdx % 2 === 0 ? "bg-white" : "bg-slate-50"}
                          >
                            {r.cells.map((cell, cIdx) => (
                              <td
                                key={`c-${rIdx}-${cIdx}`}
                                className={`border border-slate-200 dark:border-slate-700 px-2 py-1 text-slate-900 ${
                                  cIdx === 0 ? "sticky left-0 z-30 bg-white" : ""
                                } ${cIdx === 1 ? "whitespace-normal break-words min-w-[240px]" : "whitespace-nowrap"} ${
                                  cIdx <= 9 ? "" : "bg-yellow-50"
                                }`}
                              >
                                {cIdx === 1 ? (() => {
                                  const t = truncateWords(cell, 20);
                                  return (
                                    <div className="min-w-[240px]">
                                      <span>{t.short}</span>
                                      {t.hasMore ? (
                                        <button
                                          type="button"
                                          className="ml-1 text-blue-600 hover:underline"
                                          onClick={() => {
                                            setMoreTitle("BOQ Item");
                                            setMoreText(t.full);
                                            setMoreOpen(true);
                                          }}
                                        >
                                          ...more
                                        </button>
                                      ) : null}
                                    </div>
                                  );
                                })() : (renderTable1Cell(cell, cIdx) as any)}
                              </td>
                            ))}
                          </tr>
                        ))}
                        <tr className="font-semibold bg-yellow-100">
                          {report.table1.totalRow.map((cell, idx) => (
                            <td
                              key={`t-${idx}`}
                              className={`border border-slate-200 dark:border-slate-700 px-2 py-2 text-slate-900 ${
                                idx === 0 ? "sticky left-0 z-30 bg-yellow-100" : ""
                              } ${idx === 1 ? "whitespace-normal break-words" : "whitespace-nowrap"} ${
                                idx <= 9 ? "" : "bg-yellow-100"
                              }`}
                            >
                              {idx === 8 || idx === 9
                                ? (renderAmountWithPct(cell) as any)
                                : idx === 1
                                  ? (cell as any)
                                  : (renderTable1Cell(cell, idx) as any)}
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="w-full overflow-x-auto rounded-md border border-slate-200 dark:border-slate-700">
                    <table className="w-full border-collapse text-xs bg-white dark:bg-slate-950">
                      <thead>
                        <tr>
                          {report.table2.header.map((h, idx) => (
                            <th
                              key={`d-h-${idx}`}
                              className={`border border-slate-200 dark:border-slate-700 px-2 py-2 text-left whitespace-nowrap font-semibold ${
                                idx === 0
                                  ? "sticky left-0 z-40 text-white bg-blue-600"
                                  : idx <= 4
                                    ? "text-white bg-blue-600"
                                    : "text-slate-900 bg-yellow-300"
                              }`}
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {report.table2.rows.map((row, rIdx) => (
                          <tr
                            key={`d-r-${rIdx}`}
                            className={rIdx % 2 === 0 ? "bg-white" : "bg-slate-50"}
                          >
                            {row.map((cell, cIdx) => (
                              <td
                                key={`d-c-${rIdx}-${cIdx}`}
                                className={`border border-slate-200 dark:border-slate-700 px-2 py-1 text-slate-900 ${
                                  cIdx === 0 ? "sticky left-0 z-30 bg-white" : ""
                                } ${cIdx === 1 ? "whitespace-normal break-words min-w-[240px]" : "whitespace-nowrap"} ${
                                  cIdx <= 4 ? "" : "bg-yellow-50"
                                }`}
                              >
                                {cIdx === 1 ? (() => {
                                  const t = truncateWords(cell, 20);
                                  return (
                                    <div className="min-w-[240px]">
                                      <span>{t.short}</span>
                                      {t.hasMore ? (
                                        <button
                                          type="button"
                                          className="ml-1 text-blue-600 hover:underline"
                                          onClick={() => {
                                            setMoreTitle("BOQ Item");
                                            setMoreText(t.full);
                                            setMoreOpen(true);
                                          }}
                                        >
                                          ...more
                                        </button>
                                      ) : null}
                                    </div>
                                  );
                                })() : (renderTable2Cell(cell, cIdx, row.length) as any)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          ) : null}

          <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>{moreTitle}</DialogTitle>
                <DialogDescription className="whitespace-pre-wrap break-words">{moreText}</DialogDescription>
              </DialogHeader>
            </DialogContent>
          </Dialog>
        </AppCard.Content>
      </AppCard>
    </Form>
  );
}
