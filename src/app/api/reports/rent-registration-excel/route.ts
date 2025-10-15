import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardApiAccess } from "@/lib/access-guard";
import { PERMISSIONS } from "@/config/roles";
import * as XLSX from "xlsx";

export async function GET(req: NextRequest) {
  try {
    await guardApiAccess(req, [PERMISSIONS.READ_RENTS]);

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
      orderBy: [
        { siteId: "asc" },
        { boqId: "asc" },
      ],
    });

    // Create Excel workbook using xlsx
    const workbook = XLSX.utils.book_new();
    const sheetData: any[][] = [];

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

    // Process each group
    groups.forEach((group, groupIndex) => {
      if (groupIndex > 0) {
        sheetData.push([]); // Empty row between groups
      }

      // Add group header
      sheetData.push([`${group.boqNo} - ${group.siteName}`]);

      // Add column headers
      sheetData.push([
        "Owner",
        "Rent Category",
        "Rent Type",
        "Description",
        "Due Date",
        "Status",
        "Deposit Amount",
        "Rent Amount",
      ]);

      // Add data rows
      let groupTotalDeposit = 0;
      let groupTotalRent = 0;

      group.rents.forEach((rent: any) => {
        const depositAmt = Number(rent.depositAmount || 0);
        const rentAmt = Number(rent.rentAmount || 0);
        groupTotalDeposit += depositAmt;
        groupTotalRent += rentAmt;

        sheetData.push([
          rent.owner || "N/A",
          rent.rentalCategory?.rentalCategory || "N/A",
          rent.rentType?.rentType || "N/A",
          rent.description || "-",
          rent.dueDate ? new Date(rent.dueDate).toLocaleDateString() : "N/A",
          rent.status || "N/A",
          depositAmt,
          rentAmt,
        ]);
      });

      // Add group total row
      sheetData.push([
        "",
        "",
        "",
        "",
        "",
        "Total",
        groupTotalDeposit,
        groupTotalRent,
      ]);

      grandTotalDeposit += groupTotalDeposit;
      grandTotalRent += groupTotalRent;
    });

    // Add grand total row
    sheetData.push([]);
    sheetData.push([
      "",
      "",
      "",
      "",
      "",
      "Grand Total",
      grandTotalDeposit,
      grandTotalRent,
    ]);

    // Create worksheet from data
    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

    // Note: Standard xlsx library doesn't support cell styling (bold, colors, etc.)
    // Headers will be plain text. To add styling, you would need xlsx-js-style package

    // Set column widths
    worksheet["!cols"] = [
      { wch: 20 }, // Owner
      { wch: 18 }, // Rent Category
      { wch: 18 }, // Rent Type
      { wch: 25 }, // Description
      { wch: 12 }, // Due Date
      { wch: 10 }, // Status
      { wch: 15 }, // Deposit Amount
      { wch: 15 }, // Rent Amount
    ];

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, "Rent Report");

    // Generate Excel buffer
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    return new Response(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="rent-registration-report.xlsx"`,
      },
    });
  } catch (error: any) {
    console.error("Error generating Excel:", error);
    return Response.json(
      { error: error.message || "Failed to generate Excel" },
      { status: 500 }
    );
  }
}
