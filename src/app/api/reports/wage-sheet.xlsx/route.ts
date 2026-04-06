import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";

// GET /api/reports/wage-sheet.xlsx?period=MM-YYYY&mode=company|govt&siteId=123
export async function GET(req: NextRequest) {
  try {
    const apiUrl = new URL(req.url);
    const period = apiUrl.searchParams.get("period");
    const mode = apiUrl.searchParams.get("mode") as "company" | "govt" | null;
    const siteId = apiUrl.searchParams.get("siteId");
    const siteIds = apiUrl.searchParams.get("siteIds");
    const categoryId = apiUrl.searchParams.get("categoryId");
    const pf = apiUrl.searchParams.get("pf");

    if (!period || !/^\d{2}-\d{4}$/.test(period)) {
      return NextResponse.json({ error: "Missing or invalid period (MM-YYYY)" }, { status: 400 });
    }
    
    // Get month info
    const [mm, yyyy] = period.split('-');
    const monthDate = new Date(Number(yyyy), Number(mm) - 1);
    const monthName = monthDate.toLocaleString('en', { month: 'long' });
    const daysInMonth = new Date(Number(yyyy), Number(mm), 0).getDate();

    // For company mode with detailed attendance, fetch from wage-sheet-details
    if (mode === "company" || mode === "govt") {
    // Use the request headers to properly construct the URL for internal API calls
    const host = req.headers.get('host') || 'localhost:3000';
    const protocol = req.headers.get('x-forwarded-proto') || 'http';
    const baseUrl = `${protocol}://${host}`;
    
    const qs = new URLSearchParams();
    qs.set("period", period);
    qs.set("mode", mode);
    if (siteIds) qs.set("siteIds", siteIds);
    if (!siteIds && siteId) qs.set("siteId", siteId);
    if (categoryId) qs.set("categoryId", categoryId);
    if (pf) qs.set("pf", pf);
    const detailsUrl = `${baseUrl}/api/reports/wage-sheet-details?${qs.toString()}`;
    
    // Pass authentication headers from the original request
    const headers = new Headers();
    const authHeader = req.headers.get('authorization');
    const cookieHeader = req.headers.get('cookie');
    
    if (authHeader) headers.set('authorization', authHeader);
    if (cookieHeader) headers.set('cookie', cookieHeader);
    
    const detailsResponse = await fetch(detailsUrl, { 
      headers,
      cache: "no-store" 
    });
    
    if (!detailsResponse.ok) {
      const errorText = await detailsResponse.text();
      console.error("Failed to fetch wage sheet details:", errorText);
      return NextResponse.json({ error: "Failed to fetch wage sheet details", details: errorText }, { status: 500 });
    }
    
    const wageData = await detailsResponse.json();
    
    if (!wageData.data || wageData.data.length === 0) {
      return NextResponse.json({ error: "No data available for the selected period" }, { status: 404 });
    }
    
    // Build Excel with daily attendance columns
    const wb = XLSX.utils.book_new();
    
    // Get current timestamp in IST (Asia/Kolkata)
    const now = new Date();
    const generatedAt = now.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }).replace(',', '');
    
    // Process each site
    wageData.data.forEach((siteGroup: any, siteIdx: number) => {
      const wsName = (siteGroup.siteName || `Site${siteIdx + 1}`).replace(/[:\\\/?\*\[\]]/g, '').slice(0, 31); // Excel sheet name limit, strip invalid chars
      const sheetData: any[][] = [];
      
      // Add filters info at the top
      sheetData.push([`Site: ${siteGroup.siteName || 'All Sites'}`]);
      sheetData.push([`Period: ${period || '-'}`]);
      sheetData.push([`Category: ${categoryId || 'All'}`]);
      sheetData.push([`PF: ${pf === 'true' ? 'Yes' : pf === 'false' ? 'No' : 'All'}`]);
      sheetData.push([`Generated At: ${generatedAt}`]);
      sheetData.push([]); // Empty row for spacing
      
      // Column headers (uppercase for emphasis)
      const headers = [
        "SR.NO",
        "NAME",
        "MANPOWER SUPPLIER",
        "DESIGNATION",
        "UNA NO",
        "ESIC NO",
        "ACCOUNT NUMBER",
        "IFSC CODE",
        "BANK NAME",
        mode === 'company' ? "RATE" : "SKILL SET"
      ];
      
      // Add day columns
      for (let day = 1; day <= daysInMonth; day++) {
        headers.push(String(day));
      }
      
      // Add summary columns based on mode
      if (mode === 'govt') {
        headers.push(
          "TOTAL DAYS",
          "WAGE RATE",
          "GROSS WAGE",
          "HRA @5%",
          "PF @12%",
          "ESIC @0.75%",
          "PT",
          "MLWF",
          "TOTAL DEDUCTION",
          "TOTAL WORKING DAYS",
          "NET WAGES"
        );
      } else {
        headers.push(
          "WORKING DAYS",
          "OT",
          "ACTUAL WAGES",
          "FOOD CHARGES",
          "FOOD CHARGES 2",
          "IDLE DAYS",
          "TOTAL WORKING DAYS",
          "TOTAL WAGES"
        );
      }
      
      sheetData.push(headers);
      
      // Group workers by supplier for company mode
      let processedWorkers = siteGroup.workers;
      if (mode === 'company') {
        const supplierGroups: { [key: string]: any[] } = {};
        siteGroup.workers.forEach((worker: any) => {
          const supplierKey = worker.supplierName || 'No Supplier';
          if (!supplierGroups[supplierKey]) {
            supplierGroups[supplierKey] = [];
          }
          supplierGroups[supplierKey].push(worker);
        });
        
        let srNo = 1;
        Object.entries(supplierGroups).forEach(([supplier, workers]) => {
          // Add supplier header row
          sheetData.push([supplier]);
          
          // Add workers
          workers.forEach((worker: any) => {
            const row = [
              srNo++,
              worker.manpowerName,
              worker.supplierName,
              worker.designation || "",
              worker.unaNo || "",
              worker.esicNo || "",
              worker.accountNumber || "",
              worker.ifscCode || "",
              worker.bankName || "",
              worker.wageRate?.toFixed(2) || ""
            ];
            
            // Add daily attendance
            worker.dailyAttendance.forEach((status: string) => {
              // Parse status for OT (e.g., "P\n2" or "I\n1")
              const parts = status.split('\n');
              const attendance = parts[0] || "";
              const ot = parts[1] || "";
              
              if (attendance === "P" && ot) {
                row.push(`${attendance} (${ot})`);
              } else if (attendance === "I" && ot) {
                row.push(`I (${ot})`);
              } else {
                row.push(attendance);
              }
            });
            
            // Add summary values (totalWages = totalWages - foodCharges - foodCharges2)
            const netTotalWages = Number(worker.totalWages || 0) - Number(worker.foodCharges || 0) - Number(worker.foodCharges2 || 0);
            row.push(
              worker.workingDays?.toFixed(2) || "0.00",
              worker.totalOT?.toFixed(2) || "0.00",
              worker.actualWages?.toFixed(2) || "0.00",
              worker.foodCharges?.toFixed(2) || "0.00",
              worker.foodCharges2?.toFixed(2) || "0.00",
              (Number(worker.idleDays || 0) + Number(worker.idleOT || 0)).toFixed(2),
              (Number(worker.workingDays || 0) + Number(worker.totalOT || 0)).toFixed(2),
              netTotalWages.toFixed(2)
            );
            
            sheetData.push(row);
          });
          
          // Add supplier total row
          const supplierTotal = ["", "Total"];
          const fixedCols = 10; // SR.NO, NAME, MANPOWER SUPPLIER, DESIGNATION, UNA NO, ESIC NO, ACCOUNT NO, IFSC, BANK, RATE/SKILL SET
          const padCount = (fixedCols - 2) + daysInMonth;
          for (let i = 0; i < padCount; i++) supplierTotal.push("");
          
          const totals = workers.reduce((acc, w) => ({
            workingDays: acc.workingDays + Number(w.workingDays || 0),
            ot: acc.ot + Number(w.totalOT || 0),
            actualWages: acc.actualWages + Number(w.actualWages || 0),
            foodCharges: acc.foodCharges + Number(w.foodCharges || 0),
            foodCharges2: acc.foodCharges2 + Number(w.foodCharges2 || 0),
            idleDays: acc.idleDays + Number(w.idleDays || 0) + Number(w.idleOT || 0),
            totalWorkingDays: acc.totalWorkingDays + Number(w.workingDays || 0) + Number(w.totalOT || 0),
            totalWages: acc.totalWages + Number(w.totalWages || 0)
          }), { workingDays: 0, ot: 0, actualWages: 0, foodCharges: 0, foodCharges2: 0, idleDays: 0, totalWorkingDays: 0, totalWages: 0 });
          
          supplierTotal.push(
            totals.workingDays.toFixed(2),
            totals.ot.toFixed(2),
            totals.actualWages.toFixed(2),
            totals.foodCharges.toFixed(2),
            totals.foodCharges2.toFixed(2),
            totals.idleDays.toFixed(2),
            totals.totalWorkingDays.toFixed(2),
            (totals.totalWages - totals.foodCharges - totals.foodCharges2).toFixed(2)
          );
          
          sheetData.push(supplierTotal);
        });
      } else {
        // Government mode - simpler format
        let srNo = 1;
        siteGroup.workers.forEach((worker: any) => {
          const row = [
            srNo++,
            worker.manpowerName,
            worker.supplierName,
            worker.designation || "",
            worker.unaNo || "",
            worker.esicNo || "",
            worker.accountNumber || "",
            worker.ifscCode || "",
            worker.bankName || "",
            worker.skillSet || ""
          ];
          
          // Add daily attendance
          worker.dailyAttendance.forEach((status: string) => {
            const parts = String(status || "").split("\n");
            row.push(parts[0] || "");
          });
          
          // Add summary values
          row.push(
            worker.totalDays || 0,
            worker.wageRate?.toFixed(2) || "0.00",
            worker.grossWage?.toFixed(2) || "0.00",
            worker.hra?.toFixed(2) || "0.00",
            worker.pf?.toFixed(2) || "0.00",
            worker.esic?.toFixed(2) || "0.00",
            worker.pt?.toFixed(2) || "0.00",
            worker.lwf?.toFixed(2) || "0.00",
            worker.totalDeduction?.toFixed(2) || "0.00",
            worker.totalDays || 0,
            worker.payable?.toFixed(2) || "0.00"
          );
          
          sheetData.push(row);
        });
      }
      
      // Add Grand Total row
      const grandTotal = ["", "Grand Total"];
      const fixedCols = 10; // SR.NO, NAME, MANPOWER SUPPLIER, DESIGNATION, UNA NO, ESIC NO, ACCOUNT NO, IFSC, BANK, RATE/SKILL SET
      const padCount = (fixedCols - 2) + daysInMonth;
      for (let i = 0; i < padCount; i++) grandTotal.push("");
      
      if (mode === 'company') {
        const totals = siteGroup.workers.reduce((acc: any, w: any) => ({
          workingDays: acc.workingDays + Number(w.workingDays || 0),
          ot: acc.ot + Number(w.totalOT || 0),
          actualWages: acc.actualWages + Number(w.actualWages || 0),
          foodCharges: acc.foodCharges + Number(w.foodCharges || 0),
          foodCharges2: acc.foodCharges2 + Number(w.foodCharges2 || 0),
          idleDays: acc.idleDays + Number(w.idleDays || 0) + Number(w.idleOT || 0),
          totalWorkingDays: acc.totalWorkingDays + Number(w.workingDays || 0) + Number(w.totalOT || 0),
          totalWages: acc.totalWages + Number(w.totalWages || 0)
        }), { workingDays: 0, ot: 0, actualWages: 0, foodCharges: 0, foodCharges2: 0, idleDays: 0, totalWorkingDays: 0, totalWages: 0 });
        
        grandTotal.push(
          totals.workingDays.toFixed(2),
          totals.ot.toFixed(2),
          totals.actualWages.toFixed(2),
          totals.foodCharges.toFixed(2),
          totals.foodCharges2.toFixed(2),
          totals.idleDays.toFixed(2),
          totals.totalWorkingDays.toFixed(2),
          (totals.totalWages - totals.foodCharges - totals.foodCharges2).toFixed(2)
        );
      } else {
        const totals = siteGroup.workers.reduce((acc: any, w: any) => ({
          gross: acc.gross + Number(w.grossWage || 0),
          hra: acc.hra + Number(w.hra || 0),
          pf: acc.pf + Number(w.pf || 0),
          esic: acc.esic + Number(w.esic || 0),
          pt: acc.pt + Number(w.pt || 0),
          lwf: acc.lwf + Number(w.lwf || 0),
          deduction: acc.deduction + Number(w.totalDeduction || 0),
          totalWorkingDays: acc.totalWorkingDays + Number(w.totalDays || 0),
          payable: acc.payable + Number(w.payable || 0)
        }), { gross: 0, hra: 0, pf: 0, esic: 0, pt: 0, lwf: 0, deduction: 0, totalWorkingDays: 0, payable: 0 });
        
        grandTotal.push(
          "", "",
          totals.gross.toFixed(2),
          totals.hra.toFixed(2),
          totals.pf.toFixed(2),
          totals.esic.toFixed(2),
          totals.pt.toFixed(2),
          totals.lwf.toFixed(2),
          totals.deduction.toFixed(2),
          totals.totalWorkingDays.toFixed(2),
          totals.payable.toFixed(2)
        );
      }
      
      sheetData.push(grandTotal);
      
      // Create worksheet
      const ws = XLSX.utils.aoa_to_sheet(sheetData);
      
      // Set column widths
      const colWidths = [
        { wch: 8 },  // Sr.No
        { wch: 25 }, // Name
        { wch: 20 }, // Supplier
        { wch: 15 }, // Designation
        { wch: 12 }, // UNA No
        { wch: 12 }, // ESIC No
        { wch: 20 }, // Account No
        { wch: 15 }, // IFSC Code
        { wch: 20 }, // Bank Name
        { wch: 12 }, // Rate/Skill Set
      ];
      
      // Day columns
      for (let i = 0; i < daysInMonth; i++) {
        colWidths.push({ wch: 5 });
      }
      
      // Summary columns
      if (mode === 'company') {
        colWidths.push(
          { wch: 12 }, // Working Days
          { wch: 8 },  // OT
          { wch: 12 }, // Actual Wages
          { wch: 14 }, // Food Charges
          { wch: 14 }, // Food Charges 2
          { wch: 10 }, // Idle Days
          { wch: 16 }, // Total Working Days
          { wch: 12 }  // Total Wages
        );
      } else {
        colWidths.push(
          { wch: 10 }, // Total Days
          { wch: 10 }, // Wage Rate
          { wch: 12 }, // Gross
          { wch: 10 }, // HRA
          { wch: 10 }, // PF
          { wch: 10 }, // ESIC
          { wch: 8 },  // PT
          { wch: 8 },  // MLWF
          { wch: 14 }, // Total Deduction
          { wch: 16 }, // Total Working Days
          { wch: 12 }  // Net Wages
        );
      }
      
      ws['!cols'] = colWidths;
      
      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, wsName);
    });
    
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    return new NextResponse(buf as unknown as BodyInit, {
      status: 200,
      headers: new Headers({
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="wage-sheet-${period}-${mode}.xlsx"`,
        "Cache-Control": "no-store",
      }),
    });
  } else {
    // Fallback to simple format
    const host = req.headers.get('host') || 'localhost:3000';
    const protocol = req.headers.get('x-forwarded-proto') || 'http';
    const baseUrl = `${protocol}://${host}`;
    
    // Get current timestamp in IST (Asia/Kolkata)
    const now = new Date();
    const generatedAt = now.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }).replace(',', '');
    
    const base = `${baseUrl}/api/reports/wage-sheet?period=${encodeURIComponent(period)}${mode ? `&mode=${encodeURIComponent(mode)}` : ""}${siteId ? `&siteId=${encodeURIComponent(siteId)}` : ""}${siteIds ? `&siteIds=${encodeURIComponent(siteIds)}` : ""}`;
    
    // Pass authentication headers
    const headers = new Headers();
    const authHeader = req.headers.get('authorization');
    const cookieHeader = req.headers.get('cookie');
    
    if (authHeader) headers.set('authorization', authHeader);
    if (cookieHeader) headers.set('cookie', cookieHeader);
    
    const j = await fetch(base, { headers, cache: "no-store" }).then((r) => r.json());
    if (!j?.data) {
      return NextResponse.json({ error: "No data" }, { status: 404 });
    }

    const rows = j.data as any[];

    // Build worksheet
    const header = [
      ["Site:", siteIds || siteId || "All Sites"],
      ["Period:", period],
      ["Category:", categoryId || "All"],
      ["PF:", pf === "true" ? "Yes" : pf === "false" ? "No" : "All"],
      ["Generated At:", generatedAt],
      [],
      ["Period", period, "Mode", mode || "all"],
    ];
    const columns = [[
      "Site ID", "Site", "Manpower", "Supplier",
      "Account No", "IFSC", "Bank",
      "Working Days", "OT", "Idle", "Wage", "Gross",
      "Food Charges", "Food Charges 2", "HRA", "PF", "ESIC", "PT", "MLWF", "Deduction", "Tot Work Days", "Total",
    ]];
    const dataRows = rows.map((r) => [
      r.siteId, r.siteName || "",
      r.manpowerName || "", r.supplier || "",
      r.accountNumber || "", r.ifscCode || "", r.bankName || "",
      r.workingDays, r.ot, r.idle, r.wages, r.grossWages,
      r.foodCharges, r.foodCharges2, r.hra, r.pf, r.esic, r.pt, r.mlwf, (r.hra + r.pf + r.esic + r.pt + r.mlwf), (r.workingDays + r.ot), r.total,
    ]);

    const sheetData = [...header, [""], ...columns, ...dataRows];
    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Wage Sheet");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    return new NextResponse(buf as unknown as BodyInit, {
      status: 200,
      headers: new Headers({
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="wage-sheet-${period}${mode ? '-' + mode : ''}.xlsx"`,
        "Cache-Control": "no-store",
      }),
    });
  }
  } catch (error: any) {
    console.error("Wage sheet Excel export error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to generate Excel report" },
      { status: 500 }
    );
  }
}
