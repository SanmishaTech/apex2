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

// POST /api/asset-categories/upload - Upload Excel file and bulk create asset categories
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
    const validRecords: Array<{ category: string; assetGroupName: string }>= [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 2; // header + 1

      const category = nil(row["Category*"] || row["Category"] || row["category"]);
      const assetGroupName = nil(
        row["Asset Group Name*"] || row["Asset Group Name"] || row["assetGroupName"]
      );

      const rowErrors: string[] = [];
      if (!category) rowErrors.push("Category is required");
      if (!assetGroupName) rowErrors.push("Asset Group Name is required");

      if (rowErrors.length > 0) {
        errors.push(`Row ${rowNum}: ${rowErrors.join(", ")}`);
        continue;
      }

      validRecords.push({ category: String(category), assetGroupName: String(assetGroupName) });
    }

    if (errors.length > 0) {
      const errorSummary = `Found ${errors.length} validation error(s): ${errors
        .slice(0, 5)
        .join("; ")}${errors.length > 5 ? `; ... and ${errors.length - 5} more errors` : ""}`;
      return ApiError(errorSummary, 400);
    }

    if (validRecords.length === 0) return ApiError("No valid records found to import", 400);

    // Resolve Asset Group Names to IDs
    const uniqueGroupNames = [...new Set(validRecords.map((r) => r.assetGroupName.trim()))];
    const groups = await prisma.assetGroup.findMany({
      where: { assetGroupName: { in: uniqueGroupNames } },
      select: { id: true, assetGroupName: true },
    });

    const nameToId = new Map<string, number>();
    groups.forEach((g) => nameToId.set(g.assetGroupName.trim().toLowerCase(), g.id));

    const missing: string[] = [];
    const toCreate: Array<{ category: string; assetGroupId: number }> = [];
    const inFileDedup = new Set<string>(); // key: `${groupId}::${category.toLowerCase().trim()}`
    let inFileSkipped = 0;

    for (const rec of validRecords) {
      const groupKey = rec.assetGroupName.trim().toLowerCase();
      const groupId = nameToId.get(groupKey);
      if (!groupId) {
        missing.push(rec.assetGroupName);
        continue;
      }
      const normCategory = rec.category.trim();
      const pairKey = `${groupId}::${normCategory.toLowerCase()}`;
      if (inFileDedup.has(pairKey)) {
        inFileSkipped++;
        continue;
      }
      inFileDedup.add(pairKey);
      toCreate.push({ category: normCategory, assetGroupId: groupId });
    }

    if (missing.length > 0) {
      const uniq = [...new Set(missing)];
      const preview = uniq.slice(0, 5).join(", ");
      const extra = uniq.length > 5 ? ` and ${uniq.length - 5} more` : "";
      return ApiError(
        `Asset Group name(s) not found: ${preview}${extra}. Please ensure names match existing groups exactly.`,
        400
      );
    }

    try {
      // Allow same category name across different asset groups by relying on composite unique (category, assetGroupId)
      // and skipping duplicates that already exist in DB
      const result = await prisma.assetCategory.createMany({ data: toCreate, skipDuplicates: true });
      return Success({ 
        message: `Uploaded ${result.count} asset category record(s)${inFileSkipped ? ` (skipped ${inFileSkipped} duplicate row(s) in file)` : ''}`,
        inserted: result.count,
        skippedInFile: inFileSkipped,
      }, 201);
    } catch (dbError: any) {
      console.error("Asset categories bulk insert error:", dbError);
      // With skipDuplicates: true, unique violations should not throw; if they do, surface a generic error.
      return ApiError("Failed to insert records. Please check your data.", 500);
    }
  } catch (e: any) {
    console.error("Asset categories upload error:", e);
    return ApiError(e?.message || "Failed to process uploaded file");
  }
}
