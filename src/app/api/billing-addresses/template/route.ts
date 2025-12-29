import { NextRequest } from "next/server";
import { guardApiAccess } from "@/lib/access-guard";
import { Error as ApiError } from "@/lib/api-response";
import * as XLSX from "xlsx";

// GET /api/billing-addresses/template - Download Excel template for billing addresses
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const templateData = [
      {
        "companyName*": "",
        "addressLine1*": "",
        "addressLine2": "",
        "State": "",
        "City": "",
        "pincode": "",
        "Landline1": "",
        "Landline2": "",
        "fax": "",
        "email": "",
        "panNumber": "",
        "vatTinNumber": "",
        "gstNumber": "",
        "cstTinNumber": "",
        "cinNumber": "",
        "stateCode": "",
      },
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(templateData);
    (ws as any)["!cols"] = Array.from({ length: Object.keys(templateData[0]).length }, () => ({ wch: 22 }));

    // Bold header
    const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
      if (!ws[cellAddress]) continue;
      if (!(ws as any)[cellAddress].s) (ws as any)[cellAddress].s = {} as any;
      ((ws as any)[cellAddress].s as any).font = { bold: true };
    }

    XLSX.utils.book_append_sheet(wb, ws, "Billing Addresses Template");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="billing_addresses_template.xlsx"',
      },
    });
  } catch (e) {
    console.error("Billing addresses template generation error:", e);
    return ApiError("Failed to generate template");
  }
}
