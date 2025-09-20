import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error } from "@/lib/api-response";
import { paginate } from "@/lib/paginate";
import { guardApiAccess } from "@/lib/access-guard";

// GET /api/billing-addresses - List Billing Addresses with pagination and search
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const perPage = Math.min(100, Math.max(1, Number(searchParams.get("perPage")) || 10));
  const search = (searchParams.get("search") || "").trim();
  const sort = (searchParams.get("sort") || "companyName") as string;
  const order = (searchParams.get("order") === "asc" ? "asc" : "desc") as "asc" | "desc";

  type BillingAddressWhere = {
    companyName?: { contains: string };
  };
  const where: BillingAddressWhere = {};
  if (search) {
    where.companyName = { contains: search };
  }

  const sortableFields = new Set(["companyName", "createdAt"]);
  const orderBy: Record<string, "asc" | "desc"> = sortableFields.has(sort) ? { [sort]: order } : { companyName: "asc" };

  const result = await paginate({
    model: prisma.billingAddress,
    where,
    orderBy,
    page,
    perPage,
    select: {
      id: true,
      companyName: true,
      addressLine1: true,
      addressLine2: true,
      state: {
        select: {
          state: true,
        }
      },
      city: {
        select: {
          city: true,
        }
      },
      pincode: true,
      landline1: true,
      landline2: true,
      fax: true,
      email: true,
      panNumber: true,
      vatTinNumber: true,
      gstNumber: true,
      cstTinNumber: true,
      cinNumber: true,
      stateCode: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return Success(result);
}

// POST /api/billing-addresses - Create new Billing Address
export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  let body: unknown;
  try { body = await req.json(); } catch { return Error('Invalid JSON body', 400); }
  const b = (body as Record<string, unknown>) || {};

  // Basic validation
  if (typeof b.companyName !== 'string' || !b.companyName.trim()) {
    return Error('Valid Company Name is required', 400);
  }

  if (typeof b.addressLine1 !== 'string' || !b.addressLine1.trim()) {
    return Error('Valid Address Line 1 is required', 400);
  }

  // Email validation if provided
  if (b.email && typeof b.email === 'string' && b.email.trim()) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(b.email.trim())) {
      return Error('Valid email format is required', 400);
    }
  }

  try {
    const billingAddress = await prisma.billingAddress.create({
      data: {
        companyName: b.companyName.trim(),
        addressLine1: b.addressLine1.trim(),
        addressLine2: typeof b.addressLine2 === 'string' ? b.addressLine2.trim() || null : null,
        stateId: typeof b.stateId === 'number' ? b.stateId : null,
        cityId: typeof b.cityId === 'number' ? b.cityId : null,
        pincode: typeof b.pincode === 'string' ? b.pincode.trim() || null : null,
        landline1: typeof b.landline1 === 'string' ? b.landline1.trim() || null : null,
        landline2: typeof b.landline2 === 'string' ? b.landline2.trim() || null : null,
        fax: typeof b.fax === 'string' ? b.fax.trim() || null : null,
        email: typeof b.email === 'string' ? b.email.trim() || null : null,
        panNumber: typeof b.panNumber === 'string' ? b.panNumber.trim() || null : null,
        vatTinNumber: typeof b.vatTinNumber === 'string' ? b.vatTinNumber.trim() || null : null,
        gstNumber: typeof b.gstNumber === 'string' ? b.gstNumber.trim() || null : null,
        cstTinNumber: typeof b.cstTinNumber === 'string' ? b.cstTinNumber.trim() || null : null,
        cinNumber: typeof b.cinNumber === 'string' ? b.cinNumber.trim() || null : null,
        stateCode: typeof b.stateCode === 'string' ? b.stateCode.trim() || null : null,
      },
      select: {
        id: true,
        companyName: true,
        addressLine1: true,
        addressLine2: true,
        stateId: true,
        cityId: true,
        pincode: true,
        landline1: true,
        landline2: true,
        fax: true,
        email: true,
        panNumber: true,
        vatTinNumber: true,
        gstNumber: true,
        cstTinNumber: true,
        cinNumber: true,
        stateCode: true,
        createdAt: true,
        updatedAt: true,
      }
    });
    return Success(billingAddress);
  } catch (err: any) {
    console.error('Error creating Billing Address:', err);
    return Error('Failed to create Billing Address', 500);
  }
}

// PATCH /api/billing-addresses - Update Billing Address
export async function PATCH(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  let body: unknown;
  try { body = await req.json(); } catch { return Error('Invalid JSON body', 400); }
  const b = (body as Record<string, unknown>) || {};

  if (typeof b.id !== 'number' || b.id <= 0) {
    return Error('Valid id is required', 400);
  }

  // Check if Billing Address exists
  const existing = await prisma.billingAddress.findUnique({ where: { id: b.id } });
  if (!existing) return Error('Billing Address not found', 404);

  // Prepare update data
  const updateData: any = {};

  if (b.companyName !== undefined) {
    if (typeof b.companyName !== 'string' || !b.companyName.trim()) {
      return Error('Valid Company Name is required', 400);
    }
    updateData.companyName = b.companyName.trim();
  }

  if (b.addressLine1 !== undefined) {
    if (typeof b.addressLine1 !== 'string' || !b.addressLine1.trim()) {
      return Error('Valid Address Line 1 is required', 400);
    }
    updateData.addressLine1 = b.addressLine1.trim();
  }

  if (b.addressLine2 !== undefined) {
    updateData.addressLine2 = typeof b.addressLine2 === 'string' ? b.addressLine2.trim() || null : null;
  }

  if (b.stateId !== undefined) {
    updateData.stateId = typeof b.stateId === 'number' ? b.stateId : null;
  }

  if (b.cityId !== undefined) {
    updateData.cityId = typeof b.cityId === 'number' ? b.cityId : null;
  }

  if (b.pincode !== undefined) {
    updateData.pincode = typeof b.pincode === 'string' ? b.pincode.trim() || null : null;
  }

  if (b.landline1 !== undefined) {
    updateData.landline1 = typeof b.landline1 === 'string' ? b.landline1.trim() || null : null;
  }

  if (b.landline2 !== undefined) {
    updateData.landline2 = typeof b.landline2 === 'string' ? b.landline2.trim() || null : null;
  }

  if (b.fax !== undefined) {
    updateData.fax = typeof b.fax === 'string' ? b.fax.trim() || null : null;
  }

  if (b.email !== undefined) {
    if (b.email && typeof b.email === 'string' && b.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(b.email.trim())) {
        return Error('Valid email format is required', 400);
      }
      updateData.email = b.email.trim();
    } else {
      updateData.email = null;
    }
  }

  if (b.panNumber !== undefined) {
    updateData.panNumber = typeof b.panNumber === 'string' ? b.panNumber.trim() || null : null;
  }

  if (b.vatTinNumber !== undefined) {
    updateData.vatTinNumber = typeof b.vatTinNumber === 'string' ? b.vatTinNumber.trim() || null : null;
  }

  if (b.gstNumber !== undefined) {
    updateData.gstNumber = typeof b.gstNumber === 'string' ? b.gstNumber.trim() || null : null;
  }

  if (b.cstTinNumber !== undefined) {
    updateData.cstTinNumber = typeof b.cstTinNumber === 'string' ? b.cstTinNumber.trim() || null : null;
  }

  if (b.cinNumber !== undefined) {
    updateData.cinNumber = typeof b.cinNumber === 'string' ? b.cinNumber.trim() || null : null;
  }

  if (b.stateCode !== undefined) {
    updateData.stateCode = typeof b.stateCode === 'string' ? b.stateCode.trim() || null : null;
  }

  try {
    const billingAddress = await prisma.billingAddress.update({
      where: { id: b.id },
      data: updateData,
      select: {
        id: true,
        companyName: true,
        addressLine1: true,
        addressLine2: true,
        stateId: true,
        cityId: true,
        pincode: true,
        landline1: true,
        landline2: true,
        fax: true,
        email: true,
        panNumber: true,
        vatTinNumber: true,
        gstNumber: true,
        cstTinNumber: true,
        cinNumber: true,
        stateCode: true,
        createdAt: true,
        updatedAt: true,
      }
    });
    return Success(billingAddress);
  } catch (err: any) {
    console.error('Error updating Billing Address:', err);
    return Error('Failed to update Billing Address', 500);
  }
}
