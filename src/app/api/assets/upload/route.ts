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

function excelSerialToDate(n: number): Date {
  const epoch = new Date(Date.UTC(1899, 11, 30));
  const ms = Math.round(n * 24 * 60 * 60 * 1000);
  return new Date(epoch.getTime() + ms);
}

function parseDateFlexible(v: any): Date | null {
  if (v == null || v === "") return null;
  if (v instanceof Date && !isNaN(v.getTime())) return v;
  if (typeof v === "number" && isFinite(v)) {
    try {
      const d = excelSerialToDate(v);
      if (!isNaN(d.getTime())) return d;
    } catch {}
  }
  const s = String(v).trim();
  const m1 = s.match(/^([0-3]?\d)\/(0?\d|1[0-2])\/(\d{4})$/);
  if (m1) {
    const dd = parseInt(m1[1], 10);
    const mm = parseInt(m1[2], 10);
    const yy = parseInt(m1[3], 10);
    const d = new Date(yy, mm - 1, dd);
    if (!isNaN(d.getTime())) return d;
  }
  const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m2) {
    const yy = parseInt(m2[1], 10);
    const mm = parseInt(m2[2], 10);
    const dd = parseInt(m2[3], 10);
    const d = new Date(yy, mm - 1, dd);
    if (!isNaN(d.getTime())) return d;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

// POST /api/assets/upload - Upload Excel file and bulk create assets
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
    const rows = XLSX.utils.sheet_to_json(worksheet) as any[];
    if (!rows || rows.length === 0) return ApiError("No data found in Excel file", 400);

    const errors: string[] = [];
    type Draft = {
      assetGroupName: string;
      assetCategory: string;
      assetName: string;
      make: string | null;
      description: string | null;
      purchaseDate: Date | null;
      invoiceNo: string | null;
      supplier: string | null;
      nextMaintenanceDate: Date | null;
      status: string | null;
      useStatus: string | null;
      currentSiteId: number | null;
    };
    const drafts: Draft[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;
      const assetGroupName = nil(
        row["assetGroup*"] || row["Asset Group Name*"] || row["Asset Group Name"] || row["assetGroupName"] || row["assetGroup"]
      );
      const assetCategory = nil(
        row["assetCategory*"] || row["Asset Category*"] || row["Asset Category"] || row["assetCategory"]
      );
      const assetName = nil(
        row["assetName*"] || row["Asset Name*"] || row["Asset Name"] || row["assetName"]
      );
      const status = nil(row["status*"] || row["Status*"] || row["Status"] || row["status"]);
      const useStatus = nil(row["useStatus*"] || row["Use Status*"] || row["Use Status"] || row["useStatus"]);
      const make = nil(row["make"] || row["Make"]);
      const description = nil(row["description"] || row["Description"]);
      const purchaseDateRaw = row["purchaseDate(YYYY-MM-DD)"] || row["Purchase Date (YYYY-MM-DD)"] || row["Purchase Date"] || row["purchaseDate"];
      const invoiceNo = nil(row["invoiceNo(YYYY-MM-DD)"] || row["Invoice No"] || row["invoiceNo"]);
      const supplier = nil(row["supplier"] || row["Supplier"]);
      const nextMaintenanceDateRaw = row["nextMaintenanceDate(YYYY-MM-DD)"] || row["Next Maintenance Date (YYYY-MM-DD)"] || row["Next Maintenance Date"] || row["nextMaintenanceDate"];
      const currentSiteIdRaw = row["currentSiteId"] || row["Current Site ID"];

      const rowErrors: string[] = [];
      if (!assetGroupName) rowErrors.push("Asset Group Name is required");
      if (!assetCategory) rowErrors.push("Asset Category is required");
      if (!assetName) rowErrors.push("Asset Name is required");
      if (!status) rowErrors.push("Status is required");
      if (!useStatus) rowErrors.push("Use Status is required");
      if (rowErrors.length) {
        errors.push(`Row ${rowNum}: ${rowErrors.join(", ")}`);
        continue;
      }

      drafts.push({
        assetGroupName: String(assetGroupName),
        assetCategory: String(assetCategory),
        assetName: String(assetName),
        make: make ? String(make) : null,
        description: description ? String(description) : null,
        purchaseDate: parseDateFlexible(purchaseDateRaw),
        invoiceNo: invoiceNo ? String(invoiceNo) : null,
        supplier: supplier ? String(supplier) : null,
        nextMaintenanceDate: parseDateFlexible(nextMaintenanceDateRaw),
        status: status ? String(status) : null,
        useStatus: useStatus ? String(useStatus) : null,
        currentSiteId: currentSiteIdRaw != null && String(currentSiteIdRaw).trim() !== '' && !isNaN(Number(currentSiteIdRaw))
          ? Number(currentSiteIdRaw)
          : null,
      });
    }

    if (errors.length) {
      const summary = `Found ${errors.length} validation error(s): ${errors.slice(0, 5).join('; ')}${errors.length > 5 ? `; ... and ${errors.length - 5} more errors` : ''}`;
      return ApiError(summary, 400);
    }

    if (drafts.length === 0) return ApiError("No valid records found to import", 400);

    // Resolve group/category names to IDs
    const uniqueGroupNames = [...new Set(drafts.map(d => d.assetGroupName.trim()))];
    const groups = await prisma.assetGroup.findMany({
      where: { assetGroupName: { in: uniqueGroupNames } },
      select: { id: true, assetGroupName: true },
    });
    const groupMap = new Map<string, number>();
    groups.forEach(g => groupMap.set(g.assetGroupName.toLowerCase().trim(), g.id));

    const missingGroups: string[] = [];
    const categoryKeys = new Set<string>(); // key: `${groupId}|${category}`
    for (const d of drafts) {
      const gid = groupMap.get(d.assetGroupName.toLowerCase().trim());
      if (!gid) missingGroups.push(d.assetGroupName);
      else categoryKeys.add(`${gid}|${d.assetCategory.toLowerCase().trim()}`);
    }
    if (missingGroups.length) {
      const uniqueMissing = [...new Set(missingGroups)];
      const list = uniqueMissing.slice(0, 5).join(', ');
      const extra = uniqueMissing.length > 5 ? ` and ${uniqueMissing.length - 5} more` : '';
      return ApiError(`Asset Group(s) not found: ${list}${extra}.`, 400);
    }

    // Fetch categories for all involved group/category pairs
    const allGroupIds = [...new Set(drafts.map(d => groupMap.get(d.assetGroupName.toLowerCase().trim()) as number))];
    const categories = await prisma.assetCategory.findMany({
      where: { assetGroupId: { in: allGroupIds } },
      select: { id: true, assetGroupId: true, category: true },
    });
    const catMap = new Map<string, number>();
    categories.forEach(c => catMap.set(`${c.assetGroupId}|${c.category.toLowerCase().trim()}`, c.id));

    const missingCategories: string[] = [];
    for (const d of drafts) {
      const gid = groupMap.get(d.assetGroupName.toLowerCase().trim())!;
      const cid = catMap.get(`${gid}|${d.assetCategory.toLowerCase().trim()}`);
      if (!cid) missingCategories.push(`${d.assetCategory} (Group: ${d.assetGroupName})`);
    }
    if (missingCategories.length) {
      const uniqueMissing = [...new Set(missingCategories)];
      const list = uniqueMissing.slice(0, 5).join(', ');
      const extra = uniqueMissing.length > 5 ? ` and ${uniqueMissing.length - 5} more` : '';
      return ApiError(`Asset Category not found for: ${list}${extra}.`, 400);
    }

    // Validate currentSiteId values if provided
    const siteIds = [...new Set(drafts.map(d => d.currentSiteId).filter((v): v is number => typeof v === 'number'))];
    if (siteIds.length > 0) {
      const existingSites = await prisma.site.findMany({ where: { id: { in: siteIds } }, select: { id: true } });
      const existingSet = new Set(existingSites.map(s => s.id));
      const missing = siteIds.filter(id => !existingSet.has(id));
      if (missing.length > 0) {
        return ApiError(`Site ID(s) not found: ${missing.slice(0,5).join(', ')}${missing.length>5?` and ${missing.length-5} more`:''}`, 400);
      }
    }

    // Prepare plain records with resolved IDs
    const toInsert = drafts.map(d => {
      const gid = groupMap.get(d.assetGroupName.toLowerCase().trim())!;
      const cid = catMap.get(`${gid}|${d.assetCategory.toLowerCase().trim()}`)!;
      return {
        assetGroupId: gid,
        assetCategoryId: cid,
        assetName: d.assetName.trim(),
        make: d.make,
        description: d.description,
        purchaseDate: d.purchaseDate || undefined,
        invoiceNo: d.invoiceNo,
        supplier: d.supplier,
        nextMaintenanceDate: d.nextMaintenanceDate || undefined,
        status: d.status || undefined,
        useStatus: d.useStatus || undefined,
        currentSiteId: d.currentSiteId ?? undefined,
      };
    });

    // Generate asset numbers similar to single create: use highest assetNo and increment numeric suffix
    const lastByAssetNo = await prisma.asset.findFirst({ orderBy: { assetNo: 'desc' }, select: { assetNo: true } });
    let baseSeq = 0;
    if (lastByAssetNo?.assetNo) {
      const m = lastByAssetNo.assetNo.match(/(\d+)$/);
      baseSeq = m ? parseInt(m[1], 10) : 0;
    }

    // Insert sequentially to ensure distinct assetNo; wrap in a transaction
    const createdCount = await prisma.$transaction(async (tx) => {
      let count = 0;
      let seq = baseSeq;
      for (const rec of toInsert) {
        seq += 1;
        const assetNo = `AST-${seq.toString().padStart(5, '0')}`;
        await tx.asset.create({ data: { ...rec, assetNo } });
        count += 1;
      }
      return count;
    });

    return Success({ message: `Successfully uploaded ${createdCount} asset record(s)`, count: createdCount }, 201);
  } catch (e: any) {
    console.error("Assets upload error:", e);
    let msg = e?.message || 'Failed to process uploaded file';
    return ApiError(msg, 500);
  }
}
