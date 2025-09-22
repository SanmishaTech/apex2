import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error as ApiError, BadRequest } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { paginate } from "@/lib/paginate";
import { z } from "zod";

const indentItemSchema = z.object({
  itemId: z.number().min(1, "Item is required"),
  closingStock: z.number().min(0, "Closing stock must be non-negative"),
  unitId: z.number().min(1, "Unit is required"),
  remark: z.string().optional(),
  indentQty: z.number().min(0, "Indent quantity must be non-negative"),
  deliveryDate: z.string().transform((val) => new Date(val)),
});

const createSchema = z.object({
  indentDate: z.string().transform((val) => new Date(val)),
  siteId: z.number().optional(),
  deliveryDate: z.string().transform((val) => new Date(val)),
  remarks: z.string().optional(),
  indentItems: z.array(indentItemSchema).min(1, "At least one item is required"),
});

// Auto-generate indent number
async function generateIndentNo(): Promise<string> {
  const count = await prisma.indent.count();
  const nextNumber = (count + 1).toString().padStart(5, '0');
  return `IND-${nextNumber}`;
}

// GET /api/indents?search=&page=1&perPage=10&sort=indentDate&order=desc&site=
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const perPage = Math.min(100, Math.max(1, Number(searchParams.get("perPage")) || 10));
    const search = searchParams.get("search")?.trim() || "";
    const siteFilter = searchParams.get("site") || "";
    const sort = (searchParams.get("sort") || "indentDate") as string;
    const order = (searchParams.get("order") === "asc" ? "asc" : "desc") as "asc" | "desc";

    type IndentWhere = {
      OR?: Array<{ 
        indentNo?: { contains: string }; 
        remarks?: { contains: string };
      }>;
      siteId?: number;
    };
    
    const where: IndentWhere = {};
    
    if (search) {
      where.OR = [
        { indentNo: { contains: search } },
        { remarks: { contains: search } },
      ];
    }
    
    if (siteFilter) {
      const siteId = parseInt(siteFilter);
      if (!isNaN(siteId)) {
        where.siteId = siteId;
      }
    }

    const sortableFields = new Set(["indentNo", "indentDate", "deliveryDate", "createdAt"]);
    const orderBy: Record<string, "asc" | "desc"> = sortableFields.has(sort)
      ? { [sort]: order }
      : { indentDate: "desc" };

    const result = await paginate({
      model: prisma.indent,
      where,
      orderBy,
      page,
      perPage,
      select: {
        id: true,
        indentNo: true,
        indentDate: true,
        siteId: true,
        deliveryDate: true,
        remarks: true,
        createdAt: true,
        updatedAt: true,
        site: {
          select: {
            id: true,
            site: true,
          },
        },
        indentItems: {
          select: {
            id: true,
            itemId: true,
            item: {
              select: {
                id: true,
                itemCode: true,
                item: true,
              },
            },
            indentQty: true,
            unitId: true,
            unit: {
              select: {
                id: true,
                unitName: true,
              },
            },
          },
        },
      },
    });

    return Success(result);
  } catch (error) {
    console.error("Get indents error:", error);
    return ApiError("Failed to fetch indents");
  }
}

// POST /api/indents - Create new indent
export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const body = await req.json();
    const parsedData = createSchema.parse(body);

    // Generate auto-increment indent number
    const indentNo = await generateIndentNo();

    const result = await prisma.$transaction(async (tx) => {
      const indent = await tx.indent.create({
        data: {
          indentNo,
          indentDate: parsedData.indentDate,
          siteId: parsedData.siteId || null,
          deliveryDate: parsedData.deliveryDate,
          remarks: parsedData.remarks || null,
        },
        select: {
          id: true,
          indentNo: true,
          indentDate: true,
          siteId: true,
          deliveryDate: true,
          remarks: true,
          createdAt: true,
          updatedAt: true,
          site: {
            select: {
              id: true,
              site: true,
            },
          },
        },
      });

      // Create indent items
      const indentItems = await tx.indentItem.createMany({
        data: parsedData.indentItems.map(item => ({
          indentId: indent.id,
          itemId: item.itemId,
          closingStock: item.closingStock,
          unitId: item.unitId,
          remark: item.remark || null,
          indentQty: item.indentQty,
          deliveryDate: item.deliveryDate,
        })),
      });

      // Fetch the created indent with items
      const indentWithItems = await tx.indent.findUnique({
        where: { id: indent.id },
        select: {
          id: true,
          indentNo: true,
          indentDate: true,
          siteId: true,
          deliveryDate: true,
          remarks: true,
          createdAt: true,
          updatedAt: true,
          site: {
            select: {
              id: true,
              site: true,
            },
          },
          indentItems: {
            select: {
              id: true,
              itemId: true,
              item: {
                select: {
                  id: true,
                  itemCode: true,
                  item: true,
                },
              },
              closingStock: true,
              unitId: true,
              unit: {
                select: {
                  id: true,
                  unitName: true,
                },
              },
              remark: true,
              indentQty: true,
              deliveryDate: true,
            },
          },
        },
      });

      return indentWithItems;
    });

    return Success(result, 201);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    if (error.code === 'P2002') {
      return ApiError('Indent number already exists', 409);
    }
    console.error("Create indent error:", error);
    return ApiError("Failed to create indent");
  }
}
