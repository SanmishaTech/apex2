import { NextRequest, NextResponse } from "next/server";
import { guardApiAccess } from "@/lib/access-guard";
import { Success, Error as ApiError, BadRequest } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

function val(v: any) {
  if (v == null || v === undefined) return null;
  if (typeof v === "string") return v.trim();
  return String(v).trim();
}

// POST /api/vendors/upload - Upload Excel and bulk create vendors
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
      vendorName: string;
      contactPersonName: string;
      addressLine1: string;
      addressLine2?: string | null;
      state?: string | null;
      city?: string | null;
      pincode?: string | null;
      mobile1?: string | null;
      mobile2?: string | null;
      email?: string | null;
      alternateEmail1?: string | null;
      alternateEmail2?: string | null;
      alternateEmail3?: string | null;
      alternateEmail4?: string | null;
      landline1?: string | null;
      landline2?: string | null;
      bankName?: string | null;
      branchName?: string | null;
      branchCode?: string | null;
      accountNumber?: string | null;
      ifscCode?: string | null;
      panNumber?: string | null;
      gstNumber?: string | null;
      vatTinNumber?: string | null;
      cstInNumber?: string | null;
      cinNumber?: string | null;
      serviceTaxNumber?: string | null;
      stateCode?: string | null;
    };

    const errors: string[] = [];
    const records: Row[] = [];

    // Preload State and City maps for validation and mapping
    const [allStates, allCities] = await Promise.all([
      prisma.state.findMany({ select: { id: true, state: true } }),
      prisma.city.findMany({ select: { id: true, city: true } }),
    ]);
    const stateMap = new Map(
      allStates.map((s) => [s.state.toLowerCase(), s.id])
    );
    const cityMap = new Map(allCities.map((c) => [c.city.toLowerCase(), c.id]));

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 2;
      const vendorName = val(row["vendorName*"] ?? row["vendorName"]);
      const contactPersonName = val(
        row["contactPersonName*"] ?? row["contactPersonName"]
      );
      const addressLine1 = val(row["addressLine1*"] ?? row["addressLine1"]);
      const addressLine2 = val(row["addressLine2*"] ?? row["addressLine2"]);
      const state = val(row["state*"] ?? row["state"]);
      const city = val(row["city*"] ?? row["city"]);

      if (!vendorName) errors.push(`Row ${rowNum}: vendorName is required`);
      if (!contactPersonName)
        errors.push(`Row ${rowNum}: contactPersonName is required`);
      if (!addressLine1) errors.push(`Row ${rowNum}: addressLine1 is required`);
      // state and city are optional in import

      const rec: Row = {
        vendorName: vendorName || "",
        contactPersonName: contactPersonName || "",
        addressLine1: addressLine1 || "",
        addressLine2: addressLine2 || null,
        state: state || null,
        city: city || null,
        pincode: val(row["pincode"]) || null,
        mobile1: val(row["mobile1"]) || null,
        mobile2: val(row["mobile2"]) || null,
        email: val(row["email"]) || null,
        alternateEmail1: val(row["alternateEmail1"]) || null,
        alternateEmail2: val(row["alternateEmail2"]) || null,
        alternateEmail3: val(row["alternateEmail3"]) || null,
        alternateEmail4: val(row["alternateEmail4"]) || null,
        landline1: val(row["landline1"]) || null,
        landline2: val(row["landline2"]) || null,
        bankName: val(row["bankName"]) || null,
        branchName: val(row["branchName"]) || null,
        branchCode: val(row["branchCode"]) || null,
        accountNumber: val(row["accountNumber"]) || null,
        ifscCode: val(row["ifscCode"]) || null,
        panNumber: val(row["panNumber"]) || null,
        gstNumber: val(row["gstNumber"]) || null,
        vatTinNumber: val(row["vatTinNumber"]) || null,
        cstInNumber: val(row["cstInNumber"]) || null,
        cinNumber: val(row["cinNumber"]) || null,
        serviceTaxNumber: val(row["serviceTaxNumber"]) || null,
        stateCode: val(row["stateCode"]) || null,
      };
      records.push(rec);

      const stateName = (rec.state || "").toLowerCase();
      const cityName = (rec.city || "").toLowerCase();
      if (stateName && !stateMap.has(stateName)) {
        errors.push(`Row ${rowNum}: state '${rec.state}' not found in States master`);
      }
      if (cityName && !cityMap.has(cityName)) {
        errors.push(`Row ${rowNum}: city '${rec.city}' not found in Cities master`);
      }
    }

    if (errors.length) {
      return NextResponse.json(
        { message: `Found ${errors.length} validation error(s)`, errors },
        { status: 400 }
      );
    }

    if (!records.length) return ApiError("No valid rows to import", 400);

    let createdCount = 0;
    await prisma.$transaction(async (tx) => {
      for (const r of records) {
        const stateName = (r.state || "").toLowerCase();
        const cityName = (r.city || "").toLowerCase();
        const stateId = stateName ? stateMap.get(stateName) ?? null : null;
        const cityId = cityName ? cityMap.get(cityName) ?? null : null;
        await tx.vendor.create({
          data: {
            vendorName: r.vendorName,
            contactPerson: r.contactPersonName,
            addressLine1: r.addressLine1,
            addressLine2: r.addressLine2,
            stateId: stateId ?? null,
            cityId: cityId ?? null,
            pincode: r.pincode,
            mobile1: r.mobile1,
            mobile2: r.mobile2,
            email: r.email,
            alternateEmail1: r.alternateEmail1,
            alternateEmail2: r.alternateEmail2,
            alternateEmail3: r.alternateEmail3,
            alternateEmail4: r.alternateEmail4,
            landline1: r.landline1,
            landline2: r.landline2,
            bank: r.bankName,
            branch: r.branchName,
            branchCode: r.branchCode,
            accountNumber: r.accountNumber,
            ifscCode: r.ifscCode,
            panNumber: r.panNumber,
            gstNumber: r.gstNumber,
            vatTinNumber: r.vatTinNumber,
            cstTinNumber: r.cstInNumber,
            cinNumber: r.cinNumber,
            serviceTaxNumber: r.serviceTaxNumber,
            stateCode: r.stateCode,
          },
        });
        createdCount++;
      }
    });

    return Success(
      {
        message: `Successfully uploaded ${createdCount} vendor(s)`,
        count: createdCount,
      },
      201
    );
  } catch (e: any) {
    console.error("Vendors upload error:", e);
    return ApiError(e?.message || "Failed to process uploaded file");
  }
}
