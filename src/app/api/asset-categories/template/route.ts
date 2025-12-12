import { NextRequest } from "next/server";
import { guardApiAccess } from "@/lib/access-guard";
import { Error as ApiError } from "@/lib/api-response";
import * as XLSX from "xlsx";

// GET /api/asset-categories/template - Download Excel template
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    // Define template columns with mandatory fields
    const templateData = [
      {
        "Category*": "",
        "Asset Group Name*": "",
      },
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(templateData);

    // Set column widths
    const colWidths = [{ wch: 30 }, { wch: 30 }];
    (ws as any)["!cols"] = colWidths;

    // Make header bold
    const range = XLSX.utils.decode_range((ws as any)["!ref"] || "A1");
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
      if (!(ws as any)[cellAddress]) continue;
      if (!(ws as any)[cellAddress].s) (ws as any)[cellAddress].s = {};
      (ws as any)[cellAddress].s.font = { bold: true };
    }

    XLSX.utils.book_append_sheet(wb, ws, "Asset Categories Template");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition":
          'attachment; filename="asset_categories_template.xlsx"',
      },
    });
  } catch (e) {
    console.error("Asset categories template generation error:", e);
    return ApiError("Failed to generate template");
  }
}
