import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";

// GET /api/reports/wage-sheet.xlsx?period=MM-YYYY&siteId=123
export async function GET(req: NextRequest) {
  try {
    const apiUrl = new URL(req.url);
    const period = apiUrl.searchParams.get("period");
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

    // Fetch detailed attendance data from wage-sheet-details
    // Use the request headers to properly construct the URL for internal API calls
    const host = req.headers.get('host') || 'localhost:3000';
    const protocol = req.headers.get('x-forwarded-proto') || 'http';
    const baseUrl = `${protocol}://${host}`;
    
    const qs = new URLSearchParams();
    qs.set("period", period);
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
        "RATE"
      ];
      
      // Add day columns
      for (let day = 1; day <= daysInMonth; day++) {
        headers.push(String(day));
      }
      
      // Add summary columns
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
      
      sheetData.push(headers);
      
      // Group workers by supplier
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
              worker.supplierName || "",
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
      
      // Add Grand Total row
      const grandTotal = ["", "Grand Total"];
      const fixedCols = 10; // SR.NO, NAME, MANPOWER SUPPLIER, DESIGNATION, UNA NO, ESIC NO, ACCOUNT NO, IFSC, BANK, RATE
      const padCount = (fixedCols - 2) + daysInMonth;
      for (let i = 0; i < padCount; i++) grandTotal.push("");
      
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
      
      ws['!cols'] = colWidths;
      
      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, wsName);
    });
    
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    return new NextResponse(buf as unknown as BodyInit, {
      status: 200,
      headers: new Headers({
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="wage-sheet-${period}.xlsx"`,
        "Cache-Control": "no-store",
      }),
    });
  } catch (error: any) {
    console.error("Wage sheet Excel export error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to generate Excel report" },
      { status: 500 }
    );
  }
}
