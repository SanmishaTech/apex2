import { NextRequest } from "next/server";
import { guardApiAccess } from "@/lib/access-guard";
import { Error as ApiError } from "@/lib/api-response";
import * as XLSX from 'xlsx';

// GET /api/manpower/template - Download Excel template
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    // Define template columns with mandatory fields
    const templateData = [
      {
        'First Name*': '',
        'Middle Name': '',
        'Last Name*': '',
        'Supplier Name*': '',
        'Date of Birth (YYYY-MM-DD)': '',
        'Address': '',
        'Location': '',
        'Mobile Number': '',
        'Wage': '',
        'Bank': '',
        'Branch': '',
        'Account Number': '',
        'IFSC Code': '',
        'PF No': '',
        'ESIC No': '',
        'UNA No': '',
        'PAN Number': '',
        'Aadhar No': '',
        'Voter ID No': '',
        'Driving Licence No': '',
        'Bank Details': '',
      }
    ];

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(templateData);

    // Set column widths for better readability
    const colWidths = [
      { wch: 15 }, // First Name*
      { wch: 15 }, // Middle Name
      { wch: 15 }, // Last Name*
      { wch: 25 }, // Supplier Name*
      { wch: 25 }, // Date of Birth
      { wch: 30 }, // Address
      { wch: 20 }, // Location
      { wch: 15 }, // Mobile Number
      { wch: 10 }, // Wage
      { wch: 20 }, // Bank
      { wch: 20 }, // Branch
      { wch: 18 }, // Account Number
      { wch: 12 }, // IFSC Code
      { wch: 12 }, // PF No
      { wch: 12 }, // ESIC No
      { wch: 12 }, // UNA No
      { wch: 15 }, // PAN Number
      { wch: 15 }, // Aadhar No
      { wch: 15 }, // Voter ID No
      { wch: 18 }, // Driving Licence No
      { wch: 20 }, // Bank Details
    ];
    ws['!cols'] = colWidths;

    // Add styling to header row (make it bold)
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
      if (!ws[cellAddress]) continue;
      if (!ws[cellAddress].s) ws[cellAddress].s = {};
      ws[cellAddress].s.font = { bold: true };
    }

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Manpower Template');

    // Generate buffer
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // Return as downloadable file
    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="manpower_template.xlsx"',
      },
    });
  } catch (e) {
    console.error('Template generation error:', e);
    return ApiError('Failed to generate template');
  }
}
