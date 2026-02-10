import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { Success, Error as ApiError, BadRequest } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { paginate } from "@/lib/paginate";
import { z } from "zod";
import { ROLES } from "@/config/roles";

const indentItemSchema = z.object({
  itemId: z.coerce.number().min(1, "Item is required"),
  remark: z.string().optional(),
  indentQty: z.coerce
    .number()
    .min(0, "Indent quantity must be non-negative")
    .max(99999999.9999, "Indent quantity must be <= 99,999,999.9999"),
  approved1Qty: z.coerce
    .number()
    .min(0, "Approved quantity must be non-negative")
    .max(99999999.9999, "Approved quantity must be <= 99,999,999.9999")
    .optional(),
  approved2Qty: z.coerce
    .number()
    .min(0, "Approved quantity must be non-negative")
    .max(99999999.9999, "Approved quantity must be <= 99,999,999.9999")
    .optional(),
});

const createSchema = z.object({
  indentDate: z.string().transform((val) => new Date(val)),
  deliveryDate: z.string().transform((val) => new Date(val)),
  siteId: z.coerce.number().min(1, "Site is required"),
  remarks: z.string().optional(),
  indentItems: z
    .array(indentItemSchema)
    .min(1, "At least one item is required"),
});

// Auto-generate indent number
async function generateIndentNo(): Promise<string> {
  const count = await prisma.indent.count();
  const nextNumber = (count + 1).toString().padStart(5, "0");
  return `IND-${nextNumber}`;
}

// GET /api/indents?search=&page=1&perPage=10&sort=indentDate&order=desc&site=
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const perPage = Math.min(
      100,
      Math.max(1, Number(searchParams.get("perPage")) || 10)
    );
    const search = searchParams.get("search")?.trim() || "";
    const siteFilter = searchParams.get("site") || "";
    const sort = (searchParams.get("sort") || "indentDate") as string;
    const order = (searchParams.get("order") === "asc" ? "asc" : "desc") as
      | "asc"
      | "desc";

    const where: any = {};

    if (search) {
      where.OR = [
        { indentNo: { contains: search } },
        { remarks: { contains: search } },
      ];
    }

    // Site-based visibility: non-admin and non-projectDirector see only their assigned sites
    const role = auth.user.role;
    const isPrivileged = role === ROLES.ADMIN || role === ROLES.PROJECT_DIRECTOR;
    let assignedSiteIds: number[] | null = null;
    if (!isPrivileged) {
      const employee = await prisma.employee.findFirst({
        where: { userId: auth.user.id },
        select: { siteEmployees: { select: { siteId: true } } },
      });
      assignedSiteIds = (employee?.siteEmployees || [])
        .map((s) => s.siteId)
        .filter((v): v is number => typeof v === "number");

      // If no assigned sites, return empty set early
      if (!siteFilter && (!assignedSiteIds || assignedSiteIds.length === 0)) {
        return Success({
          data: [],
          meta: { page, perPage, total: 0, totalPages: 1 },
        });
      }
    }

    if (siteFilter) {
      const siteId = parseInt(siteFilter);
      if (!isNaN(siteId)) {
        if (!isPrivileged && assignedSiteIds) {
          // If the requested site is not among assignments, return empty
          if (!assignedSiteIds.includes(siteId)) {
            return Success({
              data: [],
              meta: { page, perPage, total: 0, totalPages: 1 },
            });
          }
        }
        where.siteId = siteId;
      }
    } else if (!isPrivileged && assignedSiteIds && assignedSiteIds.length > 0) {
      where.siteId = { in: assignedSiteIds };
    }

    const sortableFields = new Set(["indentNo", "indentDate", "createdAt"]);
    const orderBy: Record<string, "asc" | "desc"> = sortableFields.has(sort)
      ? { [sort]: order }
      : { indentDate: "desc" };

    const result = await paginate({
      model: prisma.indent as any,
      where,
      orderBy,
      page,
      perPage,
      select: {
        id: true,
        indentNo: true,
        indentDate: true,
        deliveryDate: true,
        siteId: true,
        createdById: true,
        approved1ById: true,
        approved2ById: true,
        approvalStatus: true,
        suspended: true,
        remarks: true,
        createdAt: true,
        updatedAt: true,
        createdBy: { select: { id: true, name: true } },
        approved1By: { select: { id: true, name: true } },
        approved2By: { select: { id: true, name: true } },
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
            purchaseOrderDetailId: true,
            item: {
              select: {
                id: true,
                itemCode: true,
                item: true,
              },
            },
            indentQty: true,
            approved1Qty: true,
            approved2Qty: true,
            remark: true,
          },
        },
      },
    });

    return Success({
      data: result.data,
      meta: {
        page: result.page,
        perPage: result.perPage,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
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
      const indentData: Prisma.IndentUncheckedCreateInput = {
        indentNo,
        indentDate: parsedData.indentDate,
        deliveryDate: parsedData.deliveryDate,
        remarks: parsedData.remarks || null,
        createdById: auth.user.id,
        updatedById: auth.user.id,
        siteId: parsedData.siteId,
      };

      const indent = await tx.indent.create({
        data: indentData,
        select: {
          id: true,
          indentNo: true,
          indentDate: true,
          deliveryDate: true,
          siteId: true,
          approvalStatus: true,
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
      const indentId: number = indent.id;
      const itemsData: Prisma.IndentItemCreateManyInput[] =
        parsedData.indentItems.map((item) => ({
          indentId,
          itemId: item.itemId,
          remark: item.remark || null,
          indentQty: item.indentQty,
          approved1Qty: item.approved1Qty ?? 0,
          approved2Qty: item.approved2Qty ?? 0,
        }));

      await tx.indentItem.createMany({
        data: itemsData,
      });

      // Fetch the created indent with items
      const indentWithItems = await tx.indent.findUnique({
        where: { id: indent.id },
        select: {
          id: true,
          indentNo: true,
          indentDate: true,
          deliveryDate: true,
          siteId: true,
          approvalStatus: true,
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
              remark: true,
              indentQty: true,
              approved1Qty: true,
              approved2Qty: true,
            },
          },
        } as any,
      });

      return indentWithItems;
    });

    return Success(result, 201);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    if (error.code === "P2002") {
      return ApiError("Indent number already exists", 409);
    }
    console.error("Create indent error:", error);
    return ApiError("Failed to create indent");
  }
}
