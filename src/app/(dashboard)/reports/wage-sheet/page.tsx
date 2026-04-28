"use client";
import useSWR from "swr";
import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
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
import { useForm } from "react-hook-form";
import { Form } from "@/components/ui/form";
import { MultiSelectInput } from "@/components/common/multi-select-input";
import XLSX from "xlsx-js-style";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type FormValues = {
  siteIds: string[];
};

export default function WageSheetPage() {
  const search = useSearchParams();
  const [period, setPeriod] = useState("");
  const mode = "company";
  const [categoryId, setCategoryId] = useState<string>("");
  const [pf, setPf] = useState<string>("");
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  const form = useForm<FormValues>({
    defaultValues: {
      siteIds: [],
    },
  });

  const selectedSiteIds = form.watch("siteIds");

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
    const p = search?.get("period");
    if (p) setPeriod(p);
    const cat = search?.get("categoryId");
    if (cat) setCategoryId(cat);
    const pfParam = search?.get("pf");
    if (pfParam === "true" || pfParam === "false") setPf(pfParam);

    const siteIdsCsv = search?.get("siteIds");
    const s = search?.get("siteId");
    if (siteIdsCsv) {
      const ids = siteIdsCsv
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
      form.setValue("siteIds", ids);
    } else if (s && s !== "all") {
      form.setValue("siteIds", [s]);
    } else {
      form.setValue("siteIds", []);
    }
  }, [search]);

  const sitesQuery = "/api/sites/options";
  const sites = useSWR(sitesQuery, fetcher);

  const categoriesQuery = "/api/categories?perPage=1000&sort=categoryName&order=asc";
  const categories = useSWR(categoriesQuery, fetcher);

  const siteOptions = useMemo(
    () =>
      (sites.data?.data || []).map((s: any) => ({
        value: String(s.id),
        label: s.site,
      })),
    [sites.data]
  );

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (period) params.set("period", period);
    const siteIdsCsv = (selectedSiteIds || []).filter(Boolean).join(",");
    if (siteIdsCsv) params.set("siteIds", siteIdsCsv);
    if (categoryId) params.set("categoryId", categoryId);
    if (pf) params.set("pf", pf);
    const qs = params.toString();
    return "/api/reports/wage-sheet" + (qs ? `?${qs}` : "");
  }, [period, selectedSiteIds, categoryId, pf]);

  const { data, isLoading } = useSWR(query, fetcher);

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
    doc.text("Report : Monthly Wage Sheet As Per Company Rates", 14, 22);

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
        "Account No",
        "IFSC",
        "Bank",
      ];

      // Add Rate column
      headers.push("Rate");

      // Add day columns (1-31)
      for (let day = 1; day <= daysInMonth; day++) {
        headers.push(String(day));
      }

      // Add summary columns
      headers.push(
        "Working Days",
        "OT",
        "Actual Wages",
        "Food Charges",
        "Idle Days",
        "Total Working Days",
        "Total Wages"
      );

      // Group workers by supplier
      let groupedWorkers = siteGroup.workers;
      {
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
      let totalWorkingDays = 0,
        totalOT = 0,
        totalActualWages = 0,
        totalFoodCharges = 0,
        totalFoodCharges2 = 0,
        totalIdleDays = 0,
        totalTotalWages = 0;
      // combined working days (workingDays + OT) for company summary column
      let totalWorkingDaysCombined = 0;
      let supplierTotals: any = null;
      let workerIndex = 1;

      groupedWorkers.forEach((item: any, idx: number) => {
        if (item.isSupplierHeader) {
          // Add supplier totals for previous group if exists
          if (supplierTotals) {
            const supplierTotalRow: any[] = ["", "Total", "", "", "", "", "", "", ""];
            for (let i = 0; i < daysInMonth; i++) supplierTotalRow.push("");
            supplierTotalRow.push(
              supplierTotals.workingDays.toFixed(2),
              supplierTotals.ot.toFixed(2),
              supplierTotals.actualWages.toFixed(2),
              supplierTotals.foodCharges.toFixed(2),
              supplierTotals.idleDays.toFixed(2),
              (supplierTotals.totalWages - supplierTotals.foodCharges - supplierTotals.foodCharges2).toFixed(2)
            );
            body.push(supplierTotalRow);
          }

          // Add supplier header row as a regular row with merged cells
          const supplierHeaderRow = new Array(9 + daysInMonth + 7).fill("");
          supplierHeaderRow[1] = item.supplierName; // Put supplier name in second column
          body.push(supplierHeaderRow);

          // Reset supplier totals (include combined working days)
          supplierTotals = {
            workingDays: 0,
            ot: 0,
            actualWages: 0,
            foodCharges: 0,
            foodCharges2: 0,
            idleDays: 0,
            totalWorkingDays: 0,
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
          worker.accountNumber || "-",
          worker.ifscCode || "-",
          worker.bankName || "-",
        ];

        // Add Rate
        row.push(worker.wageRate?.toFixed(2) || "-");

        // Add daily attendance (P/A/I/O)
        worker.dailyAttendance.forEach((status: string) => {
          row.push(status || "-");
        });

        // Add summary values
        const idleDaysCombined =
          Number(worker.idleDays || 0) + Number(worker.idleOT || 0);
        const workerTotalWorkingDays =
          Number(worker.workingDays || 0) + Number(worker.totalOT || 0);
        row.push(
          worker.workingDays?.toFixed(2) || "0.00",
          worker.totalOT?.toFixed(2) || "0.00",
          worker.actualWages?.toFixed(2) || "0.00",
          worker.foodCharges?.toFixed(2) || "0.00",
          idleDaysCombined.toFixed(2),
          workerTotalWorkingDays.toFixed(2),
          (Number(worker.totalWages || 0) - Number(worker.foodCharges || 0) - Number(worker.foodCharges2 || 0)).toFixed(2)
        );
        // Update totals
        totalWorkingDays += Number(worker.workingDays || 0);
        totalOT += Number(worker.totalOT || 0);
        totalWorkingDaysCombined += workerTotalWorkingDays;
        totalActualWages += Number(worker.actualWages || 0);
        totalFoodCharges += Number(worker.foodCharges || 0);
        totalFoodCharges2 += Number(worker.foodCharges2 || 0);
        totalIdleDays += idleDaysCombined;
        totalTotalWages += Number(worker.totalWages || 0);

        // Update supplier totals
        if (supplierTotals) {
          supplierTotals.workingDays += Number(worker.workingDays || 0);
          supplierTotals.ot += Number(worker.totalOT || 0);
          supplierTotals.actualWages += Number(worker.actualWages || 0);
          supplierTotals.foodCharges += Number(worker.foodCharges || 0);
          supplierTotals.foodCharges2 += Number(worker.foodCharges2 || 0);
          supplierTotals.idleDays += idleDaysCombined;
          supplierTotals.totalWorkingDays += workerTotalWorkingDays;
          supplierTotals.totalWages += Number(worker.totalWages || 0);
        }

        body.push(row);
      });

      // Add final supplier totals
      if (supplierTotals) {
        const supplierTotalRow: any[] = ["", "Total", "", "", "", "", "", "", ""];
        for (let i = 0; i < daysInMonth; i++) supplierTotalRow.push("");
        supplierTotalRow.push(
          supplierTotals.workingDays.toFixed(2),
          supplierTotals.ot.toFixed(2),
          supplierTotals.actualWages.toFixed(2),
          supplierTotals.foodCharges.toFixed(2),
          supplierTotals.idleDays.toFixed(2),
          supplierTotals.totalWorkingDays.toFixed(2),
          (supplierTotals.totalWages - supplierTotals.foodCharges - supplierTotals.foodCharges2).toFixed(2)
        );
        body.push(supplierTotalRow);
      }

      // Add Grand Total row
      const grandTotalRow: any[] = ["", "Grand Total", "", "", "", "", "", "", ""];
      for (let i = 0; i < daysInMonth; i++) grandTotalRow.push("");

      // Grand totals
      grandTotalRow.push(
        totalWorkingDays.toFixed(2),
        totalOT.toFixed(2),
        totalActualWages.toFixed(2),
        totalFoodCharges.toFixed(2),
        totalIdleDays.toFixed(2),
        totalWorkingDaysCombined.toFixed(2),
        (totalTotalWages - totalFoodCharges - totalFoodCharges2).toFixed(2)
      );
      body.push(grandTotalRow);

      // Column styles
      const columnStyles: any = {
        0: { cellWidth: 8 }, // Sr
        1: { cellWidth: 25 }, // Name
        2: { cellWidth: 18 }, // Designation
        3: { cellWidth: 15 }, // UNA No
        4: { cellWidth: 15 }, // ESIC No
        5: { cellWidth: 20 }, // Account No
        6: { cellWidth: 15 }, // IFSC
        7: { cellWidth: 20 }, // Bank
        8: { cellWidth: 18 }, // Skill Set
      };

      // Day columns - very narrow
      for (let i = 9; i < 9 + daysInMonth; i++) {
        columnStyles[i] = { cellWidth: 5, halign: "center" };
      }

      // Summary columns
      const summaryStart = 9 + daysInMonth;

      // Column widths
      columnStyles[summaryStart] = { cellWidth: 16 }; // Working Days
      columnStyles[summaryStart + 1] = { cellWidth: 12 }; // OT
      columnStyles[summaryStart + 2] = { cellWidth: 18 }; // Actual Wages
      columnStyles[summaryStart + 3] = { cellWidth: 18 }; // Food Charges
      columnStyles[summaryStart + 4] = { cellWidth: 14 }; // Idle Days
      columnStyles[summaryStart + 5] = { cellWidth: 16 }; // Total Working Days
      columnStyles[summaryStart + 6] = { cellWidth: 18 }; // Total Wages

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

            // Style supplier header rows
            if (
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
    
    // Update generated timestamp when showing data
    const now = new Date();
    const formattedDate = now.toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }).replace(',', '');
    setGeneratedAt(formattedDate);
    
    // Open in new tab with current filters
    const params = new URLSearchParams();
    params.set("period", period);
    const siteIdsCsv = (selectedSiteIds || []).filter(Boolean).join(",");
    if (siteIdsCsv) params.set("siteIds", siteIdsCsv);
    if (categoryId) params.set("categoryId", categoryId);
    if (pf) params.set("pf", pf);
    const url = `/reports/wage-sheet?${params.toString()}`;
    window.open(url, "_blank");
  }

  async function handleExportExcel() {
    if (!/^\d{2}-\d{4}$/.test(period)) {
      toast.error("Select a period (MM-YYYY)");
      return;
    }

    toast.info("Generating Excel...");

    try {
      const params = new URLSearchParams();
      params.set("period", period);
      const siteIdsCsv = (selectedSiteIds || []).filter(Boolean).join(",");
      if (siteIdsCsv) params.set("siteIds", siteIdsCsv);
      if (categoryId) params.set("categoryId", categoryId);
      if (pf) params.set("pf", pf);

      const res = await fetch(`/api/reports/wage-sheet-details?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch data");
      const result = await resultProcessing(await res.json());

      const wb = XLSX.utils.book_new();
      
      result.data.forEach((siteGroup: any) => {
        const wsData: any[] = [];
        const daysInMonth = result.daysInMonth;
        const [mm, yyyy] = period.split("-");
        const monthDate = new Date(Number(yyyy), Number(mm) - 1, 1);
        const monthName = monthDate.toLocaleString("en", { month: "long" });

        // Meta Info & Header
        const now = new Date();
        const generatedOn = now.toLocaleString('en-GB', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        }).replace(',', '');

        const siteLabel = siteGroup.siteName || "All Sites";
        const filterText = `Site: ${siteLabel} | Period: ${monthName} ${yyyy} | PF: ${pf || 'All'} | Category: ${categoryId ? categories.data?.data?.find((c: any) => String(c.id) === categoryId)?.categoryName : 'All'}`;
        
        // Row 1: Title
        wsData.push([{ v: "MONTHLY WAGE SHEET", s: { font: { bold: true, sz: 14 }, alignment: { horizontal: "center" } } }]);
        // Row 2: Filters
        wsData.push([{ v: filterText, s: { font: { bold: true }, alignment: { horizontal: "center" } } }]);
        // Row 3: Generated On
        wsData.push([{ v: `Generated on: ${generatedOn}`, s: { font: { italic: true }, alignment: { horizontal: "center" } } }]);
        // Row 4: Empty
        wsData.push([]);

        // Table Headers (Row 5 & 6)
        const header1: any[] = ["Sr. No.", "Name", "Designation", "Aadhar No.", "PAN No.", "UAN No.", "ESIC No.", "Rate"];
        const header2: any[] = ["", "", "", "", "", "", "", ""];

        // Add Days 1-31
        for (let d = 1; d <= daysInMonth; d++) {
          header1.push(d);
          const dayDate = new Date(Number(yyyy), Number(mm) - 1, d);
          const dayName = dayDate.toLocaleString("en", { weekday: "short" });
          header2.push(dayName);
        }

        const pfPct = result.config?.pfPercentage || 12;
        const esicPct = result.config?.esicPercentage || 0.75;

        header1.push(
          "Total Working Days",
          "Total Amount",
          "Fooding Advance 1",
          "Fooding Advance 2",
          `PF (${pfPct}%)`,
          `ESIC (${esicPct}%)`,
          "PT (Maharashtra)",
          "MLWF",
          "Net Payable",
          "Remarks",
          "Account Details"
        );
        header2.push("", "", "", "", "", "", "", "", "", "", "Account No");
        header1.push("", ""); // Space for IFSC and Bank Name in row 5
        header2.push("IFSC", "Bank Name");

        wsData.push(header1.map(v => ({ v, s: headerStyle })));
        wsData.push(header2.map(v => ({ v, s: headerStyle })));

        // Data Rows
        siteGroup.workers.forEach((w: any, idx: number) => {
          const row: any[] = [
            { v: idx + 1, s: centerStyle },
            { v: w.manpowerName, s: leftStyle },
            { v: w.designation, s: leftStyle },
            { v: w.aadharNo || "-", s: centerStyle },
            { v: w.panNo || "-", s: centerStyle },
            { v: w.unaNo || "-", s: centerStyle },
            { v: w.esicNo || "-", s: centerStyle },
            { v: w.wageRate, s: numberStyle },
          ];

          // Daily Attendance
          w.dailyAttendance.forEach((status: string) => {
            let display = status;
            if (status.includes("\n")) {
              const [st, ot] = status.split("\n");
              const otNum = parseFloat(ot);
              const sign = otNum >= 0 ? "+" : "";
              display = `${st}${sign}${otNum}`;
            }
            row.push({ v: display, s: centerStyle });
          });

          const totalWorkingDays = parseFloat(w.workingDays) + parseFloat(w.totalOT);
          const netPayable = parseFloat(w.payable);

          row.push(
            { v: totalWorkingDays, s: numberStyle },
            { v: w.grossWage, s: numberStyle },
            { v: w.foodCharges, s: numberStyle },
            { v: w.foodCharges2, s: numberStyle },
            { v: w.pf, s: numberStyle },
            { v: w.esic, s: numberStyle },
            { v: w.pt, s: numberStyle },
            { v: w.lwf, s: numberStyle },
            { v: netPayable, s: { ...numberStyle, font: { bold: true }, fill: { fgColor: { rgb: "E2EFDA" } } } },
            { v: "", s: leftStyle }, // Remarks
            { v: w.accountNumber || "-", s: leftStyle },
            { v: w.ifscCode || "-", s: leftStyle },
            { v: w.bankName || "-", s: leftStyle }
          );

          wsData.push(row);
        });

        const ws = XLSX.utils.aoa_to_sheet(wsData);

        // Merges
        const merges: any[] = [
          { s: { r: 0, c: 0 }, e: { r: 0, c: header1.length - 1 } }, // Title
          { s: { r: 1, c: 0 }, e: { r: 1, c: header1.length - 1 } }, // Filters
          { s: { r: 2, c: 0 }, e: { r: 2, c: header1.length - 1 } }, // Generated On
        ];

        // Header Merges
        for (let c = 0; c < 8; c++) merges.push({ s: { r: 4, c }, e: { r: 5, c } }); // Sr.no to Rate
        for (let c = 8 + daysInMonth; c < 8 + daysInMonth + 10; c++) merges.push({ s: { r: 4, c }, e: { r: 5, c } }); // Working Days to Remarks
        merges.push({ s: { r: 4, c: 8 + daysInMonth + 10 }, e: { r: 4, c: 8 + daysInMonth + 12 } }); // Account Details label

        ws["!merges"] = merges;

        // Column Widths
        const cols = [
          { wch: 6 }, // Sr.No
          { wch: 25 }, // Name
          { wch: 15 }, // Designation
          { wch: 15 }, // Aadhar
          { wch: 15 }, // PAN
          { wch: 15 }, // UAN
          { wch: 15 }, // ESIC
          { wch: 10 }, // Rate
        ];
        for (let i = 0; i < daysInMonth; i++) cols.push({ wch: 5 });
        cols.push(
          { wch: 10 }, // Working Days
          { wch: 12 }, // Total Amount
          { wch: 12 }, // Fooding 1
          { wch: 12 }, // Fooding 2
          { wch: 10 }, // PF
          { wch: 10 }, // ESIC
          { wch: 10 }, // PT
          { wch: 8 },  // MLWF
          { wch: 12 }, // Net Payable
          { wch: 20 }, // Remarks
          { wch: 20 }, // Account No
          { wch: 15 }, // IFSC
          { wch: 20 }  // Bank Name
        );
        ws["!cols"] = cols;

        XLSX.utils.book_append_sheet(wb, ws, siteGroup.siteName.substring(0, 31) || "Sheet");
      });

      XLSX.writeFile(wb, `Wage_Report_${period}.xlsx`);
      toast.success("Excel generated successfully");
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Export failed");
    }
  }

  // Helper function to process some result fields (placeholder if needed)
  async function resultProcessing(data: any) {
    return data;
  }

  // Styles
  const headerStyle = {
    font: { bold: true, color: { rgb: "FFFFFF" } },
    fill: { fgColor: { rgb: "4472C4" } },
    alignment: { horizontal: "center", vertical: "center" },
    border: {
      top: { style: "thin", color: { rgb: "000000" } },
      bottom: { style: "thin", color: { rgb: "000000" } },
      left: { style: "thin", color: { rgb: "000000" } },
      right: { style: "thin", color: { rgb: "000000" } }
    }
  };

  const centerStyle = {
    alignment: { horizontal: "center", vertical: "center" },
    border: {
      top: { style: "thin", color: { rgb: "D9D9D9" } },
      bottom: { style: "thin", color: { rgb: "D9D9D9" } },
      left: { style: "thin", color: { rgb: "D9D9D9" } },
      right: { style: "thin", color: { rgb: "D9D9D9" } }
    }
  };

  const leftStyle = {
    alignment: { horizontal: "left", vertical: "center" },
    border: {
      top: { style: "thin", color: { rgb: "D9D9D9" } },
      bottom: { style: "thin", color: { rgb: "D9D9D9" } },
      left: { style: "thin", color: { rgb: "D9D9D9" } },
      right: { style: "thin", color: { rgb: "D9D9D9" } }
    }
  };

  const numberStyle = {
    alignment: { horizontal: "right", vertical: "center" },
    numFmt: "#,##0.00",
    border: {
      top: { style: "thin", color: { rgb: "D9D9D9" } },
      bottom: { style: "thin", color: { rgb: "D9D9D9" } },
      left: { style: "thin", color: { rgb: "D9D9D9" } },
      right: { style: "thin", color: { rgb: "D9D9D9" } }
    }
  };

  const title = "Monthly Wage Sheet As Per Company Rates";

  const groupedBySite = useMemo(() => {
    const rows: any[] = Array.isArray(data?.data) ? data.data : [];
    const map = new Map<string, { siteId: number; siteName: string; rows: any[] }>();

    for (const r of rows) {
      const key = String(r.siteId ?? "");
      if (!map.has(key)) {
        map.set(key, {
          siteId: Number(r.siteId || 0),
          siteName: String(r.siteName || ""),
          rows: [],
        });
      }
      map.get(key)!.rows.push(r);
    }

    return Array.from(map.values()).sort((a, b) => (a.siteName || "").localeCompare(b.siteName || ""));
  }, [data?.data]);

  return (
    <Form {...form}>
      <div className="space-y-6">
        <div className="border rounded-md overflow-hidden">
          <div className="bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold">
            {title}
          </div>
          <div className="p-4 bg-muted/30">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6 items-end">
              <MultiSelectInput
                control={form.control}
                name="siteIds"
                label="Sites"
                placeholder="All Sites"
                options={siteOptions}
                className="w-full"
              />
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
              <label className="block text-sm mb-1">Category</label>
              <Select value={categoryId || "all"} onValueChange={(v) => setCategoryId(v === "all" ? "" : v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="---" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {categories.data?.data?.map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.categoryName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm mb-1">PF</label>
              <Select value={pf || "all"} onValueChange={(v) => setPf(v === "all" ? "" : v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="---" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="true">Yes</SelectItem>
                  <SelectItem value="false">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="mt-6 flex justify-end">
              <div className="flex gap-2">
                <Button
                  onClick={handleShow}
                  disabled={!/^\d{2}-\d{4}$/.test(period)}
                >
                  Show
                </Button>
                <Button
                  variant="outline"
                  onClick={handleExportExcel}
                  disabled={!/^\d{2}-\d{4}$/.test(period)}
                >
                  Generate Excel
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="border rounded-md p-4">Loading...</div>
      ) : !data?.data?.length ? (
        <div className="border rounded-md p-4">No data</div>
      ) : (
        <div className="space-y-6">
          {groupedBySite.map((g) => (
            <div key={String(g.siteId)} className="space-y-2">
              <div className="text-sm font-semibold">{g.siteName}</div>
              <div className="overflow-auto border rounded-md">
                <table className="min-w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-2 text-left">Manpower</th>
                      <th className="p-2 text-left">Supplier</th>
                      <th className="p-2 text-left">Account Number</th>
                      <th className="p-2 text-left">IFSC Code</th>
                      <th className="p-2 text-left">Bank Name</th>
                      <th className="p-2 text-right">Days</th>
                      <th className="p-2 text-right">OT</th>
                      <th className="p-2 text-right">Food Charges</th>
                      <th className="p-2 text-right">Food Charges 2</th>
                      <th className="p-2 text-right">Wage</th>
                      <th className="p-2 text-right">Gross</th>
                      <th className="p-2 text-right">PF</th>
                      <th className="p-2 text-right">ESIC</th>
                      <th className="p-2 text-right">PT</th>
                      <th className="p-2 text-right">MLWF</th>
                      <th className="p-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.rows.map((r: any, idx: number) => (
                      <tr key={idx} className="border-t">
                        <td className="p-2">{r.manpowerName}</td>
                        <td className="p-2">{r.supplier ?? ""}</td>
                        <td className="p-2">{r.accountNumber}</td>
                        <td className="p-2">{r.ifscCode}</td>
                        <td className="p-2">{r.bankName}</td>
                        <td className="p-2 text-right">
                          {Number(r.workingDays).toFixed(2)}
                        </td>
                        <td className="p-2 text-right">
                          {Number(r.ot).toFixed(2)}
                        </td>
                        <td className="p-2 text-right">
                          {Number(r.foodCharges || 0).toFixed(2)}
                        </td>
                        <td className="p-2 text-right">
                          {Number(r.foodCharges2 || 0).toFixed(2)}
                        </td>
                        <td className="p-2 text-right">
                          {Number(r.wages).toFixed(2)}
                        </td>
                        <td className="p-2 text-right">
                          {Number(r.grossWages).toFixed(2)}
                        </td>
                        <td className="p-2 text-right">
                          {Number(r.pf).toFixed(2)}
                        </td>
                        <td className="p-2 text-right">
                          {Number(r.esic).toFixed(2)}
                        </td>
                        <td className="p-2 text-right">
                          {Number(r.pt).toFixed(2)}
                        </td>
                        <td className="p-2 text-right">
                          {Number(r.mlwf).toFixed(2)}
                        </td>
                        <td className="p-2 text-right">
                          {Number(r.total).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

        {!!data?.summary?.length && (
          <div className="overflow-auto border rounded-md">
            <table className="min-w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="p-2 text-left">Site</th>
                  <th className="p-2 text-right">Food Charges</th>
                  <th className="p-2 text-right">Food Charges 2</th>
                  <th className="p-2 text-right">Gross</th>
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
                    <td className="p-2 text-right">{Number(s.foodCharges || 0).toFixed(2)}</td>
                    <td className="p-2 text-right">{Number(s.foodCharges2 || 0).toFixed(2)}</td>
                    <td className="p-2 text-right">
                      {Number(s.grossWages).toFixed(2)}
                    </td>
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
    </Form>
  );
}
