import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardApiAccess } from "@/lib/access-guard";

type RouteParams = {
  params: Promise<{ id: string }>;
};

// GET /api/site-budgets/[id]/download-pdf - Download PDF report for site budget
export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const { id: siteId } = await params;
  const siteIdNum = parseInt(siteId);

  if (isNaN(siteIdNum)) {
    return NextResponse.json({ error: "Invalid site ID" }, { status: 400 });
  }

  try {
    // Fetch site details
    const site = await prisma.site.findUnique({
      where: { id: siteIdNum },
      include: {
        company: true
      }
    });

    if (!site) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }

    // Fetch all budget data for the site
    const budgetData = await prisma.siteBudget.findMany({
      where: { siteId: siteIdNum },
      include: {
        item: {
          include: {
            unit: {
              select: {
                id: true,
                unitName: true,
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    // Calculate totals
    const totalBudgetValue = budgetData.reduce((sum, item) => sum + Number(item.budgetValue), 0);
    const totalOrderedValue = budgetData.reduce((sum, item) => sum + Number(item.orderedValue), 0);

    const currentDate = new Date();
    const formattedDate = currentDate.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    const formattedTime = currentDate.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit'
    });

    // Generate HTML content for PDF
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Site Budget Report - ${site.site}</title>
    <style>
        @page {
            size: A4;
            margin: 15mm;
        }
        
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            font-size: 11px;
            line-height: 1.2;
        }
        
        .header-section {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 15px;
            border: 2px solid #000;
            padding: 8px;
        }
        
        .company-info {
            flex: 1;
        }
        
        .company-name {
            font-size: 13px;
            font-weight: bold;
            margin-bottom: 3px;
        }
        
        .report-subtitle {
            font-size: 11px;
        }
        
        .report-title {
            flex: 1;
            text-align: right;
            font-size: 16px;
            font-weight: bold;
        }
        
        .site-info {
            margin: 8px 0 15px 0;
            font-weight: bold;
            font-size: 12px;
        }
        
        .report-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10px;
            margin-bottom: 15px;
        }
        
        .report-table th,
        .report-table td {
            border: 1px solid #000;
            padding: 4px 3px;
            text-align: center;
            vertical-align: middle;
        }
        
        .report-table th {
            background-color: #f5f5f5;
            font-weight: bold;
            font-size: 9px;
        }
        
        .text-left {
            text-align: left !important;
        }
        
        .text-right {
            text-align: right !important;
        }
        
        .total-row {
            font-weight: bold;
            background-color: #f9f9f9;
        }
        
        .grand-total-row {
            font-weight: bold;
            background-color: #e9e9e9;
        }
        
        .footer-info {
            display: flex;
            justify-content: space-between;
            margin-top: 20px;
            font-size: 9px;
        }
        
        .col-item { width: 25%; }
        .col-unit { width: 8%; }
        .col-budget-qty { width: 10%; }
        .col-budget-rate { width: 12%; }
        .col-budget-value { width: 12%; }
        .col-ordered-qty { width: 10%; }
        .col-avg-rate { width: 11%; }
        .col-ordered-value { width: 12%; }
    </style>
    <script>
        window.onload = function() {
            window.print();
            setTimeout(function() {
                window.close();
            }, 1000);
        }
    </script>
</head>
<body>
    <!-- Header Section -->
    <div class="header-section">
        <div class="company-info">
            <div class="company-name">${site.company?.companyName || 'ABCD COMPANY LTD'}</div>
            <div class="report-subtitle">Report: Budget View</div>
        </div>
        <div class="report-title">APEX Constructions</div>
    </div>

    <!-- Site Information -->
    <div class="site-info">Site: ${site.site}</div>

    <!-- Budget Table -->
    <table class="report-table">
        <thead>
            <tr>
                <th class="col-item">Item</th>
                <th class="col-unit">Unit</th>
                <th class="col-budget-qty">Budget Qty</th>
                <th class="col-budget-rate">Budget Rate</th>
                <th class="col-budget-value">Budget Value</th>
                <th class="col-ordered-qty">Ordered Qty</th>
                <th class="col-avg-rate">Avg Rate</th>
                <th class="col-ordered-value">Ordered Value</th>
            </tr>
        </thead>
        <tbody>
            ${budgetData.map(item => `
                <tr>
                    <td class="text-left">${item.item.item}</td>
                    <td>${item.item.unit?.unitName || '-'}</td>
                    <td class="text-right">${Number(item.budgetQty).toFixed(2)}</td>
                    <td class="text-right">${Number(item.budgetRate).toFixed(2)}</td>
                    <td class="text-right">${Number(item.budgetValue).toFixed(2)}</td>
                    <td class="text-right">${Number(item.orderedQty).toFixed(2)}</td>
                    <td class="text-right">${Number(item.avgRate).toFixed(2)}</td>
                    <td class="text-right">${Number(item.orderedValue).toFixed(2)}</td>
                </tr>
            `).join('')}
            
            <!-- Total Row -->
            <tr class="total-row">
                <td colspan="4" class="text-right">Total</td>
                <td class="text-right">${totalBudgetValue.toFixed(2)}</td>
                <td></td>
                <td></td>
                <td class="text-right">${totalOrderedValue.toFixed(2)}</td>
            </tr>
            
            <!-- Grand Total Row -->
            <tr class="grand-total-row">
                <td colspan="4" class="text-right">Grand Total</td>
                <td class="text-right">${totalBudgetValue.toFixed(2)}</td>
                <td></td>
                <td></td>
                <td class="text-right">${totalOrderedValue.toFixed(2)}</td>
            </tr>
        </tbody>
    </table>

    <!-- Footer -->
    <div class="footer-info">
        <div>APEX</div>
        <div>Printed on ${formattedDate} ${formattedTime}</div>
        <div>1/1</div>
    </div>
</body>
</html>`;

    // Return HTML content that will auto-print and close
    return new NextResponse(htmlContent, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="site-budget-${site.site.replace(/[^a-zA-Z0-9]/g, '-')}-${formattedDate.replace(/\//g, '-')}.html"`,
      },
    });

  } catch (error: any) {
    console.error("Generate PDF error:", error);
    return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 });
  }
}
