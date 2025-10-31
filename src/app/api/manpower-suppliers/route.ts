import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error } from "@/lib/api-response";
import { paginate } from "@/lib/paginate";
import { guardApiAccess } from "@/lib/access-guard";

// Auto-generate vendor code in format V-YYMM#### (e.g., V-2510001)
async function generateVendorCode(): Promise<string> {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2); // Last 2 digits of year (e.g., "25")
  const month = (now.getMonth() + 1).toString().padStart(2, '0'); // Month as 2 digits (e.g., "10")
  const yearMonth = `${year}${month}`; // e.g., "2510"
  
  // Count vendors created in the current month
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  
  const count = await prisma.manpowerSupplier.count({
    where: {
      createdAt: {
        gte: startOfMonth,
        lte: endOfMonth,
      },
    },
  });
  
  const nextNumber = (count + 1).toString().padStart(3, '0'); // 3 digits: 001, 002, etc.
  return `V-${yearMonth}${nextNumber}`;
}

// GET /api/manpower-suppliers?search=&page=1&perPage=10&sort=supplierName&order=asc
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const perPage = Math.min(100, Math.max(1, Number(searchParams.get("perPage")) || 10));
  const search = searchParams.get("search")?.trim() || "";
  const sort = (searchParams.get("sort") || "supplierName") as string;
  const order = (searchParams.get("order") === "desc" ? "desc" : "asc") as "asc" | "desc";

  type Where = {
    OR?: { [k: string]: { contains: string } }[];
  };
  const where: Where = {};
  if (search) {
    where.OR = [
      { supplierName: { contains: search } },
      { vendorCode: { contains: search } },
      { contactPerson: { contains: search } },
      { representativeName: { contains: search } },
      { city: { contains: search } },
      { state: { contains: search } },
      { gstNo: { contains: search } },
      { panNo: { contains: search } },
      { adharNo: { contains: search } },
    ];
  }

  const sortable = new Set([
    "supplierName",
    "vendorCode",
    "city",
    "createdAt",
    "updatedAt",
  ]);
  const orderBy: Record<string, "asc" | "desc"> = sortable.has(sort) ? { [sort]: order } : { supplierName: "asc" };

  const result = await paginate({
    model: prisma.manpowerSupplier as any,
    where,
    orderBy,
    page,
    perPage,
    select: {
      id: true,
      vendorCode: true,
      supplierName: true,
      contactPerson: true,
      representativeName: true,
      localContactNo: true,
      permanentContactNo: true,
      address: true,
      state: true,
      permanentAddress: true,
      city: true,
      pincode: true,
      bankName: true,
      accountNo: true,
      ifscNo: true,
      rtgsNo: true,
      panNo: true,
      adharNo: true,
      pfNo: true,
      esicNo: true,
      gstNo: true,
      numberOfWorkers: true,
      typeOfWork: true,
      workDone: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return Success(result);
}

// POST /api/manpower-suppliers
export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  let body: any;
  try { body = await req.json(); } catch { return Error('Invalid JSON body', 400); }

  const sanitize = (v: unknown) => (typeof v === 'string' ? v.trim() : v);
  const data = {
    // vendorCode is auto-generated, don't accept from request body
    supplierName: sanitize(body.supplierName),
    contactPerson: sanitize(body.contactPerson) || null,
    representativeName: sanitize(body.representativeName) || null,
    localContactNo: sanitize(body.localContactNo) || null,
    permanentContactNo: sanitize(body.permanentContactNo) || null,
    address: sanitize(body.address) || null,
    state: sanitize(body.state) || null,
    permanentAddress: sanitize(body.permanentAddress) || null,
    city: sanitize(body.city) || null,
    pincode: sanitize(body.pincode) || null,
    bankName: sanitize(body.bankName) || null,
    accountNo: sanitize(body.accountNo) || null,
    ifscNo: sanitize(body.ifscNo) || null,
    rtgsNo: sanitize(body.rtgsNo) || null,
    panNo: sanitize(body.panNo) || null,
    adharNo: sanitize(body.adharNo) || null,
    pfNo: sanitize(body.pfNo) || null,
    esicNo: sanitize(body.esicNo) || null,
    gstNo: sanitize(body.gstNo) || null,
    numberOfWorkers: body.numberOfWorkers != null && body.numberOfWorkers !== '' ? Number(body.numberOfWorkers) : null,
    typeOfWork: sanitize(body.typeOfWork) || null,
    workDone: sanitize(body.workDone) || null,
  } as const;

  if (!data.supplierName || String(data.supplierName).length === 0) {
    return Error('Supplier name is required', 400);
  }

  try {
    // Generate vendor code
    const vendorCode = await generateVendorCode();
    
    const created = await prisma.manpowerSupplier.create({
      data: {
        ...data,
        vendorCode,
      } as any,
      select: {
        id: true,
        vendorCode: true,
        supplierName: true,
        contactPerson: true,
        representativeName: true,
        localContactNo: true,
        permanentContactNo: true,
        address: true,
        state: true,
        permanentAddress: true,
        city: true,
        pincode: true,
        bankName: true,
        accountNo: true,
        ifscNo: true,
        rtgsNo: true,
        panNo: true,
        adharNo: true,
        pfNo: true,
        esicNo: true,
        gstNo: true,
        numberOfWorkers: true,
        typeOfWork: true,
        workDone: true,
        createdAt: true,
        updatedAt: true,
      }
    });
    return Success(created, 201);
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return Error('Vendor code already exists. Please try again.', 409);
    }
    console.error('Create manpower supplier error:', e);
    return Error('Failed to create manpower supplier');
  }
}

// PATCH /api/manpower-suppliers
export async function PATCH(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  let body: any;
  try { body = await req.json(); } catch { return Error('Invalid JSON body', 400); }
  const id = Number(body.id);
  if (!id || Number.isNaN(id)) return Error('id is required', 400);

  const sanitize = (v: unknown) => (typeof v === 'string' ? v.trim() : v);
  const data: Record<string, any> = {};
  const maybeSet = (key: string, val: any) => {
    if (val !== undefined) data[key] = typeof val === 'string' ? (val.trim() || null) : val;
  };
  // vendorCode is auto-generated and cannot be updated
  maybeSet('supplierName', body.supplierName);
  maybeSet('contactPerson', body.contactPerson);
  maybeSet('representativeName', body.representativeName);
  maybeSet('localContactNo', body.localContactNo);
  maybeSet('permanentContactNo', body.permanentContactNo);
  maybeSet('address', body.address);
  maybeSet('state', body.state);
  maybeSet('permanentAddress', body.permanentAddress);
  maybeSet('city', body.city);
  maybeSet('pincode', body.pincode);
  maybeSet('bankName', body.bankName);
  maybeSet('accountNo', body.accountNo);
  maybeSet('ifscNo', body.ifscNo);
  maybeSet('rtgsNo', body.rtgsNo);
  maybeSet('panNo', body.panNo);
  maybeSet('adharNo', body.adharNo);
  maybeSet('pfNo', body.pfNo);
  maybeSet('esicNo', body.esicNo);
  maybeSet('gstNo', body.gstNo);
  if (body.numberOfWorkers !== undefined) data.numberOfWorkers = (body.numberOfWorkers === '' || body.numberOfWorkers === null) ? null : Number(body.numberOfWorkers);
  maybeSet('typeOfWork', body.typeOfWork);
  maybeSet('workDone', body.workDone);

  if (!Object.keys(data).length) return Error('Nothing to update', 400);

  try {
    const updated = await prisma.manpowerSupplier.update({
      where: { id },
      data,
      select: {
        id: true,
        vendorCode: true,
        supplierName: true,
        contactPerson: true,
        representativeName: true,
        localContactNo: true,
        permanentContactNo: true,
        address: true,
        state: true,
        permanentAddress: true,
        city: true,
        pincode: true,
        bankName: true,
        accountNo: true,
        ifscNo: true,
        rtgsNo: true,
        panNo: true,
        adharNo: true,
        pfNo: true,
        esicNo: true,
        gstNo: true,
        numberOfWorkers: true,
        typeOfWork: true,
        workDone: true,
        createdAt: true,
        updatedAt: true,
      }
    });
    return Success(updated);
  } catch (e: any) {
    if (e?.code === 'P2025') return Error('Manpower supplier not found', 404);
    return Error('Failed to update manpower supplier');
  }
}
