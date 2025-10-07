"use client";
import useSWR from "swr";
import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/lib/toast";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function WageSheetPage() {
  const search = useSearchParams();
  const [period, setPeriod] = useState("");
  const [mode, setMode] = useState<"company" | "govt" | "all">("all");
  const [siteId, setSiteId] = useState<string>("all");
  const [exportType, setExportType] = useState<"none" | "excel" | "pdf">("none");

  // Build last 24 months options MM-YYYY
  const periodOptions = useMemo(() => {
    const opts: string[] = [];
    const now = new Date();
    for (let i = 0; i < 24; i++) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
      const yyyy = d.getUTCFullYear();
      opts.push(`${mm}-${yyyy}`);
    }
    return opts;
  }, []);

  useEffect(() => {
    const m = search.get("mode");
    if (m === "company" || m === "govt") setMode(m);
    const p = search.get("period");
    if (p) setPeriod(p);
    const s = search.get("siteId");
    if (s) setSiteId(s); else setSiteId("all");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sitesQuery = "/api/sites";
  const sites = useSWR(sitesQuery, fetcher);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (period) params.set("period", period);
    if (siteId && siteId !== "all") params.set("siteId", siteId);
    if (mode !== "all") params.set("mode", mode);
    const qs = params.toString();
    return "/api/reports/wage-sheet" + (qs ? `?${qs}` : "");
  }, [period, mode, siteId]);

  const { data, isLoading, mutate } = useSWR(query, fetcher);

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

  function exportExcel() {
    if (!/^\d{2}-\d{4}$/.test(period)) {
      toast.error("Select a period (MM-YYYY)");
      return;
    }
    const params = new URLSearchParams();
    params.set("period", period);
    if (siteId && siteId !== "all") params.set("siteId", siteId);
    if (mode !== "all") params.set("mode", mode);
    const url = `/api/reports/wage-sheet.xlsx?${params.toString()}`;
    const fname = `wage-sheet-${period}${mode !== "all" ? `-${mode}` : ""}.xlsx`;
    downloadFile(url, fname);
  }

  function exportPdf() {
    if (!/^\d{2}-\d{4}$/.test(period)) {
      toast.error("Select a period (MM-YYYY)");
      return;
    }
    const params = new URLSearchParams();
    params.set("period", period);
    if (siteId && siteId !== "all") params.set("siteId", siteId);
    if (mode !== "all") params.set("mode", mode);
    const url = `/api/reports/wage-sheet-pdf?${params.toString()}`;
    const fname = `wage-sheet-${period}${mode !== "all" ? `-${mode}` : ""}.pdf`;
    downloadFile(url, fname);
  }

  function handleShow() {
    if (!/^\d{2}-\d{4}$/.test(period)) {
      toast.error("Select a period (MM-YYYY)");
      return;
    }
    if (exportType === "excel") {
      exportExcel();
    } else if (exportType === "pdf") {
      exportPdf();
    } else {
      mutate();
    }
  }

  const title = mode === "govt" ? "Monthly Wage Sheet As Per Minimum Wage" : "Monthly Wage Sheet As Per Company Rates";

  return (
    <div className="space-y-6">
      <div className="border rounded-md overflow-hidden">
        <div className="bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold">{title}</div>
        <div className="p-4 bg-muted/30">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
            <div>
              <label className="block text-sm mb-1">Site</label>
              <Select value={siteId} onValueChange={(v) => setSiteId(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="---" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sites</SelectItem>
                  {sites.data?.data?.map((s: any) => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.site}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm mb-1">Period</label>
              <Select value={period} onValueChange={(v) => setPeriod(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="---" />
                </SelectTrigger>
                <SelectContent>
                  {periodOptions.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm mb-1">Export</label>
              <Select value={exportType} onValueChange={(v) => setExportType(v as any)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="---" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">---</SelectItem>
                  <SelectItem value="excel">Excel</SelectItem>
                  <SelectItem value="pdf">PDF</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <Button onClick={handleShow} disabled={!/^\d{2}-\d{4}$/.test(period)}>Show</Button>
          </div>
        </div>
      </div>

      <div className="overflow-auto border rounded-md">
        <table className="min-w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="p-2 text-left">Site</th>
              <th className="p-2 text-left">Manpower</th>
              <th className="p-2 text-left">Supplier</th>
              <th className="p-2 text-right">Days</th>
              <th className="p-2 text-right">OT</th>
              <th className="p-2 text-right">Wage</th>
              <th className="p-2 text-right">Gross</th>
              <th className="p-2 text-right">HRA</th>
              <th className="p-2 text-right">PF</th>
              <th className="p-2 text-right">ESIC</th>
              <th className="p-2 text-right">PT</th>
              <th className="p-2 text-right">MLWF</th>
              <th className="p-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={13} className="p-4">Loading...</td></tr>
            ) : !data?.data?.length ? (
              <tr><td colSpan={13} className="p-4">No data</td></tr>
            ) : (
              data.data.map((r: any, idx: number) => (
                <tr key={idx} className="border-t">
                  <td className="p-2">{r.siteName}</td>
                  <td className="p-2">{r.manpowerName}</td>
                  <td className="p-2">{r.supplier ?? ""}</td>
                  <td className="p-2 text-right">{Number(r.workingDays).toFixed(2)}</td>
                  <td className="p-2 text-right">{Number(r.ot).toFixed(2)}</td>
                  <td className="p-2 text-right">{Number(r.wages).toFixed(2)}</td>
                  <td className="p-2 text-right">{Number(r.grossWages).toFixed(2)}</td>
                  <td className="p-2 text-right">{Number(r.hra).toFixed(2)}</td>
                  <td className="p-2 text-right">{Number(r.pf).toFixed(2)}</td>
                  <td className="p-2 text-right">{Number(r.esic).toFixed(2)}</td>
                  <td className="p-2 text-right">{Number(r.pt).toFixed(2)}</td>
                  <td className="p-2 text-right">{Number(r.mlwf).toFixed(2)}</td>
                  <td className="p-2 text-right">{Number(r.total).toFixed(2)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!!data?.summary?.length && (
        <div className="overflow-auto border rounded-md">
          <table className="min-w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="p-2 text-left">Site</th>
                <th className="p-2 text-right">Days</th>
                <th className="p-2 text-right">OT</th>
                <th className="p-2 text-right">Gross</th>
                <th className="p-2 text-right">HRA</th>
                <th className="p-2 text-right">PF</th>
                <th className="p-2 text-right">ESIC</th>
                <th className="p-2 text-right">PT</th>
                <th className="p-2 text-right">MLWF</th>
                <th className="p-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.summary.map((s: any, idx: number) => (
                <tr key={idx} className="border-t">
                  <td className="p-2">{s.siteName}</td>
                  <td className="p-2 text-right">{Number(s.workingDays).toFixed(2)}</td>
                  <td className="p-2 text-right">{Number(s.ot).toFixed(2)}</td>
                  <td className="p-2 text-right">{Number(s.grossWages).toFixed(2)}</td>
                  <td className="p-2 text-right">{Number(s.hra).toFixed(2)}</td>
                  <td className="p-2 text-right">{Number(s.pf).toFixed(2)}</td>
                  <td className="p-2 text-right">{Number(s.esic).toFixed(2)}</td>
                  <td className="p-2 text-right">{Number(s.pt).toFixed(2)}</td>
                  <td className="p-2 text-right">{Number(s.mlwf).toFixed(2)}</td>
                  <td className="p-2 text-right">{Number(s.total).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
