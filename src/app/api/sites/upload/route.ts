import { NextRequest } from "next/server";
import { guardApiAccess } from "@/lib/access-guard";
import { Success, Error as ApiError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

function val(v: any) {
  if (v == null) return null;
  if (typeof v === "string") {
    const t = v.trim();
    return t === "" ? null : t;
  }
  return v;
}

function normalizeStatus(v: any):
  | "ONGOING"
  | "HOLD"
  | "CLOSED"
  | "COMPLETED"
  | "MOBILIZATION_STAGE" {
  const s = String(v ?? "ONGOING").trim();
  const up = s.toUpperCase().replace(/\s+/g, "_");
  const allowed = new Set([
    "ONGOING",
    "HOLD",
    "CLOSED",
    "COMPLETED",
    "MOBILIZATION_STAGE",
  ]);
  if (allowed.has(up)) return up as any;
  // Accept human labels like Ongoing, Hold, Closed, Completed, Mobilization Stage
  switch (s.toLowerCase()) {
    case "ongoing":
      return "ONGOING";
    case "hold":
      return "HOLD";
    case "closed":
      return "CLOSED";
    case "completed":
      return "COMPLETED";
    case "mobilization stage":
      return "MOBILIZATION_STAGE";
    default:
      return "ONGOING";
  }
}

// POST /api/sites/upload - Upload Excel file and bulk create sites
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
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]) as any[];
    if (!data.length) return ApiError("No data found in Excel file", 400);

    type Row = {
      siteCode: string;
      site: string;
      status: "ONGOING" | "HOLD" | "CLOSED" | "COMPLETED" | "MOBILIZATION_STAGE";
      siteContactPersonName: string;
      siteContactPersonNumber: string;
      siteContactPersonEmail: string | null;
      companyName: string;
      shortName: string | null;
      pinCode: string | null;
      longitude: string | null;
      latitude: string | null;
      state: string | null;
      city: string | null;
      addressLine1: string | null;
      addressLine2: string | null;
      panNo: string | null;
      gstNo: string | null;
      tanNo: string | null;
      cinNo: string | null;
      deliveryAddressLine1: string | null;
      deliveryAddressLine2: string | null;
      deliveryState: string | null;
      deliveryCity: string | null;
      deliveryPincode: string | null;
    };

    const rows: Row[] = [];
    const errors: string[] = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 2;
      const siteCode = val(row["siteCode"]) as string | null;
      const site = val(row["site"]) as string | null;
      const status = val(row["status"]) as string | null;
      const siteContactPersonName = val(row["siteContactPersonName"]) as string | null;
      const siteContactPersonNumberRaw = row["siteContactPersonNumber"];
      const siteContactPersonNumber =
        siteContactPersonNumberRaw == null || siteContactPersonNumberRaw === ""
          ? null
          : String(siteContactPersonNumberRaw).trim();
      const siteContactPersonEmail = val(row["siteContactPersonEmail"]) as string | null;
      const companyName = val(row["companyName"]) as string | null;

      const rowErrors: string[] = [];
      if (!siteCode) rowErrors.push("siteCode is required");
      if (!site) rowErrors.push("site is required");
      if (!status) rowErrors.push("status is required");
      if (!companyName) rowErrors.push("companyName is required");
      if (!siteContactPersonName) rowErrors.push("siteContactPersonName is required");
      if (!siteContactPersonNumber) rowErrors.push("siteContactPersonNumber is required");
      if (rowErrors.length) {
        errors.push(`Row ${rowNum}: ${rowErrors.join(", ")}`);
        continue;
      }

      rows.push({
        siteCode: String(siteCode),
        site: site as string,
        status: normalizeStatus(status!),
        siteContactPersonName: siteContactPersonName as string,
        siteContactPersonNumber: siteContactPersonNumber as string,
        siteContactPersonEmail: siteContactPersonEmail as string | null,
        companyName: companyName as string,
        shortName: val(row["shortName"]) as any,
        pinCode:
          row["pinCode"] == null || row["pinCode"] === ""
            ? null
            : String(row["pinCode"]).trim(),
        longitude:
          row["longitude"] == null || row["longitude"] === ""
            ? null
            : String(row["longitude"]).trim(),
        latitude:
          row["latitude"] == null || row["latitude"] === ""
            ? null
            : String(row["latitude"]).trim(),
        state: val(row["state"]) as any,
        city: val(row["city"]) as any,
        addressLine1: val(row["addressLine1"]) as any,
        addressLine2: val(row["addressLine2"]) as any,
        panNo: val(row["panNo"]) as any,
        gstNo: val(row["gstNo"]) as any,
        tanNo: val(row["tanNo"]) as any,
        cinNo: val(row["cinNo"]) as any,
        deliveryAddressLine1: val(row["deliveryAddressLine1"]) as any,
        deliveryAddressLine2: val(row["deliveryAddressLine2"]) as any,
        deliveryState: val(row["deliveryState"]) as any,
        deliveryCity: val(row["deliveryCity"]) as any,
        deliveryPincode:
          row["deliveryPincode"] == null || row["deliveryPincode"] === ""
            ? null
            : String(row["deliveryPincode"]).trim(),
      });
    }

    if (errors.length) {
      return ApiError(
        `Found ${errors.length} validation error(s): ${errors.slice(0, 10).join("; ")}${
          errors.length > 10 ? `; ... and ${errors.length - 10} more` : ""
        }`,
        400
      );
    }

    if (rows.length === 0) return ApiError("No valid rows to import", 400);

    // Validate duplicates inside the uploaded file (siteCode + site are unique in DB)
    const siteCodeCounts = new Map<string, number>();
    const siteNameCounts = new Map<string, number>();
    for (const r of rows) {
      const code = String(r.siteCode || "").trim();
      const name = String(r.site || "").trim();
      if (code) siteCodeCounts.set(code, (siteCodeCounts.get(code) || 0) + 1);
      if (name) siteNameCounts.set(name, (siteNameCounts.get(name) || 0) + 1);
    }

    const dupSiteCodes = Array.from(siteCodeCounts.entries())
      .filter(([, c]) => c > 1)
      .map(([k]) => k);
    if (dupSiteCodes.length) {
      const list = dupSiteCodes.slice(0, 5).join(", ");
      const extra = dupSiteCodes.length > 5 ? ` and ${dupSiteCodes.length - 5} more` : "";
      return ApiError(`Duplicate siteCode in upload: ${list}${extra}.`, 400);
    }

    const dupSiteNames = Array.from(siteNameCounts.entries())
      .filter(([, c]) => c > 1)
      .map(([k]) => k);
    if (dupSiteNames.length) {
      const list = dupSiteNames.slice(0, 5).join(", ");
      const extra = dupSiteNames.length > 5 ? ` and ${dupSiteNames.length - 5} more` : "";
      return ApiError(`Duplicate site name in upload: ${list}${extra}.`, 400);
    }

    // Validate against existing DB uniques (fail fast with helpful message)
    const uniqueSiteCodes = [...new Set(rows.map((r) => String(r.siteCode).trim()))].filter(Boolean);
    const uniqueSiteNames = [...new Set(rows.map((r) => String(r.site).trim()))].filter(Boolean);
    const existingSites = await prisma.site.findMany({
      where: {
        OR: [
          { siteCode: { in: uniqueSiteCodes } },
          { site: { in: uniqueSiteNames } },
        ],
      },
      select: { siteCode: true, site: true },
    });
    if (existingSites.length) {
      const existingCodes = existingSites
        .map((s) => s.siteCode)
        .filter((v): v is string => typeof v === "string" && v.trim() !== "");
      const existingNames = existingSites
        .map((s) => s.site)
        .filter((v): v is string => typeof v === "string" && v.trim() !== "");

      if (existingCodes.length) {
        const list = existingCodes.slice(0, 5).join(", ");
        const extra = existingCodes.length > 5 ? ` and ${existingCodes.length - 5} more` : "";
        return ApiError(`Site Code already exists: ${list}${extra}.`, 400);
      }
      if (existingNames.length) {
        const list = existingNames.slice(0, 5).join(", ");
        const extra = existingNames.length > 5 ? ` and ${existingNames.length - 5} more` : "";
        return ApiError(`Site name already exists: ${list}${extra}.`, 400);
      }
    }

    // Resolve companies
    const uniqueCompanies = [...new Set(rows.map((r) => r.companyName))];
    const companies = await prisma.company.findMany({
      where: { companyName: { in: uniqueCompanies } },
      select: { id: true, companyName: true },
    });
    const companyMap = new Map<string, number>();
    companies.forEach((c) => companyMap.set(c.companyName, c.id));

    const missingCompanies = uniqueCompanies.filter((c) => !companyMap.has(c));
    if (missingCompanies.length) {
      const list = missingCompanies.slice(0, 5).join(", ");
      const extra = missingCompanies.length > 5 ? ` and ${missingCompanies.length - 5} more` : "";
      return ApiError(`Company not found: ${list}${extra}.`, 400);
    }

    // Resolve states/cities if provided (for main and delivery addresses)
    const uniqueStates = [
      ...new Set([
        ...rows.map((r) => r.state).filter(Boolean),
        ...rows.map((r) => r.deliveryState).filter(Boolean),
      ] as string[]),
    ];
    const uniqueCities = [
      ...new Set([
        ...rows.map((r) => r.city).filter(Boolean),
        ...rows.map((r) => r.deliveryCity).filter(Boolean),
      ] as string[]),
    ];

    const states = uniqueStates.length
      ? await prisma.state.findMany({ where: { state: { in: uniqueStates } }, select: { id: true, state: true } })
      : [];
    const stateMap = new Map<string, number>();
    states.forEach((s) => stateMap.set(s.state, s.id));

    const cities = uniqueCities.length
      ? await prisma.city.findMany({ where: { city: { in: uniqueCities } }, select: { id: true, city: true, stateId: true } })
      : [];
    const cityMap = new Map<string, { id: number; stateId: number | null }>();
    cities.forEach((c) => cityMap.set(c.city, { id: c.id, stateId: c.stateId ?? null }));

    // Create sites in a transaction so we can also insert contact person per row
    const createdCount = await prisma.$transaction(async (tx) => {
      let count = 0;
      for (const r of rows) {
        const companyId = companyMap.get(r.companyName)!;
        const stateId = r.state ? stateMap.get(r.state) ?? null : null;
        const cityObj = r.city ? cityMap.get(r.city) ?? null : null;
        const site = await tx.site.create({
          data: {
            siteCode: r.siteCode,
            site: r.site,
            shortName: r.shortName,
            companyId,
            status: r.status,
            addressLine1: r.addressLine1,
            addressLine2: r.addressLine2,
            stateId,
            cityId: cityObj?.id ?? null,
            pinCode: r.pinCode,
            longitude: r.longitude,
            latitude: r.latitude,
            panNo: r.panNo,
            gstNo: r.gstNo,
            tanNo: r.tanNo,
            cinNo: r.cinNo,
          },
          select: { id: true },
        });
        // One primary contact person (required by import spec)
        if (r.siteContactPersonName && r.siteContactPersonNumber) {
          await tx.siteContactPerson.create({
            data: {
              siteId: site.id,
              name: r.siteContactPersonName,
              contactNo: r.siteContactPersonNumber,
              email: r.siteContactPersonEmail ?? null,
            },
          });
        }

        // Optional delivery address
        const anyDeliveryField =
          r.deliveryAddressLine1 ||
          r.deliveryAddressLine2 ||
          r.deliveryState ||
          r.deliveryCity ||
          r.deliveryPincode;
        if (anyDeliveryField) {
          const dStateId = r.deliveryState ? stateMap.get(r.deliveryState) ?? null : null;
          const dCityObj = r.deliveryCity ? cityMap.get(r.deliveryCity) ?? null : null;
          await tx.siteDeliveryAddress.create({
            data: {
              siteId: site.id,
              addressLine1: r.deliveryAddressLine1,
              addressLine2: r.deliveryAddressLine2,
              stateId: dStateId,
              cityId: dCityObj?.id ?? null,
              pinCode: r.deliveryPincode,
            },
          });
        }
        count += 1;
      }
      return count;
    });

    return Success({ message: `Successfully uploaded ${createdCount} site(s)`, count: createdCount }, 201);
  } catch (e: any) {
    console.error("Sites upload error:", e);
    return ApiError(e?.message || "Failed to process uploaded file");
  }
}
