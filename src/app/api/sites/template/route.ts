import { NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { guardApiAccess } from "@/lib/access-guard";
import { Success, Error as ApiError } from "@/lib/api-response";

// GET /api/sites/template - Download Excel template for Sites
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const templateData = [
      {
        site: "", // site*
        status: "ONGOING", // status* (ONGOING, HOLD, CLOSED, COMPLETED, MOBILIZATION_STAGE)
        siteContactPersonName: "", // siteContactPersonName*
        siteContactPersonNumber: "", // siteContactPersonNumber*
        siteContactPersonEmail: "",
        companyName: "",
        shortName: "",
        pinCode: "",
        longitude: "",
        latitude: "",
        state: "",
        city: "",
        addressLine1: "",
        addressLine2: "",
        panNo: "",
        gstNo: "",
        tanNo: "",
        cinNo: "",
        deliveryAddressLine1: "",
        deliveryAddressLine2: "",
        deliveryState: "",
        deliveryCity: "",
        deliveryPincode: "",
      },
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(templateData, { skipHeader: false });

    // Bold headers and set column widths
    const header = Object.keys(templateData[0]);
    const range = XLSX.utils.decode_range(ws['!ref'] as string);
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cell = ws[XLSX.utils.encode_cell({ r: 0, c: C })];
      if (cell) {
        cell.s = { font: { bold: true } } as any;
      }
    }
    (ws as any)["!cols"] = header.map(() => ({ wch: 22 }));

    XLSX.utils.book_append_sheet(wb, ws, "Sites");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    return new Response(buf, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename=sites-template.xlsx`,
      },
    });
  } catch (error) {
    console.error("Sites template error:", error);
    return ApiError("Failed to generate template");
  }
}
