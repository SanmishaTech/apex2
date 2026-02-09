import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error, BadRequest } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { paginate } from "@/lib/paginate";
import { z } from "zod";

// GET /api/vendors - List vendors with pagination & search
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const perPage = Math.min(
    10000,
    Math.max(1, Number(searchParams.get("perPage")) || 10)
  );
  const search = (searchParams.get("search") || "").trim();
  const sort = (searchParams.get("sort") || "vendorName") as string;
  const order = (searchParams.get("order") === "asc" ? "asc" : "desc") as "asc" | "desc";

  type VendorWhere = {
    vendorName?: { contains: string };
  };
  const where: VendorWhere = {};
  if (search) {
    where.vendorName = { contains: search };
  }

  const sortableFields = new Set(["vendorName", "createdAt"]);
  const orderBy: Record<string, "asc" | "desc"> = sortableFields.has(sort) ? { [sort]: order } : { vendorName: "asc" };

  const result = await paginate({
    model: prisma.vendor,
    where,
    orderBy,
    page,
    perPage,
    maxPerPage: 10000,
    select: {
      id: true,
      vendorName: true,
      contactPerson: true,
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
      mobile1: true,
      mobile2: true,
      email: true,
      panNumber: true,
      gstNumber: true,
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
    },
  });

  // Wrap pagination metadata for consistency with expected frontend structure
  const response = {
    data: result.data,
    meta: {
      page: result.page,
      totalPages: result.totalPages,
      total: result.total,
    },
  };

  return Success(response);
}

const createSchema = z.object({
  vendorName: z.string().min(1, "Vendor name is required"),
  contactPerson: z.string().optional().nullable(),
  addressLine1: z.string().min(1, "Address line 1 is required"),
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
    bank: z.string().optional().nullable(),
    branch: z.string().optional().nullable(),
    branchCode: z.string().optional().nullable(),
    accountNumber: z.string().optional().nullable(),
    ifscCode: z.string().optional().nullable(),
  })).optional().nullable(),
});

// POST /api/vendors - Create new vendor
export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const body = await req.json();
    const validatedData = createSchema.parse(body);
    
    // Extract itemCategoryIds and bankAccounts from validated data
    const { itemCategoryIds, bankAccounts, ...vendorData } = validatedData;
    
    // Create vendor and handle item categories relationship
    const created = await prisma.$transaction(async (tx) => {
      // Create vendor first
      const vendor = await tx.vendor.create({
        data: vendorData as any,
      });
      
      // Create bank accounts if provided (limit to 3)
      if (bankAccounts && bankAccounts.length > 0) {
        const validBankAccounts = bankAccounts.slice(0, 3).filter((acc: any) => 
          acc.bank || acc.branch || acc.branchCode || acc.accountNumber || acc.ifscCode
        );
        if (validBankAccounts.length > 0) {
          await tx.vendorBankAccount.createMany({
            data: validBankAccounts.map((acc: any) => ({
              vendorId: vendor.id,
              bank: acc.bank,
              branch: acc.branch,
              branchCode: acc.branchCode,
              accountNumber: acc.accountNumber,
              ifscCode: acc.ifscCode,
            }))
          });
        }
      }
      
      // TODO: Create item category relationships if provided
      // Temporarily disabled due to Prisma client issues
      // if (itemCategoryIds && itemCategoryIds.length > 0) {
      //   await tx.vendorItemCategory.createMany({
      //     data: itemCategoryIds.map(categoryId => ({
      //       vendorId: vendor.id,
      //       itemCategoryId: categoryId
      //     }))
      //   });
      // }
      
      // Return vendor with relationships
      return await tx.vendor.findUnique({
        where: { id: vendor.id },
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
          // TODO: Re-enable after fixing Prisma client issues
          // itemCategories: {
          //   select: {
          //     itemCategory: {
          //       select: {
          //         id: true,
          //         itemCategory: true,
          //       }
          //     }
          //   }
          // },
          createdAt: true,
          updatedAt: true,
        }
      });
    });
    
    return Success(created, 201);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    if (error.code === 'P2002') {
      return Error('Vendor with this name already exists', 409);
    }
    console.error("Create vendor error:", error);
    return Error("Failed to create vendor");
  }
}

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
    bank: z.string().optional().nullable(),
    branch: z.string().optional().nullable(),
    branchCode: z.string().optional().nullable(),
    accountNumber: z.string().optional().nullable(),
    ifscCode: z.string().optional().nullable(),
  })).optional().nullable(),
});

// PATCH /api/vendors - Update multiple vendors (bulk update)
export async function PATCH(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const body = await req.json();
    const { ids, data: updateData } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return BadRequest("IDs array is required");
    }

    const validatedData = updateSchema.parse(updateData);

    if (Object.keys(validatedData).length === 0) {
      return BadRequest("No valid fields to update");
    }

    const updated = await prisma.vendor.updateMany({
      where: { id: { in: ids } },
      data: validatedData,
    });

    return Success({ 
      message: `${updated.count} vendor(s) updated successfully`,
      count: updated.count 
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    console.error("Bulk update vendors error:", error);
    return Error("Failed to update vendors");
  }
}
