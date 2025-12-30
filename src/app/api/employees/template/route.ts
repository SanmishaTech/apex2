import { NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { guardApiAccess } from "@/lib/access-guard";
import { Error as ApiError } from "@/lib/api-response";

// GET /api/employees/template - Download Excel template for Employees
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const templateData = [
      {
        "Name*": "",
        "Email*": "",
        "Password*": "",
        "Role*": "", // Admin, Site Admin, Project Manager, Project Director, Purchase Executive, Commercial Head, Managing Director, Project COOrdinator, Technical Director, Site Incharge
        "Department*": "", // department name (required)
        "resignDate(YYYY-MM-DD)": "",
        "dateOfBirth(YYYY-MM-DD)": "",
        "joiningDate(YYYY-MM-DD)": "",
        spouseName: "",
        bloodGroup: "",
        correspondenceAddress: "",
        permanentAddress: "",
        state: "",
        city: "",
        pincode: "",
        mobile1: "",
        mobile2: "",
        esic: "",
        pf: "",
        panNo: "",
        "ADHAR NO": "",
        cinNo: "",
        sickLeavesPerYear: "",
        paidLeavesPerYear: "",
        casualLeavesPerYear: "",
        balanceSickLeaves: "",
        balancePaidLeaves: "",
        balanceCasualLeaves: "",
        airTravelClass: "",
        railwayTravelClass: "",
        busTravelClass: "",
      },
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(templateData, { skipHeader: false });

    const header = Object.keys(templateData[0]);
    const range = XLSX.utils.decode_range(ws["!ref"] as string);
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cell = ws[XLSX.utils.encode_cell({ r: 0, c: C })];
      if (cell) {
        (cell as any).s = { font: { bold: true } };
      }
    }
    (ws as any)["!cols"] = header.map(() => ({ wch: 20 }));

    XLSX.utils.book_append_sheet(wb, ws, "Employees");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    return new Response(buf, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename=employees-template.xlsx`,
      },
    });
  } catch (e) {
    console.error("Employees template error:", e);
    return ApiError("Failed to generate template");
  }
}
