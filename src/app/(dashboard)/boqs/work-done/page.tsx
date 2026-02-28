"use client";

import useSWR from "swr";
import { useMemo, useState, useEffect } from "react";
import { AppCard } from "@/components/common";
import { DataTable, Column } from "@/components/common/data-table";
import type { SortState } from "@/components/common/data-table";
import { Pagination } from "@/components/common/pagination";
import { useProtectPage } from "@/hooks/use-protect-page";
import { useQueryParamsState } from "@/hooks/use-query-params-state";
import { apiGet } from "@/lib/api-client";
import { AppCombobox } from "@/components/common/app-combobox";
import { AppButton } from "@/components/common/app-button";
import { toast } from "@/lib/toast";

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
}

export default function WorkDoneListPage() {
  useProtectPage();

  const [qp, setQp] = useQueryParamsState({
    boqId: "",
  });

  const { boqId } = qp as unknown as {
    boqId: string;
  };

  const [selectedBoqId, setSelectedBoqId] = useState<string>(boqId || "");

  useEffect(() => {
    setSelectedBoqId(boqId || "");
  }, [boqId]);

  const query = useMemo(() => {
    if (!selectedBoqId) return null;
    const sp = new URLSearchParams();
    sp.set("boqId", selectedBoqId);
    return `/api/boqs/work-done?${sp.toString()}`;
  }, [selectedBoqId]);

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

  const selectedBoqLabel = useMemo(() => {
    if (!selectedBoqId) return "boq";
    const b = (boqsOptions?.data || []).find((x: any) => String(x.id) === selectedBoqId);
    const boqNo = b?.boqNo || b?.workName || `BOQ-${selectedBoqId}`;
    return `${boqNo}${b?.site?.site ? `-${b.site.site}` : ""}`;
  }, [boqsOptions?.data, selectedBoqId]);

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
    if (!selectedBoqId) {
      toast.error("Please select a BOQ");
      return;
    }
    setDownloading(true);
    try {
      const url = `/api/boqs/work-done-excel?boqId=${encodeURIComponent(selectedBoqId)}`;
      const today = new Date().toISOString().slice(0, 10);
      const safe = selectedBoqLabel
        .replace(/[^a-z0-9\- _]/gi, "")
        .replace(/\s+/g, "-")
        .toLowerCase();
      const filename = `work-done-${safe}-${today}.xlsx`;
      await downloadFile(url, filename);
    } catch (e: any) {
      toast.error(e?.message || "Failed to export excel");
    } finally {
      setDownloading(false);
    }
  }

  const tableData: Row[] = selectedBoqId ? (data?.data || []) : [];

  const fmt = (num: number, suffix = "") =>
    `${Number(num || 0).toFixed(2)}${suffix}`;
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
            <div className="flex flex-col md:flex-row md:items-end gap-2">
              <div className="w-72">
                <AppCombobox
                  value={selectedBoqId}
                  onValueChange={(val) => {
                    setSelectedBoqId(val);
                    setQp({ boqId: val });
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

              <div className="md:ml-auto">
                <AppButton
                  type="button"
                  onClick={handleExportExcel}
                  disabled={!selectedBoqId || downloading}
                  isLoading={downloading}
                >
                  Export Excel
                </AppButton>
              </div>
            </div>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={tableData}
          loading={!!selectedBoqId && isLoading}
          minTableWidth={1400}
        />
      </AppCard.Content>
      <AppCard.Footer className="justify-between items-center flex-wrap gap-4">
        <div className="text-sm text-muted-foreground">
          {selectedBoqId
            ? "Showing all items for selected BOQ."
            : "Select a BOQ to view work done."}
        </div>
        {selectedBoqId && (
          <div className="flex flex-wrap gap-4 text-sm">
            <div>
              <span className="font-semibold">Total BOQ Amount: </span>
              {Number(data?.totals?.amount || 0).toFixed(2)}
            </div>
            <div>
              <span className="font-semibold">Executed Amount: </span>
              {Number(data?.totals?.orderedAmount || 0).toFixed(2)}
            </div>
            <div>
              <span className="font-semibold">Remaining Amount: </span>
              {Number(data?.totals?.remainingAmount || 0).toFixed(2)}
            </div>
            <div>
              <span className="font-semibold">Executed % (Total): </span>
              {Number(data?.totals?.orderedPctTotal || 0).toFixed(2)}%
            </div>
            <div>
              <span className="font-semibold">Remaining % (Total): </span>
              {Number(data?.totals?.remainingPctTotal || 0).toFixed(2)}%
            </div>
          </div>
        )}
      </AppCard.Footer>
    </AppCard>
  );
}
