import { NextRequest } from "next/server";
import { guardApiAccess } from "@/lib/access-guard";
import { Error as ApiError } from "@/lib/api-response";
import * as XLSX from "xlsx";

// GET /api/assets/template - Download Excel template
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    // Define template columns with mandatory fields
    const templateData = [
      {
        "assetGroup*": "",
        "assetCategory*": "",
        "assetName*": "",
        "status*": "",
        "useStatus*": "",
        "make": "",
        "description": "",
        "purchaseDate(YYYY-MM-DD)": "",
        "invoiceNo(YYYY-MM-DD)": "",
        "supplier": "",
        "nextMaintenanceDate(YYYY-MM-DD)": "",
        "currentSiteId": "",
      },
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(templateData);

    const colWidths = [
      { wch: 20 }, // assetGroup*
      { wch: 20 }, // assetCategory*
      { wch: 22 }, // assetName*
      { wch: 12 }, // status*
      { wch: 12 }, // useStatus*
      { wch: 18 }, // make
      { wch: 40 }, // description
      { wch: 22 }, // purchaseDate(YYYY-MM-DD)
      { wch: 22 }, // invoiceNo(YYYY-MM-DD)
      { wch: 20 }, // supplier
      { wch: 28 }, // nextMaintenanceDate(YYYY-MM-DD)
      { wch: 16 }, // currentSiteId
    ];
    (ws as any)["!cols"] = colWidths;

    // Bold header
    const range = XLSX.utils.decode_range((ws as any)["!ref"] || "A1");
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cellAddr = XLSX.utils.encode_cell({ r: 0, c });
      if (!(ws as any)[cellAddr]) continue;
      (ws as any)[cellAddr].s = {
        ...(ws as any)[cellAddr].s,
        font: { bold: true },
      };
    }

    XLSX.utils.book_append_sheet(wb, ws, "Assets Template");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="assets_template.xlsx"',
      },
    });
  } catch (e) {
    console.error("Template generation error:", e);
    return ApiError("Failed to generate template");
  }
}
