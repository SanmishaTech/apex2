import { NextRequest } from "next/server";
import { guardApiAccess } from "@/lib/access-guard";
import { Success, Error as ApiError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";
import bcrypt from "bcryptjs";

function val(v: any) {
  if (v == null) return null;
  if (typeof v === "string") {
    const t = v.trim();
    return t === "" ? null : t;
  }
  return v;
}

// Parse date strings or Excel serials to ISO date string (YYYY-MM-DD)
function parseDateStr(v: any): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date && !isNaN(v.getTime()))
    return v.toISOString().slice(0, 10);
  if (typeof v === "number" && isFinite(v)) {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const ms = Math.round(v * 24 * 60 * 60 * 1000);
    const d = new Date(epoch.getTime() + ms);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  // dd/mm/yyyy
  const m1 = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m1) {
    const dd = parseInt(m1[1], 10);
    const mm = parseInt(m1[2], 10) - 1;
    const yyyy = parseInt(m1[3], 10);
    const d = new Date(yyyy, mm, dd);
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  // yyyy-mm-dd
  const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m2) return s;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

// POST /api/employees/upload - Upload Excel file and bulk create employees + users
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
      name: string;
      email: string;
      password: string;
      role: string; // must map to ROLES values
      department: string;
      resignDate?: string | null;
      dateOfBirth?: string | null;
      joiningDate?: string | null; // parsed but not persisted
      spouseName?: string | null;
      bloodGroup?: string | null;
      addressLine1?: string | null;
      addressLine2?: string | null;
      state?: string | null;
      city?: string | null;
      pincode?: string | null;
      mobile1?: string | null;
      mobile2?: string | null;
      esic?: string | null;
      pf?: string | null;
      panNo?: string | null;
      adharNo?: string | null; // from 'ADHAR NO'
      cinNo?: string | null;
      sickLeavesPerYear?: number | null;
      paidLeavesPerYear?: number | null;
      casualLeavesPerYear?: number | null;
      balanceSickLeaves?: number | null;
      balancePaidLeaves?: number | null;
      balanceCasualLeaves?: number | null;
      airTravelClass?: string | null;
      railwayTravelClass?: string | null;
      busTravelClass?: string | null;
    };

    const rows: Row[] = [];
    const errors: string[] = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 2;
      const name = val(row["Name*"]) as string | null;
      const email = val(row["Email*"]) as string | null;
      const password = val(row["Password*"]);
      const passwordStr =
        password == null || password === "" ? null : String(password);
      const roleRaw = val(row["Role*"]) as string | null;
      const department = val(row["Department*"]) as string | null;
      const resignDate = parseDateStr(
        row["resignDate(YYYY-MM-DD)"] ?? row["resignDate"]
      );
      const dateOfBirth = parseDateStr(
        row["dateOfBirth(YYYY-MM-DD)"] ?? row["dateOfBirth"]
      );
      const joiningDate = parseDateStr(
        row["joiningDate(YYYY-MM-DD)"] ?? row["joiningDate"]
      );
      const spouseName = val(row["spouseName"]) as string | null;
      const bloodGroup = val(row["bloodGroup"]) as string | null;
      const addressLine1 = val(row["addressLine1"]) as string | null;
      const addressLine2 = val(row["addressLine2"]) as string | null;
      const state = val(row["state"]) as string | null;
      const city = val(row["city"]) as string | null;
      const pincode =
        row["pincode"] == null || row["pincode"] === ""
          ? null
          : String(row["pincode"]).trim();
      const mobile1 =
        row["mobile1"] == null || row["mobile1"] === ""
          ? null
          : String(row["mobile1"]).trim();
      const mobile2 =
        row["mobile2"] == null || row["mobile2"] === ""
          ? null
          : String(row["mobile2"]).trim();
      const esicRaw = row["esic"];
      const esic =
        esicRaw == null || esicRaw === "" ? null : String(esicRaw).trim();
      const pfRaw = row["pf"];
      const pf = pfRaw == null || pfRaw === "" ? null : String(pfRaw).trim();
      const panNoRaw = row["panNo"];
      const panNo =
        panNoRaw == null || panNoRaw === "" ? null : String(panNoRaw).trim();
      const adharNoRaw = row["ADHAR NO"];
      const adharNo =
        adharNoRaw == null || adharNoRaw === ""
          ? null
          : String(adharNoRaw).trim();
      const cinNoRaw = row["cinNo"];
      const cinNo =
        cinNoRaw == null || cinNoRaw === "" ? null : String(cinNoRaw).trim();
      const sickLeavesPerYear =
        row["sickLeavesPerYear"] == null || row["sickLeavesPerYear"] === ""
          ? null
          : Number(row["sickLeavesPerYear"]);
      const paidLeavesPerYear =
        row["paidLeavesPerYear"] == null || row["paidLeavesPerYear"] === ""
          ? null
          : Number(row["paidLeavesPerYear"]);
      const casualLeavesPerYear =
        row["casualLeavesPerYear"] == null || row["casualLeavesPerYear"] === ""
          ? null
          : Number(row["casualLeavesPerYear"]);
      const balanceSickLeaves =
        row["balanceSickLeaves"] == null || row["balanceSickLeaves"] === ""
          ? null
          : Number(row["balanceSickLeaves"]);
      const balancePaidLeaves =
        row["balancePaidLeaves"] == null || row["balancePaidLeaves"] === ""
          ? null
          : Number(row["balancePaidLeaves"]);
      const balanceCasualLeaves =
        row["balanceCasualLeaves"] == null || row["balanceCasualLeaves"] === ""
          ? null
          : Number(row["balanceCasualLeaves"]);
      const airTravelClass = val(row["airTravelClass"]) as string | null;
      const railwayTravelClass = val(row["railwayTravelClass"]) as
        | string
        | null;
      const busTravelClass = val(row["busTravelClass"]) as string | null;

      const rowErrors: string[] = [];
      if (!name) rowErrors.push("name is required");
      if (!email) rowErrors.push("email is required");
      if (!passwordStr || String(passwordStr).length < 1)
        rowErrors.push("password is required");
      // role: required, store as-is
      let role: string | null = null;
      if (!roleRaw) {
        rowErrors.push("role is required");
      } else {
        role = String(roleRaw).trim();
      }
      if (!department) rowErrors.push("department is required");
      if (rowErrors.length) {
        errors.push(`Row ${rowNum}: ${rowErrors.join(", ")}`);
        continue;
      }

      rows.push({
        name: name as string,
        email: email as string,
        password: passwordStr as string,
        role: role as string,
        department: department as string,
        resignDate,
        dateOfBirth,
        joiningDate,
        spouseName,
        bloodGroup,
        addressLine1,
        addressLine2,
        state,
        city,
        pincode,
        mobile1,
        mobile2,
        esic,
        pf,
        panNo,
        adharNo,
        cinNo,
        sickLeavesPerYear,
        paidLeavesPerYear,
        casualLeavesPerYear,
        balanceSickLeaves,
        balancePaidLeaves,
        balanceCasualLeaves,
        airTravelClass,
        railwayTravelClass,
        busTravelClass,
      });
    }

    if (errors.length) {
      return ApiError(
        `Found ${errors.length} validation error(s): ${errors
          .slice(0, 10)
          .join("; ")}${
          errors.length > 10 ? `; ... and ${errors.length - 10} more` : ""
        }`,
        400
      );
    }

    if (rows.length === 0) return ApiError("No valid rows to import", 400);

    // Resolve departments by name if provided
    const uniqueDepts = [
      ...new Set(rows.map((r) => r.department).filter(Boolean)),
    ] as string[];
    const deptMap = new Map<string, number>();
    if (uniqueDepts.length) {
      const depts = await prisma.department.findMany({
        where: { department: { in: uniqueDepts } },
        select: { id: true, department: true },
      });
      depts.forEach((d) => deptMap.set(d.department, d.id));
    }

    // Resolve states/cities by name if provided
    const uniqueStates = [
      ...new Set(rows.map((r) => r.state).filter(Boolean)),
    ] as string[];
    const uniqueCities = [
      ...new Set(rows.map((r) => r.city).filter(Boolean)),
    ] as string[];
    const stateMap = new Map<string, number>();
    const cityMap = new Map<string, number>();
    if (uniqueStates.length) {
      const states = await prisma.state.findMany({
        where: { state: { in: uniqueStates } },
        select: { id: true, state: true },
      });
      states.forEach((s) => stateMap.set(s.state, s.id));
    }
    if (uniqueCities.length) {
      const cities = await prisma.city.findMany({
        where: { city: { in: uniqueCities } },
        select: { id: true, city: true },
      });
      cities.forEach((c) => cityMap.set(c.city, c.id));
    }

    // Pre-hash passwords outside transaction to minimize time inside DB tx
    const prepared = [] as {
      row: (typeof rows)[number];
      hashedPassword: string;
    }[];
    for (const r of rows) {
      const hashedPassword = await bcrypt.hash(r.password, 10);
      prepared.push({ row: r, hashedPassword });
    }

    // Create employees in a transaction (longer timeout to accommodate bulk)
    const createdCount = await prisma.$transaction(
      async (tx) => {
        let count = 0;
        for (const p of prepared) {
          const r = p.row;
          const user = await tx.user.create({
            data: {
              name: r.name,
              email: r.email,
              passwordHash: p.hashedPassword,
              role: r.role,
              status: true,
            },
            select: { id: true },
          });

          const employee = await tx.employee.create({
            data: {
              name: r.name,
              user: { connect: { id: user.id } },
              ...(r.department && deptMap.get(r.department)
                ? {
                    department: { connect: { id: deptMap.get(r.department)! } },
                  }
                : {}),
              ...(r.state && stateMap.get(r.state)
                ? { state: { connect: { id: stateMap.get(r.state)! } } }
                : {}),
              ...(r.city && cityMap.get(r.city)
                ? { city: { connect: { id: cityMap.get(r.city)! } } }
                : {}),
              addressLine1: r.addressLine1 || null,
              addressLine2: r.addressLine2 || null,
              pincode: r.pincode || null,
              mobile1: r.mobile1 || null,
              mobile2: r.mobile2 || null,
              resignDate: r.resignDate ? new Date(r.resignDate) : null,
              dateOfBirth: r.dateOfBirth ? new Date(r.dateOfBirth) : null,
              spouseName: r.spouseName || null,
              bloodGroup: r.bloodGroup || null,
              esic: r.esic || null,
              pf: r.pf || null,
              panNo: r.panNo || null,
              adharNo: r.adharNo || null,
              cinNo: r.cinNo || null,
              airTravelClass: r.airTravelClass || null,
              railwayTravelClass: r.railwayTravelClass || null,
              busTravelClass: r.busTravelClass || null,
              sickLeavesPerYear: r.sickLeavesPerYear ?? null,
              paidLeavesPerYear: r.paidLeavesPerYear ?? null,
              casualLeavesPerYear: r.casualLeavesPerYear ?? null,
              balanceSickLeaves: r.balanceSickLeaves ?? null,
              balancePaidLeaves: r.balancePaidLeaves ?? null,
              balanceCasualLeaves: r.balanceCasualLeaves ?? null,
            },
            select: { id: true },
          });
          if (employee?.id) count += 1;
        }
        return count;
      },
      { timeout: 60000 }
    );

    return Success(
      {
        message: `Successfully uploaded ${createdCount} employee(s)`,
        count: createdCount,
      },
      201
    );
  } catch (e: any) {
    console.error("Employees upload error:", e);
    return ApiError(e?.message || "Failed to process uploaded file");
  }
}
