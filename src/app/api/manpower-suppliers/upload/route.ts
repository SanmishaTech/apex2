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

function normalizePan(v: any): string | null {
  const s = val(v);
  if (!s) return null;
  return s.replace(/\s+/g, "").toUpperCase();
}

function normalizeAadhaar(v: any): string | null {
  const s = val(v);
  if (!s) return null;
  return s.replace(/\s+/g, "");
}

function generateVendorCodeForIndex(baseCount: number, index: number) {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, "0");
  const yearMonth = `${year}${month}`;
  const seq = (baseCount + index + 1).toString().padStart(3, "0");
  return `V-${yearMonth}${seq}`;
}

// POST /api/manpower-suppliers/upload - Upload Excel file and bulk create manpower suppliers
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

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return ApiError("Excel file is empty", 400);

    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet) as any[];
    if (!data || data.length === 0)
      return ApiError("No data found in Excel file", 400);

    const errors: string[] = [];
    type Row = {
      supplierName: string;
      contactPerson?: string | null;
      representativeName?: string | null;
      localContactNo?: string | null;
      permanentContactNo?: string | null;
      address?: string | null;
      state?: string | null;
      permanentAddress?: string | null;
      city?: string | null;
      pincode?: string | null;
      bankName?: string | null;
      accountNo?: string | null;
      ifscNo?: string | null;
      rtgsNo?: string | null;
      panNo?: string | null;
      adharNo?: string | null;
      pfNo?: string | null;
      esicNo?: string | null;
      gstNo?: string | null;
      numberOfWorkers?: number | null;
      typeOfWork?: string | null;
      workDone?: string | null;
    };

    const records: Row[] = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 2; // header row is 1
      const supplierName = val(
        row["Supplier Name*"] ?? row["Supplier Name"] ?? row["supplierName"]
      );
      if (!supplierName) {
        errors.push(`Row ${rowNum}: Supplier Name is required`);
        continue;
      }
      const rec: Row = {
        supplierName,
        contactPerson: val(row["Contact Person"] ?? row["contactPerson"]),
        representativeName: val(
          row["Representative Name"] ?? row["representativeName"]
        ),
        localContactNo: val(row["Local Contact No"] ?? row["localContactNo"]),
        permanentContactNo: val(
          row["Permanent Contact No"] ?? row["permanentContactNo"]
        ),
        address: val(row["Address"] ?? row["address"]),
        state: val(row["State"] ?? row["state"]),
        permanentAddress: val(
          row["Permanent Address"] ?? row["permanentAddress"]
        ),
        city: val(row["City"] ?? row["city"]),
        pincode: val(row["Pincode"] ?? row["pincode"]),
        bankName: val(row["Bank Name"] ?? row["bankName"]),
        accountNo: val(row["Account No"] ?? row["accountNo"]),
        ifscNo: val(row["IFSC No"] ?? row["ifscNo"]),
        rtgsNo: val(row["RTGS No"] ?? row["rtgsNo"]),
        panNo: normalizePan(
          row["PAN No"] ??
          row["PAN"] ??
          row["Pan No"] ??
          row["Pan"] ??
          row["panNo"] ??
          row["pan"]
        ),
        adharNo: normalizeAadhaar(
          row["Aadhaar No"] ??
          row["Aadhar No"] ??
          row["Adhar No"] ??
          row["Aadhaar"] ??
          row["Aadhar"] ??
          row["Adhar"] ??
          row["aadhaarNo"] ??
          row["adharNo"] ??
          row["aadharNo"]
        ),
        pfNo: val(row["PF No"] ?? row["pfNo"]),
        esicNo: val(row["ESIC No"] ?? row["esicNo"]),
        gstNo: val(row["GST No"] ?? row["gstNo"]),
        numberOfWorkers:
          row["Number Of Workers"] != null && row["Number Of Workers"] !== ""
            ? Number(row["Number Of Workers"])
            : row["numberOfWorkers"] != null && row["numberOfWorkers"] !== ""
            ? Number(row["numberOfWorkers"])
            : null,
        typeOfWork: val(row["Type Of Work"] ?? row["typeOfWork"]),
        workDone: val(row["Work Done"] ?? row["workDone"]),
      };
      records.push(rec);
    }

    if (errors.length > 0) {
      const msg = `Found ${errors.length} validation error(s): ${errors
        .slice(0, 5)
        .join("; ")}${
        errors.length > 5 ? `; ... and ${errors.length - 5} more errors` : ""
      }`;
      return ApiError(msg, 400);
    }

    if (records.length === 0) {
      return ApiError("No valid records found to import", 400);
    }

    // Insert sequentially within a transaction with generated vendor codes
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999
    );
    const baseCount = await prisma.manpowerSupplier.count({
      where: { createdAt: { gte: startOfMonth, lte: endOfMonth } },
    });

    let createdCount = 0;
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < records.length; i++) {
        const vendorCode = generateVendorCodeForIndex(
          baseCount + createdCount,
          0
        ); // use running count
        const r = records[i];
        await tx.manpowerSupplier.create({
          data: {
            vendorCode,
            supplierName: r.supplierName,
            contactPerson: r.contactPerson || null,
            representativeName: r.representativeName || null,
            localContactNo: r.localContactNo || null,
            permanentContactNo: r.permanentContactNo || null,
            address: r.address || null,
            state: r.state || null,
            permanentAddress: r.permanentAddress || null,
            city: r.city || null,
            pincode: r.pincode || null,
            bankName: r.bankName || null,
            accountNo: r.accountNo || null,
            ifscNo: r.ifscNo || null,
            rtgsNo: r.rtgsNo || null,
            panNo: r.panNo || null,
            adharNo: r.adharNo || null,
            pfNo: r.pfNo || null,
            esicNo: r.esicNo || null,
            gstNo: r.gstNo || null,
            numberOfWorkers: r.numberOfWorkers ?? null,
            typeOfWork: r.typeOfWork || null,
            workDone: r.workDone || null,
          },
        });
        createdCount++;
      }
    });

    return Success(
      {
        message: `Successfully uploaded ${createdCount} supplier(s)`,
        count: createdCount,
      },
      201
    );
  } catch (e: any) {
    console.error("Manpower suppliers upload error:", e);
    return ApiError(e?.message || "Failed to process uploaded file");
  }
}
