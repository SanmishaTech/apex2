import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error, BadRequest, NotFound } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { z } from "zod";

const updateSchema = z.object({
  vendorName: z.string().min(1, "Vendor name is required").optional(),
  contactPerson: z.string().optional().nullable(),
  addressLine1: z.string().min(1, "Address line 1 is required").optional(),
  addressLine2: z.string().optional().nullable(),
  stateId: z.number().optional().nullable(),
  cityId: z.number().optional().nullable(),
  pincode: z.string().optional().nullable(),
  mobile1: z.string().optional().nullable(),
  mobile2: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  alternateEmail1: z.string().optional().nullable(),
  alternateEmail2: z.string().optional().nullable(),
  alternateEmail3: z.string().optional().nullable(),
  alternateEmail4: z.string().optional().nullable(),
  landline1: z.string().optional().nullable(),
  landline2: z.string().optional().nullable(),
  bank: z.string().optional().nullable(),
  branch: z.string().optional().nullable(),
  branchCode: z.string().optional().nullable(),
  accountNumber: z.string().optional().nullable(),
  ifscCode: z.string().optional().nullable(),
  panNumber: z.string().optional().nullable(),
  vatTinNumber: z.string().optional().nullable(),
  cstTinNumber: z.string().optional().nullable(),
  gstNumber: z.string().optional().nullable(),
  cinNumber: z.string().optional().nullable(),
  serviceTaxNumber: z.string().optional().nullable(),
  stateCode: z.string().optional().nullable(),
  itemCategoryIds: z.array(z.number()).optional().nullable(),
});

// GET /api/vendors/[id] - Get single vendor
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const id = parseInt((await params).id);
  if (isNaN(id)) return Error('Invalid ID', 400);

  try {
    const vendor = await prisma.vendor.findUnique({
      where: { id },
      select: {
        id: true,
        vendorName: true,
        contactPerson: true,
        addressLine1: true,
        addressLine2: true,
        stateId: true,
        cityId: true,
        pincode: true,
        mobile1: true,
        mobile2: true,
        email: true,
        alternateEmail1: true,
        alternateEmail2: true,
        alternateEmail3: true,
        alternateEmail4: true,
        landline1: true,
        landline2: true,
        bank: true,
        branch: true,
        branchCode: true,
        accountNumber: true,
        ifscCode: true,
        panNumber: true,
        vatTinNumber: true,
        cstTinNumber: true,
        gstNumber: true,
        cinNumber: true,
        serviceTaxNumber: true,
        stateCode: true,
        itemCategories: {
          select: {
            itemCategory: {
              select: {
                id: true,
                itemCategory: true,
              }
            }
          }
        },
        createdAt: true,
        updatedAt: true,
      }
    });

    if (!vendor) return NotFound('Vendor not found');
    return Success(vendor);
  } catch (err) {
    console.error('Error fetching vendor:', err);
    return Error('Failed to fetch vendor', 500);
  }
}

// PATCH /api/vendors/[id] - Update vendor
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const id = parseInt((await params).id);
  if (isNaN(id)) return Error('Invalid ID', 400);

  try {
    const body = await req.json();
    const updateData = updateSchema.parse(body);

    if (Object.keys(updateData).length === 0) {
      return Error("No valid fields to update", 400);
    }

    // Extract itemCategoryIds from updateData for separate handling
    const { itemCategoryIds, ...vendorData } = updateData;
    
    // Prepare update data with item categories relationship
    const updatePayload: any = {
      ...vendorData,
    };
    
    // Handle item categories relationship if provided
    if (itemCategoryIds !== undefined) {
      updatePayload.itemCategories = {
        deleteMany: {}, // Delete all existing relationships
        create: itemCategoryIds && itemCategoryIds.length > 0 ? 
          itemCategoryIds.map(categoryId => ({
            itemCategoryId: categoryId
          })) : []
      };
    }
    
    const updated = await prisma.vendor.update({
      where: { id },
      data: updatePayload,
      select: {
        id: true,
        vendorName: true,
        contactPerson: true,
        addressLine1: true,
        addressLine2: true,
        stateId: true,
        cityId: true,
        pincode: true,
        mobile1: true,
        mobile2: true,
        email: true,
        alternateEmail1: true,
        alternateEmail2: true,
        alternateEmail3: true,
        alternateEmail4: true,
        landline1: true,
        landline2: true,
        bank: true,
        branch: true,
        branchCode: true,
        accountNumber: true,
        ifscCode: true,
        panNumber: true,
        vatTinNumber: true,
        cstTinNumber: true,
        gstNumber: true,
        cinNumber: true,
        serviceTaxNumber: true,
        stateCode: true,
        itemCategories: {
          select: {
            itemCategory: {
              select: {
                id: true,
                itemCategory: true,
              }
            }
          }
        },
        createdAt: true,
        updatedAt: true,
      }
    });

    return Success(updated);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    if (error.code === 'P2025') return NotFound('Vendor not found');
    if (error.code === 'P2002') {
      return Error('Vendor with this name already exists', 409);
    }
    console.error("Update vendor error:", error);
    return Error("Failed to update vendor");
  }
}

// DELETE /api/vendors/[id] - Delete vendor
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const id = parseInt((await params).id);
  if (isNaN(id)) return Error('Invalid ID', 400);

  try {
    // Check if vendor exists
    const existing = await prisma.vendor.findUnique({ where: { id } });
    if (!existing) return NotFound('Vendor not found');

    await prisma.vendor.delete({ where: { id } });
    return Success({ message: 'Vendor deleted successfully' });
  } catch (err) {
    console.error('Error deleting vendor:', err);
    return Error('Failed to delete vendor', 500);
  }
}
