import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardApiAccess } from "@/lib/access-guard";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");
    const status = searchParams.get("status");

    // Build where conditions
    const where: any = {};

    if (fromDate) {
      where.dueDate = {
        ...where.dueDate,
        gte: new Date(fromDate),
      };
    }

    if (toDate) {
      where.dueDate = {
        ...where.dueDate,
        lte: new Date(toDate),
      };
    }

    if (status && status !== "all") {
      where.status = status;
    }

    // Fetch rents with related data
    const rents = await prisma.rent.findMany({
      where,
      include: {
        site: {
          select: {
            id: true,
            site: true,
          },
        },
        boq: {
          select: {
            id: true,
            boqNo: true,
          },
        },
        rentalCategory: {
          select: {
            id: true,
            rentalCategory: true,
          },
        },
        rentType: {
          select: {
            id: true,
            rentType: true,
          },
        },
      },
      orderBy: [{ siteId: "asc" }, { boqId: "asc" }],
    });

    // Generate PDF
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });

    // Header
    doc.setFontSize(14);
    doc.text("APEX Constructions", 14, 15);
    doc.setFontSize(12);
    doc.text("Report : Rent Registration Report", 14, 22);

    // Filters info
    doc.setFontSize(10);
    let filterText = "Filters: ";
    if (fromDate) filterText += `From: ${fromDate} `;
    if (toDate) filterText += `To: ${toDate} `;
    if (status && status !== "all") filterText += `Status: ${status}`;
    doc.text(filterText, 14, 29);

    // Group data by site and boq
    const groups: any[] = [];
    let grandTotalDeposit = 0;
    let grandTotalRent = 0;

    rents.forEach((rent) => {
      const key = `${rent.siteId}-${rent.boqId}`;
      let group = groups.find((g) => g.key === key);
      if (!group) {
        group = {
          key,
          siteName: rent.site?.site || "N/A",
          boqNo: rent.boq?.boqNo || "N/A",
          rents: [],
        };
        groups.push(group);
      }
      group.rents.push(rent);
    });

    let startY = 36;

    // Process each group
    groups.forEach((group, index) => {
      // Check if we need a page break (removed forced page break per group)
      const pageHeight = doc.internal.pageSize.height;
      if (startY > pageHeight - 50) {
        // Leave some margin for the next group
        doc.addPage();
        startY = 20;
      }

      // Group header
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(`${group.boqNo} - ${group.siteName}`, 14, startY);
      startY += 5;

      // Table data
      const tableData: any[] = [];
      let groupTotalDeposit = 0;
      let groupTotalRent = 0;

      group.rents.forEach((rent: any) => {
        const depositAmt = Number(rent.depositAmount || 0);
        const rentAmt = Number(rent.rentAmount || 0);
        const isFirst = (rent.listStatus === "First") || (Number(rent.srNo) === 1);
        if (isFirst) {
          groupTotalDeposit += depositAmt;
        }
        groupTotalRent += rentAmt;

        tableData.push([
          rent.owner || "N/A",
          rent.rentalCategory?.rentalCategory || "N/A",
          rent.rentType?.rentType || "N/A",
          rent.description || "-",
          rent.dueDate ? new Date(rent.dueDate).toLocaleDateString() : "N/A",
          rent.status || "N/A",
          isFirst ? depositAmt.toFixed(2) : "",
          rentAmt.toFixed(2),
          rent.bank || "N/A",
          rent.branch || "N/A",
          rent.accountNo || "N/A",
          rent.accountName || "N/A",
          rent.ifscCode || "N/A",
        ]);
      });

      // Add group total row
      tableData.push([
        {
          content: "Total",
          colSpan: 6,
          styles: { fontStyle: "bold", halign: "right" },
        },
        {
          content: groupTotalDeposit.toFixed(2),
          styles: { fontStyle: "bold", halign: "right" },
        },
        {
          content: groupTotalRent.toFixed(2),
          styles: { fontStyle: "bold", halign: "right" },
        },
        "",
        "",
        "",
        "",
        "",
      ]);

      grandTotalDeposit += groupTotalDeposit;
      grandTotalRent += groupTotalRent;

      autoTable(doc, {
        head: [
          [
            "Owner",
            "Rent Category",
            "Rent Type",
            "Description",
            "Due Date",
            "Status",
            "Deposit Amount",
            "Rent Amount",
            "Bank Name",
            "Branch",
            "Account No",
            "Account Name",
            "IFSC Code",
          ],
        ],
        body: tableData,
        startY: startY,
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: [200, 200, 200], textColor: 0 },
        columnStyles: {
          6: { halign: "right" },
          7: { halign: "right" },
        },
      });

      startY = (doc as any).lastAutoTable.finalY + 10;
    });

    // Grand Total
    if (groups.length > 0) {
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      const finalY = (doc as any).lastAutoTable.finalY + 5;
      doc.text(
        `Grand Total Deposit: ${grandTotalDeposit.toFixed(2)}`,
        14,
        finalY
      );
      doc.text(`Grand Total Rent: ${grandTotalRent.toFixed(2)}`, 120, finalY);
    }

    const pdfBuffer = Buffer.from(doc.output("arraybuffer"));

    return new Response(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="rent-registration-report.pdf"`,
      },
    });
  } catch (error: any) {
    console.error("Error generating PDF:", error);
    return Response.json(
      { error: error.message || "Failed to generate PDF" },
      { status: 500 }
    );
  }
}
