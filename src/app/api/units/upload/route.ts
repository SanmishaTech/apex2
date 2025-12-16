import { NextRequest } from "next/server";
import { guardApiAccess } from "@/lib/access-guard";
import { Success, Error as ApiError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

function nil(v: any) {
  if (v == null || v === "" || v === undefined) return null;
  if (typeof v === "string") return v.trim() || null;
  return v;
}

// POST /api/units/upload - Upload Excel file and bulk create units
export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return ApiError("No file uploaded", 400);
    }

    const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ];
    if (
      !validTypes.includes(file.type) &&
      !file.name.endsWith(".xlsx") &&
      !file.name.endsWith(".xls")
    ) {
      return ApiError(
        "Invalid file type. Please upload an Excel file (.xlsx or .xls)",
        400
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return ApiError("Excel file is empty", 400);

    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet) as any[];
    if (!data || data.length === 0) return ApiError("No data found in Excel file", 400);

    const errors: string[] = [];
    const units: { unitName: string }[] = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 2;
      const unitName = nil(row["Unit Name*"] || row["Unit Name"] || row["unitName"]);

      if (!unitName) {
        errors.push(`Row ${rowNum}: Unit Name is required`);
        continue;
      }

      units.push({ unitName: String(unitName).trim() });
    }

    if (errors.length > 0) {
      const errorSummary = `Found ${errors.length} validation error(s): ${errors
        .slice(0, 5)
        .join("; ")}${errors.length > 5 ? `; ... and ${errors.length - 5} more errors` : ""}`;
      return ApiError(errorSummary, 400);
    }

    if (units.length === 0) return ApiError("No valid records found to import", 400);

    // Remove duplicates within the file to avoid unnecessary unique constraint errors
    const uniqueByName = Array.from(new Map(units.map(u => [u.unitName.toLowerCase(), u])).values());

    try {
      const result = await prisma.unit.createMany({
        data: uniqueByName,
        skipDuplicates: true,
      });

      return Success({
        message: `Successfully uploaded ${result.count} unit record(s)`,
        count: result.count,
      }, 201);
    } catch (dbError: any) {
      console.error("Units upload DB error:", dbError);
      let errorMsg = "Failed to insert unit records. Please check your data.";
      if (dbError?.message?.includes("Unique constraint")) {
        errorMsg = "Some units already exist. Duplicates were skipped.";
      }
      return ApiError(errorMsg, 500);
    }
  } catch (e: any) {
    console.error("Units upload error:", e);
    return ApiError(e?.message || "Failed to process uploaded file");
  }
}
