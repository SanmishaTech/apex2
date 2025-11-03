import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error, BadRequest, NotFound } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { z } from "zod";

// Helpers to normalize optional numeric fields that may be strings from forms
function toOptionalNumber(v: unknown): number | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isNaN(n) ? undefined : n;
}

function normalizeRentPayload(input: any) {
  if (!input || typeof input !== "object") return input;
  return {
    ...input,
    siteId: toOptionalNumber(input.siteId),
    boqId: toOptionalNumber(input.boqId),
    rentalCategoryId: toOptionalNumber(input.rentalCategoryId),
    rentTypeId: toOptionalNumber(input.rentTypeId),
    depositAmount: toOptionalNumber(input.depositAmount),
    rentAmount: toOptionalNumber(input.rentAmount),
  };
}

const updateRentSchema = z.object({
  siteId: z.number().int().positive().optional(),
  boqId: z.number().int().positive().optional(),
  rentalCategoryId: z.number().int().positive().optional(),
  rentTypeId: z.number().int().positive().optional(),
  owner: z.string().optional(),
  pancardNo: z.string().optional(),
  rentDay: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  dueDate: z.string().optional(),
  description: z.string().optional(),
  depositAmount: z.number().optional(),
  rentAmount: z.number().optional(),
  bank: z.string().optional(),
  branch: z.string().optional(),
  accountNo: z.string().optional(),
  accountName: z.string().optional(),
  ifscCode: z.string().optional(),
  paymentMethod: z.string().optional(),
  utrNumber: z.string().optional().nullable(),
  chequeNumber: z.string().optional().nullable(),
  chequeDate: z.string().optional().nullable(),
  bankDetails: z.string().optional().nullable(),
  paymentDate: z.string().optional().nullable(),
  momCopyUrl: z.string().optional(),
}).partial();

const rentSelectFields = {
  id: true,
  siteId: true,
  site: { select: { id: true, site: true } },
  boqId: true,
  boq: { select: { id: true, boqNo: true } },
  rentalCategoryId: true,
  rentalCategory: { select: { id: true, rentalCategory: true } },
  rentTypeId: true,
  rentType: { select: { id: true, rentType: true } },
  owner: true,
  pancardNo: true,
  rentDay: true,
  fromDate: true,
  toDate: true,
  description: true,
  depositAmount: true,
  rentAmount: true,
  srNo: true,
  listStatus: true,
  dueDate: true,
  status: true,
  bank: true,
  branch: true,
  accountNo: true,
  accountName: true,
  ifscCode: true,
  paymentMethod: true,
  utrNumber: true,
  chequeNumber: true,
  chequeDate: true,
  bankDetails: true,
  paymentDate: true,
  momCopyUrl: true,
  createdAt: true,
  updatedAt: true,
} as const;

// GET - Get single rent by ID
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const { id: idParam } = await params;
    const id = parseInt(idParam);
    if (isNaN(id)) return BadRequest("Invalid rent ID");

    const rent = await prisma.rent.findUnique({
      where: { id },
      select: rentSelectFields as any,
    });

    if (!rent) return NotFound("Rent not found");

    return Success(rent);
  } catch (error) {
    console.error("Get rent error:", error);
    return Error("Failed to fetch rent");
  }
}

// PATCH - Update rent
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const { id: idParam } = await params;
    const id = parseInt(idParam);
    if (isNaN(id)) return BadRequest("Invalid rent ID");

    const raw = await req.json();
    const body = normalizeRentPayload(raw);
    const validatedData = updateRentSchema.parse(body);

    // Convert date strings to Date objects if provided and not empty
    const updateData: any = { ...validatedData };
    if (updateData.fromDate && updateData.fromDate.trim() !== '') {
      updateData.fromDate = new Date(updateData.fromDate);
    } else if (updateData.fromDate === '') {
      updateData.fromDate = null; // Set to null to clear the date field
    }
    if (updateData.toDate && updateData.toDate.trim() !== '') {
      updateData.toDate = new Date(updateData.toDate);
    } else if (updateData.toDate === '') {
      updateData.toDate = null; // Set to null to clear the date field
    }
    if (updateData.dueDate && updateData.dueDate.trim() !== '') {
      updateData.dueDate = new Date(updateData.dueDate);
    } else if (updateData.dueDate === '') {
      updateData.dueDate = null; // Set to null to clear the date field
    }
    if (updateData.chequeDate && updateData.chequeDate.trim() !== '') {
      updateData.chequeDate = new Date(updateData.chequeDate);
    } else if (updateData.chequeDate === '' || updateData.chequeDate === null) {
      updateData.chequeDate = null;
    }
    if (updateData.paymentDate && updateData.paymentDate.trim() !== '') {
      updateData.paymentDate = new Date(updateData.paymentDate);
    } else if (updateData.paymentDate === '' || updateData.paymentDate === null) {
      updateData.paymentDate = null;
    }

    const updated = await prisma.rent.update({
      where: { id },
      data: updateData,
      select: rentSelectFields as any,
    });

    return Success(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    if (error.code === 'P2025') {
      return NotFound('Rent not found');
    }
    console.error("Update rent error:", error);
    return Error("Failed to update rent");
  }
}

// DELETE - Delete rent
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const { id: idParam } = await params;
    const id = parseInt(idParam);
    if (isNaN(id)) return BadRequest("Invalid rent ID");

    await prisma.rent.delete({
      where: { id }
    });

    return Success({ message: "Rent deleted successfully" });
  } catch (error) {
    if (error.code === 'P2025') {
      return NotFound('Rent not found');
    }
    console.error("Delete rent error:", error);
    return Error("Failed to delete rent");
  }
}
