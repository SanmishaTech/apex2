"use client";
import useSWR from "swr";
import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/lib/toast";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function WageSheetPage() {
  const search = useSearchParams();
  const [period, setPeriod] = useState("");
  const [mode, setMode] = useState<"company" | "govt" | "all">("govt");
  const [siteId, setSiteId] = useState<string>("all");
  const [exportType, setExportType] = useState<"none" | "excel" | "pdf">(
    "none"
  );

  // Build last 24 months options MM-YYYY
  const periodOptions = useMemo(() => {
    const opts: string[] = [];
    const now = new Date();
    for (let i = 0; i < 24; i++) {
      const d = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)
      );
      const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
      const yyyy = d.getUTCFullYear();
      opts.push(`${mm}-${yyyy}`);
    }
    return opts;
  }, []);

  useEffect(() => {
    const m = search?.get("mode");
    if (m === "company" || m === "govt") {
      setMode(m);
    }
    const p = search?.get("period");
    if (p) setPeriod(p);
    const s = search?.get("siteId");
    if (s) {
      setSiteId(s);
    } else {
      setSiteId("all");
    }
  }, [search]);

  const sitesQuery = "/api/sites/options";
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
    const fname = `wage-sheet-${period}${
      mode !== "all" ? `-${mode}` : ""
    }.xlsx`;
    downloadFile(url, fname);
  }

  async function exportPdf() {
    if (!/^\d{2}-\d{4}$/.test(period)) {
      toast.error("Select a period (MM-YYYY)");
      return;
    }

    // PDF export now available for both modes

    try {
      // Fetch detailed daily attendance data
      const params = new URLSearchParams();
      params.set("period", period);
      if (siteId && siteId !== "all") params.set("siteId", siteId);
      params.set("mode", mode);
      const url = `/api/reports/wage-sheet-details?${params.toString()}`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Failed to fetch wage sheet data");
      }

      const wageData = await response.json();
      const pdfBlob = await generateWageSheetPDF(
        wageData,
        period,
        siteId !== "all"
          ? sites.data?.data?.find((s: any) => String(s.id) === siteId)?.site
          : "All Sites"
      );

      // Open PDF in new tab
      const pdfUrl = URL.createObjectURL(pdfBlob);
      window.open(pdfUrl, "_blank");

      // Clean up the URL after a delay
      setTimeout(() => URL.revokeObjectURL(pdfUrl), 10000);

      toast.success("PDF opened in new tab");
    } catch (error: any) {
      console.error("PDF export error:", error);
      toast.error(error?.message || "Failed to generate PDF");
    }
  }

  function generateWageSheetPDF(
    wageData: any,
    period: string,
    siteName: string
  ) {
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a3",
    });

    const daysInMonth = wageData.daysInMonth || 31;
    const [mm, yyyy] = period.split("-");
    const monthName = new Date(Number(yyyy), Number(mm) - 1).toLocaleString(
      "en",
      { month: "long" }
    );

    // Header
    doc.setFontSize(14);
    doc.text("ABCD COMPANY LTD", 14, 15);
    doc.text("APEX Constructions", 370, 15);

    doc.setFontSize(12);
    doc.text(
      `Report : Monthly Wage Sheet As Per ${
        mode === "govt" ? "Minimum Wage" : "Company Rates"
      }`,
      14,
      22
    );

    doc.setFontSize(10);
    doc.text(`Site : ${siteName || "All Sites"}`, 14, 29);
    doc.text(`Period : ${monthName} / ${yyyy}`, 14, 35);

    let startY = 42;

    // Process each site group
    wageData.data.forEach((siteGroup: any, siteIdx: number) => {
      if (siteIdx > 0) {
        doc.addPage();
        startY = 20;
        doc.setFontSize(11);
        doc.text(`Site: ${siteGroup.siteName}`, 14, startY - 5);
      } else if (wageData.data.length > 1) {
        doc.setFontSize(11);
        doc.text(`Site: ${siteGroup.siteName}`, 14, startY - 5);
      }

      // Build table headers - Fixed columns + Day columns + Summary columns
      const headers: string[] = [
        "Sr.",
        "Name",
        "Designation",
        "UNA No",
        "ESIC No",
      ];

      // Add Rate column for company mode
      if (mode === "company") {
        headers.push("Rate");
      } else {
        headers.push("Skill Set");
      }

      // Add day columns (1-31)
      for (let day = 1; day <= daysInMonth; day++) {
        headers.push(String(day));
      }

      // Add summary columns based on mode
      if (mode === "govt") {
        headers.push(
          "Total Days",
          "Wage Rate",
          "Gross Wage",
          "HB @5%",
          "Total PF @12%",
          "ESI",
          "PT",
          "LWF",
          "Total Deduction",
          "Payable"
        );
      } else {
        // Company rates columns
        headers.push(
          "Working Days",
          "OT",
          "Actual Wages",
          "Idle Days",
          "Idle Wages",
          "Total Wages"
        );
      }

      // Group workers by supplier for company mode
      let groupedWorkers = siteGroup.workers;
      if (mode === "company") {
        const supplierGroups: { [key: string]: any[] } = {};
        siteGroup.workers.forEach((worker: any) => {
          const supplierKey = worker.supplierName || "No Supplier";
          if (!supplierGroups[supplierKey]) {
            supplierGroups[supplierKey] = [];
          }
          supplierGroups[supplierKey].push(worker);
        });

        // Flatten grouped workers with supplier headers
        groupedWorkers = [];
        Object.entries(supplierGroups).forEach(([supplier, workers]) => {
          groupedWorkers.push({
            isSupplierHeader: true,
            supplierName: supplier,
          });
          groupedWorkers.push(...workers);
        });
      }

      // Build table body
      const body: any[] = [];
      let totalGross = 0,
        totalHra = 0,
        totalPf = 0,
        totalEsic = 0,
        totalPt = 0,
        totalLwf = 0,
        totalDeduction = 0,
        totalPayable = 0;
      let totalWorkingDays = 0,
        totalOT = 0,
        totalActualWages = 0,
        totalIdleDays = 0,
        totalIdleWages = 0,
        totalTotalWages = 0;
      let supplierTotals: any = null;
      let workerIndex = 1;

      groupedWorkers.forEach((item: any, idx: number) => {
        if (item.isSupplierHeader) {
          // Add supplier totals for previous group if exists
          if (supplierTotals && mode === "company") {
            const supplierTotalRow: any[] = ["", "Total", "", "", "", ""];
            for (let i = 0; i < daysInMonth; i++) supplierTotalRow.push("");
            supplierTotalRow.push(
              supplierTotals.workingDays.toFixed(2),
              supplierTotals.ot.toFixed(2),
              supplierTotals.actualWages.toFixed(2),
              supplierTotals.idleDays.toFixed(2),
              supplierTotals.idleWages.toFixed(2),
              supplierTotals.totalWages.toFixed(2)
            );
            body.push(supplierTotalRow);
          }

          // Add supplier header row as a regular row with merged cells
          const supplierHeaderRow = new Array(
            6 + daysInMonth + (mode === "govt" ? 10 : 6)
          ).fill("");
          supplierHeaderRow[1] = item.supplierName; // Put supplier name in second column
          body.push(supplierHeaderRow);

          // Reset supplier totals
          supplierTotals = {
            workingDays: 0,
            ot: 0,
            actualWages: 0,
            idleDays: 0,
            idleWages: 0,
            totalWages: 0,
          };
          return;
        }

        const worker = item;
        const row: any[] = [
          workerIndex++,
          worker.manpowerName,
          worker.designation || "-",
          worker.unaNo || "-",
          worker.esicNo || "-",
        ];

        // Add Rate or Skill Set based on mode
        if (mode === "company") {
          row.push(worker.wageRate?.toFixed(2) || "-");
        } else {
          row.push(worker.skillSet || "-");
        }

        // Add daily attendance (P/A/I/O)
        worker.dailyAttendance.forEach((status: string) => {
          row.push(status || "-");
        });

        // Add summary values based on mode
        if (mode === "govt") {
          row.push(
            worker.totalDays.toFixed(0),
            worker.wageRate.toFixed(2),
            worker.grossWage.toFixed(2),
            worker.hra.toFixed(2),
            worker.pf.toFixed(2),
            worker.esic.toFixed(2),
            worker.pt.toFixed(2),
            worker.lwf.toFixed(2),
            worker.totalDeduction.toFixed(2),
            worker.payable.toFixed(2)
          );
        } else {
          // Company rates columns
          row.push(
            worker.workingDays?.toFixed(2) || "0.00",
            worker.totalOT?.toFixed(2) || "0.00",
            worker.actualWages?.toFixed(2) || "0.00",
            (Number(worker.idleDays || 0) + Number(worker.idleOT || 0)).toFixed(
              2
            ),
            worker.idleWages?.toFixed(2) || "0.00",
            worker.totalWages?.toFixed(2) || "0.00"
          );
        }

        body.push(row);

        // Update totals based on mode
        if (mode === "govt") {
          totalGross += worker.grossWage || 0;
          totalHra += worker.hra || 0;
          totalPf += worker.pf || 0;
          totalEsic += worker.esic || 0;
          totalPt += worker.pt || 0;
          totalLwf += worker.lwf || 0;
          totalDeduction += worker.totalDeduction || 0;
          totalPayable += worker.payable || 0;
        } else {
          // Company mode totals
          totalWorkingDays += Number(worker.workingDays || 0);
          totalOT += Number(worker.totalOT || 0);
          totalActualWages += Number(worker.actualWages || 0);
          totalIdleDays +=
            Number(worker.idleDays || 0) + Number(worker.idleOT || 0);
          totalIdleWages += Number(worker.idleWages || 0);
          totalTotalWages += Number(worker.totalWages || 0);

          // Update supplier totals
          if (supplierTotals) {
            supplierTotals.workingDays += Number(worker.workingDays || 0);
            supplierTotals.ot += Number(worker.totalOT || 0);
            supplierTotals.actualWages += Number(worker.actualWages || 0);
            supplierTotals.idleDays +=
              Number(worker.idleDays || 0) + Number(worker.idleOT || 0);
            supplierTotals.idleWages += Number(worker.idleWages || 0);
            supplierTotals.totalWages += Number(worker.totalWages || 0);
          }
        }
      });

      // Add final supplier totals for company mode
      if (supplierTotals && mode === "company") {
        const supplierTotalRow: any[] = ["", "Total", "", "", "", ""];
        for (let i = 0; i < daysInMonth; i++) supplierTotalRow.push("");
        supplierTotalRow.push(
          supplierTotals.workingDays.toFixed(2),
          supplierTotals.ot.toFixed(2),
          supplierTotals.actualWages.toFixed(2),
          supplierTotals.idleDays.toFixed(2),
          supplierTotals.idleWages.toFixed(2),
          supplierTotals.totalWages.toFixed(2)
        );
        body.push(supplierTotalRow);
      }

      // Skip the separate Total row for company mode as we have supplier totals
      if (mode === "govt") {
        // Add Total row for govt mode
        const totalRow: any[] = ["", "Total", "", "", "", ""];
        for (let i = 0; i < daysInMonth; i++) totalRow.push("");
        totalRow.push(
          "",
          "",
          totalGross.toFixed(2),
          totalHra.toFixed(2),
          totalPf.toFixed(2),
          totalEsic.toFixed(2),
          totalPt.toFixed(2),
          totalLwf.toFixed(2),
          totalDeduction.toFixed(2),
          totalPayable.toFixed(2)
        );
        body.push(totalRow);
      }

      // Add Grand Total row
      const grandTotalRow: any[] = ["", "Grand Total", "", "", "", ""];
      for (let i = 0; i < daysInMonth; i++) grandTotalRow.push("");

      if (mode === "govt") {
        grandTotalRow.push(
          "",
          "",
          totalGross.toFixed(2),
          totalHra.toFixed(2),
          totalPf.toFixed(2),
          totalEsic.toFixed(2),
          totalPt.toFixed(2),
          totalLwf.toFixed(2),
          totalDeduction.toFixed(2),
          totalPayable.toFixed(2)
        );
      } else {
        // Company mode grand totals
        grandTotalRow.push(
          totalWorkingDays.toFixed(2),
          totalOT.toFixed(2),
          totalActualWages.toFixed(2),
          totalIdleDays.toFixed(2),
          totalIdleWages.toFixed(2),
          totalTotalWages.toFixed(2)
        );
      }
      body.push(grandTotalRow);

      // Column styles
      const columnStyles: any = {
        0: { cellWidth: 8 }, // Sr
        1: { cellWidth: 25 }, // Name
        2: { cellWidth: 18 }, // Designation
        3: { cellWidth: 15 }, // UNA No
        4: { cellWidth: 15 }, // ESIC No
        5: { cellWidth: 18 }, // Skill Set
      };

      // Day columns - very narrow
      for (let i = 6; i < 6 + daysInMonth; i++) {
        columnStyles[i] = { cellWidth: 5, halign: "center" };
      }

      // Summary columns
      const summaryStart = 6 + daysInMonth;

      if (mode === "govt") {
        columnStyles[summaryStart] = { cellWidth: 12 }; // Total Days
        columnStyles[summaryStart + 1] = { cellWidth: 14 }; // Wage Rate
        columnStyles[summaryStart + 2] = { cellWidth: 16 }; // Gross
        columnStyles[summaryStart + 3] = { cellWidth: 12 }; // HRA
        columnStyles[summaryStart + 4] = { cellWidth: 14 }; // PF
        columnStyles[summaryStart + 5] = { cellWidth: 12 }; // ESIC
        columnStyles[summaryStart + 6] = { cellWidth: 10 }; // PT
        columnStyles[summaryStart + 7] = { cellWidth: 10 }; // LWF
        columnStyles[summaryStart + 8] = { cellWidth: 16 }; // Total Deduction
        columnStyles[summaryStart + 9] = { cellWidth: 16 }; // Payable
      } else {
        // Company mode column widths
        columnStyles[summaryStart] = { cellWidth: 16 }; // Working Days
        columnStyles[summaryStart + 1] = { cellWidth: 12 }; // OT
        columnStyles[summaryStart + 2] = { cellWidth: 18 }; // Actual Wages
        columnStyles[summaryStart + 3] = { cellWidth: 14 }; // Idle Days
        columnStyles[summaryStart + 4] = { cellWidth: 16 }; // Idle Wages
        columnStyles[summaryStart + 5] = { cellWidth: 18 }; // Total Wages
      }

      autoTable(doc, {
        head: [headers],
        body,
        startY: siteIdx === 0 ? startY : startY,
        styles: {
          fontSize: 6,
          cellPadding: 1,
        },
        headStyles: {
          fillColor: [220, 220, 220],
          textColor: [0, 0, 0],
          fontSize: 5.5,
          fontStyle: "bold",
          halign: "center",
        },
        columnStyles,
        didParseCell: (hookData: any) => {
          if (hookData.section === "body") {
            const row = body[hookData.row.index];
            const cellText = hookData.cell.text[0];

            // Style supplier header rows (company mode)
            if (
              mode === "company" &&
              hookData.column.index === 1 &&
              groupedWorkers[hookData.row.index]?.isSupplierHeader
            ) {
              hookData.cell.styles.fontStyle = "bold";
              hookData.cell.styles.fillColor = [240, 240, 240];
            }

            // Style Total and Grand Total rows
            if (
              (cellText === "Total" || cellText === "Grand Total") &&
              hookData.column.index === 1
            ) {
              const cellsObj = hookData.row?.cells || {};
              Object.values(cellsObj).forEach((cell: any) => {
                if (!cell || !cell.styles) return;
                cell.styles.fontStyle = "bold";
                cell.styles.fillColor =
                  cellText === "Grand Total"
                    ? [200, 200, 200]
                    : [230, 230, 230];
              });
            }
          }
        },
      });
    });

    // Return PDF as blob instead of saving
    const pdfBlob = doc.output("blob");
    return pdfBlob;
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
      // Open in new tab with current filters
      const params = new URLSearchParams();
      params.set("period", period);
      if (siteId && siteId !== "all") params.set("siteId", siteId);
      params.set("mode", mode);
      const url = `/reports/wage-sheet?${params.toString()}`;
      window.open(url, "_blank");
    }
  }

  const title =
    mode === "govt"
      ? "Monthly Wage Sheet As Per Minimum Wage"
      : "Monthly Wage Sheet As Per Company Rates";

  return (
    <div className="space-y-6">
      <div className="border rounded-md overflow-hidden">
        <div className="bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold">
          {title}
        </div>
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
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.site}
                    </SelectItem>
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
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm mb-1">Export</label>
              <Select
                value={exportType}
                onValueChange={(v) => setExportType(v as any)}
              >
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
            <Button
              onClick={handleShow}
              disabled={!/^\d{2}-\d{4}$/.test(period)}
            >
              Show
            </Button>
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
              <tr>
                <td colSpan={13} className="p-4">
                  Loading...
                </td>
              </tr>
            ) : !data?.data?.length ? (
              <tr>
                <td colSpan={13} className="p-4">
                  No data
                </td>
              </tr>
            ) : (
              data.data.map((r: any, idx: number) => (
                <tr key={idx} className="border-t">
                  <td className="p-2">{r.siteName}</td>
                  <td className="p-2">{r.manpowerName}</td>
                  <td className="p-2">{r.supplier ?? ""}</td>
                  <td className="p-2 text-right">
                    {Number(r.workingDays).toFixed(2)}
                  </td>
                  <td className="p-2 text-right">{Number(r.ot).toFixed(2)}</td>
                  <td className="p-2 text-right">
                    {Number(r.wages).toFixed(2)}
                  </td>
                  <td className="p-2 text-right">
                    {Number(r.grossWages).toFixed(2)}
                  </td>
                  <td className="p-2 text-right">{Number(r.hra).toFixed(2)}</td>
                  <td className="p-2 text-right">{Number(r.pf).toFixed(2)}</td>
                  <td className="p-2 text-right">
                    {Number(r.esic).toFixed(2)}
                  </td>
                  <td className="p-2 text-right">{Number(r.pt).toFixed(2)}</td>
                  <td className="p-2 text-right">
                    {Number(r.mlwf).toFixed(2)}
                  </td>
                  <td className="p-2 text-right">
                    {Number(r.total).toFixed(2)}
                  </td>
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
                  <td className="p-2 text-right">
                    {Number(s.workingDays).toFixed(2)}
                  </td>
                  <td className="p-2 text-right">{Number(s.ot).toFixed(2)}</td>
                  <td className="p-2 text-right">
                    {Number(s.grossWages).toFixed(2)}
                  </td>
                  <td className="p-2 text-right">{Number(s.hra).toFixed(2)}</td>
                  <td className="p-2 text-right">{Number(s.pf).toFixed(2)}</td>
                  <td className="p-2 text-right">
                    {Number(s.esic).toFixed(2)}
                  </td>
                  <td className="p-2 text-right">{Number(s.pt).toFixed(2)}</td>
                  <td className="p-2 text-right">
                    {Number(s.mlwf).toFixed(2)}
                  </td>
                  <td className="p-2 text-right">
                    {Number(s.total).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
