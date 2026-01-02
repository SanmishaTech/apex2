import { NextRequest } from "next/server";
import { guardApiAccess } from "@/lib/access-guard";
import { Success, Error as ApiError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

function val(v: any) {
  if (v == null || v === undefined) return null;
  if (typeof v === "string") return v.trim();
  return String(v).trim();
}

function yesNoToBool(v: any): boolean | null {
  const s = (val(v) || "").toString().toLowerCase();
  if (!s) return null;
  if (["y", "yes", "true", "1"].includes(s)) return true;
  if (["n", "no", "false", "0"].includes(s)) return false;
  return null;
}

// Read a boolean from multiple possible column headers, also tolerating headers that include suffixes like '(Yes/No)'
function readYesNoFromRow(row: any, keys: string[]): boolean | null {
  // Direct lookup first
  for (const k of keys) {
    if (row[k] !== undefined) {
      const b = yesNoToBool(row[k]);
      if (b !== null) return b;
    }
  }
  // Relaxed header matching: normalize by removing everything after '(' and trimming
  const normalized = new Map<string, any>();
  for (const key of Object.keys(row)) {
    const nk = String(key).toLowerCase().split("(")[0].trim();
    normalized.set(nk, row[key]);
  }
  for (const k of keys) {
    const nk = String(k).toLowerCase().split("(")[0].trim();
    if (normalized.has(nk)) {
      const b = yesNoToBool(normalized.get(nk));
      if (b !== null) return b;
    }
  }
  return null;
}

async function generateItemCode(): Promise<string> {
  const lastItem = await prisma.item.findFirst({
    orderBy: { id: "desc" },
    select: { itemCode: true },
  });
  let nextNumber = 1;
  if (lastItem?.itemCode) {
    const match = lastItem.itemCode.match(/ITM-(\d+)/);
    if (match) nextNumber = parseInt(match[1], 10) + 1;
  }
  return `ITM-${String(nextNumber).padStart(5, "0")}`;
}

// POST /api/items/upload - Upload Excel and bulk create items
export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) return ApiError("No file uploaded", 400);

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

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return ApiError("Excel file is empty", 400);
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet) as any[];
    if (!data || data.length === 0)
      return ApiError("No data found in Excel file", 400);

    type Row = {
      item: string;
      itemCategory: string;
      unit: string;
      isAsset?: boolean | null;
      discontinue?: boolean | null;
      gstRate?: number | null;
      hsnCode?: string | null;
      description?: string | null;
    };

    const errors: string[] = [];
    const records: Row[] = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 2; // header is row 1
      const item = val(row["item*"] ?? row["item"]) || "";
      const category = val(row["itemCategory*"] ?? row["itemCategory"]) || "";
      const unit = val(row["unit*"] ?? row["unit"]) || "";
      if (!item) errors.push(`Row ${rowNum}: item is required`);
      if (!category) errors.push(`Row ${rowNum}: itemCategory is required`);
      if (!unit) errors.push(`Row ${rowNum}: unit is required`);

      const isAsset = readYesNoFromRow(row, [
        "isAsset*",
        "isAsset",
        "isAsset*(Yes/No)",
        "isAsset (Yes/No)",
      ]);
      const discontinue = readYesNoFromRow(row, [
        "Discountinue*",
        "Discountinue",
        "Discontinue*",
        "Discontinue",
        "discountinew*",
        "discountinew",
        "discontinue*",
        "discontinue",
        "Discountinue*(Yes/No)",
        "Discontinue*(Yes/No)",
        "discontinue (Yes/No)",
      ]);

      const gstRateVal = row["gstRate(%)"] ?? row["gstRate"];
      const gstRate =
        gstRateVal === undefined || gstRateVal === null || gstRateVal === ""
          ? null
          : Number(gstRateVal);
      if (gstRate !== null && !isFinite(gstRate)) {
        errors.push(`Row ${rowNum}: gstRate(%) must be a number`);
      }

      const rec: Row = {
        item: item as string,
        itemCategory: category as string,
        unit: unit as string,
        isAsset,
        discontinue,
        gstRate: gstRate === null ? null : Number(gstRate),
        hsnCode: val(row["hsnCode"]) || null,
        description: val(row["description"]) || null,
      };
      records.push(rec);
    }

    if (errors.length) {
      const msg = `Found ${errors.length} validation error(s): ${errors
        .slice(0, 10)
        .join("; ")}${
        errors.length > 10 ? `; ... and ${errors.length - 10} more` : ""
      }`;
      return ApiError(msg, 400);
    }

    if (!records.length) return ApiError("No valid rows to import", 400);

    // Preload categories and units maps
    const [allCats, allUnits] = await Promise.all([
      prisma.itemCategory.findMany({
        select: { id: true, itemCategory: true },
      }),
      prisma.unit.findMany({ select: { id: true, unitName: true } }),
    ]);
    const catMap = new Map(
      allCats.map((c) => [c.itemCategory.toLowerCase(), c.id])
    );
    const unitMap = new Map(
      allUnits.map((u) => [u.unitName.toLowerCase(), u.id])
    );

    let createdCount = 0;
    await prisma.$transaction(async (tx) => {
      // Determine starting sequence number inside the same transaction
      const last = await tx.item.findFirst({
        orderBy: { id: "desc" },
        select: { itemCode: true },
      });
      let nextNumber = 1;
      if (last?.itemCode) {
        const match = last.itemCode.match(/ITM-(\d+)/);
        if (match) nextNumber = parseInt(match[1], 10) + 1;
      }

      for (const r of records) {
        const catId = catMap.get((r.itemCategory || "").toLowerCase());
        const unitId = unitMap.get((r.unit || "").toLowerCase());
        if (!catId || !unitId) {
          throw new Error(
            `Missing reference: Category '${r.itemCategory}' or Unit '${r.unit}' not found`
          );
        }

        let attempts = 0;
        while (true) {
          const itemCode = `ITM-${String(nextNumber).padStart(5, "0")}`;
          nextNumber++;
          try {
            await tx.item.create({
              data: {
                itemCode,
                item: r.item,
                itemCategoryId: catId,
                unitId: unitId,
                asset: Boolean(r.isAsset ?? false),
                discontinue: Boolean(r.discontinue ?? false),
                gstRate: r.gstRate === null ? null : (r.gstRate as any),
                hsnCode: r.hsnCode,
                description: r.description,
              },
            });
            createdCount++;
            break;
          } catch (e: any) {
            if (e?.code === "P2002" && attempts < 3) {
              // Collision: try next sequence number
              attempts++;
              continue;
            }
            throw e;
          }
        }
      }
    });

    return Success(
      {
        message: `Successfully uploaded ${createdCount} item(s)`,
        count: createdCount,
      },
      201
    );
  } catch (e: any) {
    console.error("Items upload error:", e);
    return ApiError(e?.message || "Failed to process uploaded file");
  }
}
