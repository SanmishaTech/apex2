import { NextRequest } from "next/server";
import { guardApiAccess } from "@/lib/access-guard";
import { Success, Error as ApiError, BadRequest } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

function val(v: any) {
  if (v == null || v === undefined) return null;
  if (typeof v === "string") return v.trim();
  return String(v).trim();
}

function isValidEmail(email: string) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

// POST /api/billing-addresses/upload - Upload Excel file and bulk create billing addresses
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
    if (!validTypes.includes(file.type) && !file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      return ApiError("Invalid file type. Please upload an Excel file (.xlsx or .xls)", 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buffer, { type: "buffer" });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) return ApiError("Excel file is empty", 400);

    const ws = wb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(ws) as any[];
    if (!data || data.length === 0) return ApiError("No data found in Excel file", 400);

    const errors: string[] = [];
    type Row = {
      companyName: string;
      addressLine1: string;
      addressLine2?: string | null;
      stateName?: string | null;
      cityName?: string | null;
      pincode?: string | null;
      landline1?: string | null;
      landline2?: string | null;
      fax?: string | null;
      email?: string | null;
      panNumber?: string | null;
      vatTinNumber?: string | null;
      gstNumber?: string | null;
      cstTinNumber?: string | null;
      cinNumber?: string | null;
      stateCode?: string | null;
    };

    const records: Row[] = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 2; // header row is 1
      const companyName = val(row["companyName*"] ?? row["Company Name*"] ?? row["Company Name"] ?? row["companyName"]);
      const addressLine1 = val(row["addressLine1*"] ?? row["Address Line 1*"] ?? row["Address Line 1"] ?? row["addressLine1"]);
      if (!companyName) errors.push(`Row ${rowNum}: Company Name is required`);
      if (!addressLine1) errors.push(`Row ${rowNum}: Address Line 1 is required`);

      const email = val(row["Email"] ?? row["email"]);
      if (email && !isValidEmail(email)) errors.push(`Row ${rowNum}: Invalid email format`);

      const rec: Row = {
        companyName: companyName || "",
        addressLine1: addressLine1 || "",
        addressLine2: val(row["Address Line 2"] ?? row["addressLine2"]) || null,
        stateName: val(row["State"] ?? row["state"]) || null,
        cityName: val(row["City"] ?? row["city"]) || null,
        pincode: val(row["Pincode"] ?? row["pincode"]) || null,
        landline1: val(row["Landline1"] ?? row["Landline 1"] ?? row["landline1"]) || null,
        landline2: val(row["Landline2"] ?? row["Landline 2"] ?? row["landline2"]) || null,
        fax: val(row["Fax"] ?? row["fax"]) || null,
        email: (email as string) || null,
        panNumber: val(row["PAN"] ?? row["panNumber"]) || null,
        vatTinNumber: val(row["VAT TIN"] ?? row["vatTinNumber"]) || null,
        gstNumber: val(row["GST"] ?? row["gstNumber"]) || null,
        cstTinNumber: val(row["CST TIN"] ?? row["cstTinNumber"]) || null,
        cinNumber: val(row["CIN"] ?? row["cinNumber"]) || null,
        stateCode: val(row["State Code"] ?? row["stateCode"]) || null,
      };
      records.push(rec);
    }

    if (errors.length > 0) {
      const msg = `Found ${errors.length} validation error(s): ${errors.slice(0, 5).join("; ")}${errors.length > 5 ? `; ... and ${errors.length - 5} more errors` : ""}`;
      return ApiError(msg, 400);
    }

    if (records.length === 0) return ApiError("No valid records found to import", 400);

    // Preload state and city maps by name (case-insensitive)
    const states = await prisma.state.findMany({ select: { id: true, state: true } });
    const cities = await prisma.city.findMany({ select: { id: true, city: true } });
    const stateMap = new Map<string, number>();
    for (const s of states) stateMap.set(s.state.toLowerCase(), s.id);
    const cityMap = new Map<string, number>();
    for (const c of cities) cityMap.set(c.city.toLowerCase(), c.id);

    let createdCount = 0;
    await prisma.$transaction(async (tx) => {
      for (const r of records) {
        const stateId = r.stateName && stateMap.has(r.stateName.toLowerCase()) ? (stateMap.get(r.stateName.toLowerCase()) as number) : null;
        const cityId = r.cityName && cityMap.has(r.cityName.toLowerCase()) ? (cityMap.get(r.cityName.toLowerCase()) as number) : null;

        await tx.billingAddress.create({
          data: {
            companyName: r.companyName,
            addressLine1: r.addressLine1,
            addressLine2: r.addressLine2,
            stateId,
            cityId,
            pincode: r.pincode,
            landline1: r.landline1,
            landline2: r.landline2,
            fax: r.fax,
            email: r.email,
            panNumber: r.panNumber,
            vatTinNumber: r.vatTinNumber,
            gstNumber: r.gstNumber,
            cstTinNumber: r.cstTinNumber,
            cinNumber: r.cinNumber,
            stateCode: r.stateCode,
          },
        });
        createdCount++;
      }
    });

    return Success({ message: `Successfully uploaded ${createdCount} billing address(es)`, count: createdCount }, 201);
  } catch (e: any) {
    console.error("Billing addresses upload error:", e);
    return ApiError(e?.message || "Failed to process uploaded file");
  }
}
