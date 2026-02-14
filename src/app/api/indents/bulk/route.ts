import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardApiAccess } from "@/lib/access-guard";
import { Success, BadRequest, Error as ApiError } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const sp = req.nextUrl.searchParams;
    const idsRaw = (sp.get("ids") || "").trim();
    if (!idsRaw) return BadRequest("ids is required");

    const ids = Array.from(
      new Set(
        idsRaw
          .split(",")
          .map((x) => Number(String(x || "").trim()))
          .filter((n) => Number.isFinite(n) && n > 0)
      )
    );

    if (ids.length === 0) return BadRequest("ids is required");
    if (ids.length > 50) return BadRequest("Too many ids (max 50)");

    const indents = await prisma.indent.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        indentNo: true,
        indentDate: true,
        deliveryDate: true,
        siteId: true,
        priority: true,
        approvalStatus: true,
        suspended: true,
        remarks: true,
        site: { select: { id: true, site: true } },
        indentItems: {
          orderBy: { id: "asc" },
          select: {
            id: true,
            indentId: true,
            itemId: true,
            remark: true,
            indentQty: true,
            approved1Qty: true,
            approved2Qty: true,
            item: {
              select: {
                id: true,
                itemCode: true,
                item: true,
                unit: { select: { id: true, unitName: true } },
              },
            },
            indentItemPOs: {
              select: {
                id: true,
                orderedQty: true,
                purchaseOrderDetailId: true,
              },
            },
          },
        },
      },
      orderBy: [{ indentDate: "asc" }, { id: "asc" }],
    });

    return Success({ data: indents });
  } catch (error) {
    console.error("Bulk indents fetch error:", error);
    return ApiError("Failed to fetch indents");
  }
}
