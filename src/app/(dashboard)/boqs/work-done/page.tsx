"use client";

import useSWR from "swr";
import { useMemo, useState } from "react";
import { AppCard } from "@/components/common";
import { DataTable, Column } from "@/components/common/data-table";
import { useProtectPage } from "@/hooks/use-protect-page";
import { apiGet } from "@/lib/api-client";
import { AppCombobox } from "@/components/common/app-combobox";
import { AppButton } from "@/components/common/app-button";
import { toast } from "@/lib/toast";
import { formatNumber } from "@/lib/locales";

interface Row {
  clientSrNo?: string | null;
  id: number;
  boqId: number;
  boqNo: string;
  siteId: number | null;
  site: string;
  itemId: number;
  description: string;
  qty: number;
  unit: string | null;
  orderedQty: number;
  remainingQty: number;
  rate: number;
  amount: number;
  orderedAmount: number;
  remainingAmount: number;
  orderedPct?: number;
  remainingPct?: number;
  dailyDone?: Record<string, number>;
}

interface ListResponse {
  data: Row[];
  totals?: {
    amount: number;
    orderedAmount: number;
    remainingAmount: number;
    orderedPctTotal: number;
    remainingPctTotal: number;
  };
  monthly?: Array<{
    month: string;
    label: string;
    dates?: string[];
    data: Row[];
    totals?: {
      amount: number;
      orderedAmount: number;
      remainingAmount: number;
      orderedPctTotal: number;
      remainingPctTotal: number;
    };
  }>;
}

export default function WorkDoneListPage() {
  useProtectPage();

  const [selectedBoqId, setSelectedBoqId] = useState<string>("");
  const [appliedBoqId, setAppliedBoqId] = useState<string>("");

  const [fromMonthDraft, setFromMonthDraft] = useState<string>("");
  const [toMonthDraft, setToMonthDraft] = useState<string>("");
  const [fromMonth, setFromMonth] = useState<string>("");
  const [toMonth, setToMonth] = useState<string>("");
  const [searchNonce, setSearchNonce] = useState<number>(0);

  const currentMonthMax = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  }, []);

  const fmtMonth = (m: string) => {
    if (!m) return "";
    const [yy, mm] = String(m).split("-");
    const y = Number(yy);
    const mo = Number(mm);
    if (!Number.isFinite(y) || !Number.isFinite(mo)) return m;
    const d = new Date(Date.UTC(y, mo - 1, 1));
    return d.toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
  };

  const query = useMemo(() => {
    if (!appliedBoqId) return null;
    if (!fromMonth || !toMonth) return null;
    const sp = new URLSearchParams();
    sp.set("boqId", appliedBoqId);
    sp.set("fromMonth", fromMonth);
    sp.set("toMonth", toMonth);
    sp.set("_", String(searchNonce));
    return `/api/boqs/work-done?${sp.toString()}`;
  }, [appliedBoqId, fromMonth, toMonth, searchNonce]);

  const { data, isLoading } = useSWR<ListResponse>(query, apiGet, {
    revalidateOnFocus: false,
    revalidateIfStale: false,
    revalidateOnReconnect: false,
  });
  const { data: boqsOptions } = useSWR<any>("/api/boqs?perPage=100", apiGet);

  const [downloading, setDownloading] = useState(false);

  const selectedSiteName = useMemo(() => {
    if (!selectedBoqId) return "-";
    return (
      (boqsOptions?.data || []).find((b: any) => String(b.id) === selectedBoqId)?.site
        ?.site ?? "-"
    );
  }, [boqsOptions?.data, selectedBoqId]);

  const appliedSiteName = useMemo(() => {
    if (!appliedBoqId) return "-";
    return (
      (boqsOptions?.data || []).find((b: any) => String(b.id) === appliedBoqId)?.site
        ?.site ?? "-"
    );
  }, [boqsOptions?.data, appliedBoqId]);

  const selectedBoqLabel = useMemo(() => {
    if (!selectedBoqId) return "boq";
    const b = (boqsOptions?.data || []).find((x: any) => String(x.id) === selectedBoqId);
    const boqNo = b?.boqNo || b?.workName || `BOQ-${selectedBoqId}`;
    return `${boqNo}${b?.site?.site ? `-${b.site.site}` : ""}`;
  }, [boqsOptions?.data, selectedBoqId]);

  const appliedBoqLabel = useMemo(() => {
    if (!appliedBoqId) return "boq";
    const b = (boqsOptions?.data || []).find((x: any) => String(x.id) === appliedBoqId);
    const boqNo = b?.boqNo || b?.workName || `BOQ-${appliedBoqId}`;
    return `${boqNo}${b?.site?.site ? `-${b.site.site}` : ""}`;
  }, [boqsOptions?.data, appliedBoqId]);

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
    if (!appliedBoqId) {
      toast.error("Please select a BOQ");
      return;
    }
    if (!fromMonth || !toMonth) {
      toast.error("Please select From Month and To Month and click Search");
      return;
    }
    setDownloading(true);
    try {
      const sp = new URLSearchParams();
      sp.set("boqId", appliedBoqId);
      sp.set("fromMonth", fromMonth);
      sp.set("toMonth", toMonth);
      const url = `/api/boqs/work-done-excel?${sp.toString()}`;
      const today = new Date().toISOString().slice(0, 10);
      const safe = appliedBoqLabel
        .replace(/[^a-z0-9\- _]/gi, "")
        .replace(/\s+/g, "-")
        .toLowerCase();
      const filename = `work-done-${safe}-${fromMonth}-to-${toMonth}-${today}.xlsx`;
      await downloadFile(url, filename);
    } catch (e: any) {
      toast.error(e?.message || "Failed to export excel");
    } finally {
      setDownloading(false);
    }
  }

  function handleSearch() {
    if (!selectedBoqId) {
      toast.error("Please select a BOQ");
      return;
    }
    if (!fromMonthDraft || !toMonthDraft) {
      toast.error("Please select From Month and To Month");
      return;
    }
    if (String(fromMonthDraft) > String(toMonthDraft)) {
      toast.error("From Month cannot be greater than To Month");
      return;
    }
    if (String(toMonthDraft) > String(currentMonthMax)) {
      toast.error("To Month cannot be greater than current month");
      return;
    }
    setAppliedBoqId(selectedBoqId);
    setFromMonth(fromMonthDraft);
    setToMonth(toMonthDraft);
    setSearchNonce((n) => n + 1);
  }

  function handleReset() {
    setSelectedBoqId("");
    setFromMonthDraft("");
    setToMonthDraft("");
    setAppliedBoqId("");
    setFromMonth("");
    setToMonth("");
    setSearchNonce((n) => n + 1);
  }

  const tableData: Row[] = appliedBoqId && fromMonth && toMonth ? (data?.data || []) : [];

  const fmt = (num: number, suffix = "") =>
    `${formatNumber(Number(num || 0), {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}${suffix}`;
  const highlight = (num: number, suffix = "") => {
    const isNeg = Number(num) < 0;
    const content = fmt(num, suffix);
    if (!isNeg) return content;
    return (
      <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded">
        {content}
      </span>
    );
  };

  const columns: Column<Row>[] = [
    { key: "clientSrNo", header: "Client Sr. No.", accessor: (r) => r.clientSrNo || "-" },
    { key: "description", header: "BOQ Item Description", accessor: (r) => r.description, sortable: false },
    { key: "qty", header: "BOQ Qty", accessor: (r) => highlight(r.qty), sortable: false, className: "text-right", cellClassName: "text-right" },
    { key: "unit", header: "Unit", accessor: (r) => r.unit || "-", sortable: false },
    { key: "orderedQty", header: "Executed Qty", accessor: (r) => highlight(r.orderedQty), sortable: false, className: "text-right", cellClassName: "text-right" },
    { key: "remainingQty", header: "Remaining Qty", accessor: (r) => highlight(r.remainingQty), sortable: false, className: "text-right", cellClassName: "text-right" },
    { key: "rate", header: "Rate", accessor: (r) => fmt(r.rate), sortable: false, className: "text-right", cellClassName: "text-right" },
    { key: "amount", header: "BOQ Amount", accessor: (r) => highlight(r.amount), sortable: false, className: "text-right", cellClassName: "text-right" },
    { key: "orderedAmount", header: "Executed Amount", accessor: (r) => highlight(r.orderedAmount), sortable: false, className: "text-right", cellClassName: "text-right" },
    { key: "remainingAmount", header: "Remaining Amount", accessor: (r) => highlight(r.remainingAmount), sortable: false, className: "text-right", cellClassName: "text-right" },
    { key: "orderedPct", header: "Executed %", accessor: (r) => highlight(r.orderedPct ?? 0, "%"), sortable: false, className: "text-right", cellClassName: "text-right" },
    { key: "remainingPct", header: "Remaining %", accessor: (r) => highlight(r.remainingPct ?? 0, "%"), sortable: false, className: "text-right", cellClassName: "text-right" },
  ];

  const getMonthlyColumns = (dates: string[]): Column<Row>[] => {
    if (!dates.length) return columns;
    const dateCols: Column<Row>[] = dates.map((d) => ({
      key: `d_${d}`,
      header: d,
      accessor: (r) => highlight(Number(r.dailyDone?.[d] || 0)),
      sortable: false,
      className: "text-right",
      cellClassName: "text-right",
    }));
    return [...columns.slice(0, 4), ...dateCols, ...columns.slice(4)];
  };

  return (
    <AppCard>
      <AppCard.Header>
        <div>
          <AppCard.Title>Work Done</AppCard.Title>
          <AppCard.Description>List of BOQ items with executed/remaining quantities and amounts.</AppCard.Description>
        </div>
      </AppCard.Header>
      <AppCard.Content>
        <div className="flex flex-col gap-3 mb-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="text-sm font-semibold">Search</div>
              <div className="text-xs text-muted-foreground">
                Select a BOQ to view its work done summary.
              </div>
              {selectedBoqId && (
                <div className="text-xs text-muted-foreground">
                  Site:{" "}
                  {selectedSiteName}
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-6 gap-2 items-end">
              <div className="w-full md:col-span-2">
                <div className="text-xs font-medium mb-1">Site / BOQ</div>
                <AppCombobox
                  value={selectedBoqId}
                  onValueChange={(val) => {
                    setSelectedBoqId(val);
                  }}
                  options={(boqsOptions?.data || []).map((b: any) => ({
                    value: String(b.id),
                    label: `${b.boqNo || b.workName || `BOQ #${b.id}`}${b?.site?.site ? ` - ${b.site.site}` : ""}`,
                  }))}
                  placeholder="Select BOQ"
                  searchPlaceholder="Search BOQ..."
                  emptyText="No BOQ found"
                />
              </div>

              <div className="w-full md:col-span-1">
                <div className="text-xs font-medium mb-1">From Month</div>
                <input
                  type="month"
                  value={fromMonthDraft}
                  onChange={(e) => setFromMonthDraft(e.target.value)}
                  max={currentMonthMax}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="From Month"
                />
              </div>
              <div className="w-full md:col-span-1">
                <div className="text-xs font-medium mb-1">To Month</div>
                <input
                  type="month"
                  value={toMonthDraft}
                  onChange={(e) => setToMonthDraft(e.target.value)}
                  max={currentMonthMax}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="To Month"
                />
              </div>

              <div className="w-full md:col-span-1">
                <AppButton type="button" onClick={handleSearch} disabled={!selectedBoqId}>
                  Search
                </AppButton>
              </div>

              <div className="w-full md:col-span-1 flex gap-2 md:justify-end">
                <AppButton
                  type="button"
                  variant="secondary"
                  onClick={handleReset}
                  disabled={!selectedBoqId && !fromMonthDraft && !toMonthDraft && !appliedBoqId && !fromMonth && !toMonth}
                >
                  Reset
                </AppButton>

                <AppButton
                  type="button"
                  onClick={handleExportExcel}
                  disabled={!appliedBoqId || !fromMonth || !toMonth || downloading}
                  isLoading={downloading}
                >
                  Export Excel
                </AppButton>
              </div>
            </div>
          </div>
        </div>

        {appliedBoqId && fromMonth && toMonth ? (
          <div className="rounded-md border-2 border-primary/30 bg-muted/20 p-3">
            <div className="mb-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="text-lg font-semibold">Total Work Done</div>
                <div className="text-xs font-semibold px-2 py-1 rounded bg-primary/10 text-primary">
                  OVERALL
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                Data searched for {appliedSiteName} from {fmtMonth(fromMonth)} to {fmtMonth(toMonth)}.
              </div>
            </div>

            <DataTable
              columns={columns}
              data={tableData}
              loading={!!appliedBoqId && !!fromMonth && !!toMonth && isLoading}
              stickyColumns={1}
              minTableWidth={1400}
            />

            <div className="mt-3 flex flex-wrap gap-4 text-sm">
              <div className="text-sm text-muted-foreground w-full">Showing all items for selected BOQ.</div>
              <div>
                <span className="font-semibold">Total BOQ Amount: </span>
                {formatNumber(Number(data?.totals?.amount || 0), {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
              <div>
                <span className="font-semibold">Executed Amount: </span>
                {formatNumber(Number(data?.totals?.orderedAmount || 0), {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
              <div>
                <span className="font-semibold">Remaining Amount: </span>
                {formatNumber(Number(data?.totals?.remainingAmount || 0), {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
              <div>
                <span className="font-semibold">Executed % (Total): </span>
                {formatNumber(Number(data?.totals?.orderedPctTotal || 0), {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}%
              </div>
              <div>
                <span className="font-semibold">Remaining % (Total): </span>
                {formatNumber(Number(data?.totals?.remainingPctTotal || 0), {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}%
              </div>
            </div>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={tableData}
            loading={!!appliedBoqId && !!fromMonth && !!toMonth && isLoading}
            stickyColumns={1}
            minTableWidth={1400}
          />
        )}

        {([...(data?.monthly || [])].reverse() || []).map((m) => (
          <div key={m.month} className="mt-6 rounded-md border bg-background p-3">
            <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
              <div className="text-sm font-semibold">Work Done from {m.label}</div>
              <div className="text-xs font-semibold px-2 py-1 rounded bg-muted text-muted-foreground">
                MONTHLY
              </div>
            </div>
            <DataTable
              columns={getMonthlyColumns(m.dates || [])}
              data={m.data || []}
              loading={false}
              stickyColumns={1}
              minTableWidth={1400 + (m.dates || []).length * 120}
            />
            <div className="mt-3 flex flex-wrap gap-4 text-sm">
              <div>
                <span className="font-semibold">Total BOQ Amount: </span>
                {formatNumber(Number(m?.totals?.amount || 0), {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
              <div>
                <span className="font-semibold">Executed Amount: </span>
                {formatNumber(Number(m?.totals?.orderedAmount || 0), {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
              <div>
                <span className="font-semibold">Remaining Amount: </span>
                {formatNumber(Number(m?.totals?.remainingAmount || 0), {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
              <div>
                <span className="font-semibold">Executed % (Total): </span>
                {formatNumber(Number(m?.totals?.orderedPctTotal || 0), {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}%
              </div>
              <div>
                <span className="font-semibold">Remaining % (Total): </span>
                {formatNumber(Number(m?.totals?.remainingPctTotal || 0), {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}%
              </div>
            </div>
          </div>
        ))}
      </AppCard.Content>
    </AppCard>
  );
}
