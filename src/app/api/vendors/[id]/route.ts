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
  bankAccounts: z.array(z.object({
    id: z.union([z.number(), z.string()]).optional(),
    bank: z.string().optional().nullable(),
    branch: z.string().optional().nullable(),
    branchCode: z.string().optional().nullable(),
    accountNumber: z.string().optional().nullable(),
    ifscCode: z.string().optional().nullable(),
  })).optional().nullable(),
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
        bankAccounts: {
          select: {
            id: true,
            bank: true,
            branch: true,
            branchCode: true,
            accountNumber: true,
            ifscCode: true,
          }
        },
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

    // Extract itemCategoryIds and bankAccounts from updateData for separate handling
    const { itemCategoryIds, bankAccounts, ...vendorData } = updateData;

    const normalizeId = (value: unknown): number | undefined => {
      if (typeof value === 'number' && !Number.isNaN(value)) {
        return value;
      }
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed === '') return undefined;
        const parsed = Number(trimmed);
        if (!Number.isNaN(parsed)) {
          return parsed;
        }
      }
      return undefined;
    };

    const normalizedBankAccounts = Array.isArray(bankAccounts)
      ? bankAccounts.map((acc) => ({
          id: normalizeId((acc as { id?: unknown }).id),
          bank: acc.bank ?? null,
          branch: acc.branch ?? null,
          branchCode: acc.branchCode ?? null,
          accountNumber: acc.accountNumber ?? null,
          ifscCode: acc.ifscCode ?? null,
        }))
      : undefined;
    
    // Use transaction to handle vendor and bank accounts update
    const updated = await prisma.$transaction(async (tx) => {
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
      
      // Update vendor
      const vendor = await tx.vendor.update({
        where: { id },
        data: updatePayload,
      });
      
      // Handle bank accounts if provided
      if (Array.isArray(normalizedBankAccounts)) {
        // Get existing bank accounts
        const existingAccounts = await tx.vendorBankAccount.findMany({
          where: { vendorId: id },
          select: { id: true }
        });
        
        const existingIds = existingAccounts.map(acc => acc.id);
        const incomingIds = normalizedBankAccounts
          .map(acc => acc.id)
          .filter((acc): acc is number => typeof acc === 'number');
        
        // Find IDs to delete (existing but not in incoming)
        const idsToDelete = existingIds.filter(id => !incomingIds.includes(id));
        
        // Delete accounts that are not in the incoming payload
        if (idsToDelete.length > 0) {
          await tx.vendorBankAccount.deleteMany({
            where: { id: { in: idsToDelete } }
          });
        }
        
        // Process each bank account in the payload
        if (normalizedBankAccounts.length > 0) {
          await Promise.all(normalizedBankAccounts.map(async (acc) => {
            // Filter out empty accounts (all fields empty except possibly id)
            const hasData = acc.bank || acc.branch || acc.branchCode || 
                           acc.accountNumber || acc.ifscCode;
            
            if (!hasData) return;
            
            if (typeof acc.id === 'number' && existingIds.includes(acc.id)) {
              // Update existing account
              return tx.vendorBankAccount.update({
                where: { id: acc.id },
                data: {
                  bank: acc.bank,
                  branch: acc.branch,
                  branchCode: acc.branchCode,
                  accountNumber: acc.accountNumber,
                  ifscCode: acc.ifscCode,
                }
              });
            } else {
              // Create new account
              return tx.vendorBankAccount.create({
                data: {
                  vendorId: id,
                  bank: acc.bank,
                  branch: acc.branch,
                  branchCode: acc.branchCode,
                  accountNumber: acc.accountNumber,
                  ifscCode: acc.ifscCode,
                }
              });
            }
          }));
        }
      }
      
      // Return updated vendor with all relationships
      return await tx.vendor.findUnique({
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
          panNumber: true,
          vatTinNumber: true,
          cstTinNumber: true,
          gstNumber: true,
          cinNumber: true,
          bank: true,
          branch: true,
          branchCode: true,
          accountNumber: true,
          ifscCode: true,
          serviceTaxNumber: true,
          stateCode: true,
          bankAccounts: {
            select: {
              id: true,
              bank: true,
              branch: true,
              branchCode: true,
              accountNumber: true,
              ifscCode: true,
            },
            orderBy: { id: 'asc' }
          },
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
    });

    return Success(updated);
  } catch (err) {
    console.error('Error updating vendor:', err);
    return Error('Failed to update vendor', 500);
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
