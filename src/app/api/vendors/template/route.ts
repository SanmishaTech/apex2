import { NextRequest } from "next/server";
import { guardApiAccess } from "@/lib/access-guard";
import { Error as ApiError } from "@/lib/api-response";
import * as XLSX from "xlsx";

// GET /api/vendors/template - Download Excel template for Vendors import
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const templateData = [
      {
        'vendorName*': '',
        'contactPersonName*': '',
        'addressLine1*': '',
        'addressLine2': '',
        'state': '',
        'city': '',
        'pincode': '',
        'mobile1': '',
        'mobile2': '',
        'email': '',
        'alternateEmail1': '',
        'alternateEmail2': '',
        'alternateEmail3': '',
        'alternateEmail4': '',
        'landline1': '',
        'landline2': '',
        'bankName': '',
        'branchName': '',
        'branchCode': '',
        'accountNumber': '',
        'ifscCode': '',
        'panNumber': '',
        'gstNumber': '',
        'vatTinNumber': '',
        'cstInNumber': '',
        'cinNumber': '',
        'serviceTaxNumber': '',
        'stateCode': '',
      },
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(templateData);
    ws['!cols'] = Array.from({ length: Object.keys(templateData[0]).length }, () => ({ wch: 20 }));

    // Bold header
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
      if (!ws[cellAddress]) continue;
      if (!ws[cellAddress].s) ws[cellAddress].s = {} as any;
      (ws[cellAddress].s as any).font = { bold: true };
    }

    XLSX.utils.book_append_sheet(wb, ws, 'Vendors Template');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="vendors_template.xlsx"',
      },
    });
  } catch (e) {
    console.error('Vendors template generation error:', e);
    return ApiError('Failed to generate template');
  }
}
