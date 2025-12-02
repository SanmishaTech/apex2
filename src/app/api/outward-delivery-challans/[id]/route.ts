import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  Success,
  Error as ApiError,
  BadRequest,
  NotFound,
} from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { ROLES_PERMISSIONS, PERMISSIONS } from "@/config/roles";

// GET /api/outward-delivery-challans/[id]
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt((await context.params).id);
    if (isNaN(id)) return BadRequest("Invalid outward delivery challan ID");

    const challan = await prisma.outwardDeliveryChallan.findUnique({
      where: { id },
      select: {
        id: true,
        outwardChallanNo: true,
        outwardChallanDate: true,
        challanNo: true,
        challanDate: true,
        fromSiteId: true,
        toSiteId: true,
        isApproved1: true,
        approved1ById: true,
        approved1At: true,
        isAccepted: true,
        acceptedById: true,
        acceptedAt: true,
        createdAt: true,
        updatedAt: true,
        fromSite: { select: { id: true, site: true } },
        toSite: { select: { id: true, site: true } },
        createdBy: { select: { id: true, name: true } },
        updatedBy: { select: { id: true, name: true } },
        outwardDeliveryChallanDetails: {
          select: {
            id: true,
            itemId: true,
            qty: true,
            challanQty: true,
            approved1Qty: true,
            receivedQty: true,
            item: {
              select: {
                id: true,
                item: true,
                itemCode: true,
                unit: { select: { unitName: true } },
              },
            },
          },
          orderBy: { id: "asc" },
        },
        outwardDeliveryChallanDocuments: {
          select: { id: true, documentName: true, documentUrl: true },
        },
      },
    });

    if (!challan) return NotFound("Outward delivery challan not found");

    return Success(challan);
  } catch (error) {
    console.error("Get outward delivery challan error:", error);
    return ApiError("Failed to fetch outward delivery challan");
  }
}

// PATCH /api/outward-delivery-challans/[id] - Approve or Accept
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt((await context.params).id);
    if (isNaN(id)) return BadRequest("Invalid outward delivery challan ID");

    const body = await req.json();
    const schema = z.object({
      statusAction: z.enum(["approve", "accept"]),
      outwardDeliveryChallanDetails: z
        .array(
          z.object({
            id: z.number().int().positive(),
            approved1Qty: z.number().nonnegative().optional(),
            receivedQty: z.number().nonnegative().optional(),
          })
        )
        .default([])
        .optional(),
    });
    const parsed = schema.parse(body);

    const current = await prisma.outwardDeliveryChallan.findUnique({
      where: { id },
      select: {
        id: true,
        fromSiteId: true,
        toSiteId: true,
        createdById: true,
        isApproved1: true,
        approved1ById: true,
        isAccepted: true,
        outwardDeliveryChallanDetails: {
          select: {
            id: true,
            itemId: true,
            challanQty: true,
            approved1Qty: true,
            receivedQty: true,
          },
        },
      },
    });
    if (!current) return NotFound("Outward delivery challan not found");

    const rolePerms =
      ROLES_PERMISSIONS[
        (auth as any).user.role as keyof typeof ROLES_PERMISSIONS
      ] || [];
    const has = (p: string) => (rolePerms as string[]).includes(p);

    const userId = (auth as any).user?.id as number;
    const now = new Date();

    if (parsed.statusAction === "approve") {
      if (!has(PERMISSIONS.APPROVE_OUTWARD_DELIVERY_CHALLAN)) {
        return BadRequest("Missing permission to approve challan");
      }
      if (current.isApproved1) return BadRequest("Already approved");
      if (current.createdById === userId)
        return BadRequest("Creator cannot approve");

      // Validate and update approved1Qty against challanQty
      const byId = new Map(
        (current.outwardDeliveryChallanDetails || []).map((d) => [d.id, d])
      );
      // Load closing stock for all items at fromSite
      const detailIds = (current.outwardDeliveryChallanDetails || []).map(
        (d) => d.itemId
      );
      const siteItems = await prisma.siteItem.findMany({
        where: { siteId: current.fromSiteId, itemId: { in: detailIds } },
        select: { itemId: true, closingStock: true },
      });
      const stockByItem = new Map<number, number>();
      for (const si of siteItems)
        stockByItem.set(si.itemId, Number(si.closingStock || 0));

      for (const row of parsed.outwardDeliveryChallanDetails || []) {
        const found = byId.get(row.id);
        if (!found) return BadRequest("Invalid detail id: " + row.id);
        const qty = Number(row.approved1Qty ?? 0);
        if (qty <= 0) {
          return BadRequest(
            `Approved qty must be greater than 0 for detail ${row.id}`
          );
        }

        const closing = stockByItem.get(found.itemId) ?? 0;
        if (qty > closing) {
          return BadRequest(
            `Approved qty cannot exceed closing stock (${closing}) for detail ${row.id}`
          );
        }
      }

      await prisma.$transaction(async (tx) => {
        // Header flags
        await tx.outwardDeliveryChallan.update({
          where: { id },
          data: {
            isApproved1: true,
            approved1ById: userId,
            approved1At: now,
            updatedById: userId,
            updatedAt: now,
          },
        });
        // Details
        for (const row of parsed.outwardDeliveryChallanDetails || []) {
          const val = Number(row.approved1Qty ?? 0);
          await tx.outwardDeliveryChallanDetail.update({
            where: { id: row.id },
            data: { approved1Qty: val, qty: val },
          });
        }
      });

      return Success({ message: "Challan approved" });
    } else if (parsed.statusAction === "accept") {
      if (!has(PERMISSIONS.ACCEPT_OUTWARD_DELIVERY_CHALLAN)) {
        return BadRequest("Missing permission to accept challan");
      }
      if (!current.isApproved1)
        return BadRequest("Challan must be approved before acceptance");
      if (current.isAccepted) return BadRequest("Already accepted");
      if (current.createdById === userId)
        return BadRequest("Creator cannot accept");
      if (current.approved1ById === userId)
        return BadRequest("Approver cannot accept");

      const byId = new Map(
        (current.outwardDeliveryChallanDetails || []).map((d) => [d.id, d])
      );
      // Load closing stock for all items at fromSite
      const detailIds = (current.outwardDeliveryChallanDetails || []).map(
        (d) => d.itemId
      );
      const siteItems = await prisma.siteItem.findMany({
        where: { siteId: current.fromSiteId, itemId: { in: detailIds } },
        select: { itemId: true, closingStock: true },
      });
      const stockByItem = new Map<number, number>();
      for (const si of siteItems)
        stockByItem.set(si.itemId, Number(si.closingStock || 0));

      for (const row of parsed.outwardDeliveryChallanDetails || []) {
        const found = byId.get(row.id);
        if (!found) return BadRequest("Invalid detail id: " + row.id);
        const qty = Number(row.receivedQty ?? 0);
        if (qty <= 0) {
          return BadRequest(
            `Received qty must be greater than 0 for detail ${row.id}`
          );
        }
        const max = Number(
          (found.approved1Qty != null
            ? found.approved1Qty
            : found.challanQty) || 0
        );

        const closing = stockByItem.get(found.itemId) ?? 0;
        if (qty > closing) {
          return BadRequest(
            `Received qty cannot exceed closing stock (${closing}) for detail ${row.id}`
          );
        }
      }

      await prisma.$transaction(async (tx) => {
        await tx.outwardDeliveryChallan.update({
          where: { id },
          data: {
            isAccepted: true,
            acceptedById: userId,
            acceptedAt: now,
            updatedById: userId,
            updatedAt: now,
          },
        });
        // Update details received qty and qty
        for (const row of parsed.outwardDeliveryChallanDetails || []) {
          const val = Number(row.receivedQty ?? 0);
          await tx.outwardDeliveryChallanDetail.update({
            where: { id: row.id },
            data: { receivedQty: val, qty: val },
          });
        }

        // Prepare maps for site items (from and to sites)
        const detailItemIds = (current.outwardDeliveryChallanDetails || []).map(
          (d) => d.itemId
        );
        const fromItems = await tx.siteItem.findMany({
          where: { siteId: current.fromSiteId, itemId: { in: detailItemIds } },
          select: {
            id: true,
            itemId: true,
            closingStock: true,
            unitRate: true,
            closingValue: true,
          },
        });
        const toItems = await tx.siteItem.findMany({
          where: { siteId: current.toSiteId!, itemId: { in: detailItemIds } },
          select: {
            id: true,
            itemId: true,
            closingStock: true,
            unitRate: true,
            closingValue: true,
          },
        });
        const fromMap = new Map<number, (typeof fromItems)[number]>();
        fromItems.forEach((si) => fromMap.set(si.itemId, si));
        const toMap = new Map<number, (typeof toItems)[number]>();
        toItems.forEach((si) => toMap.set(si.itemId, si));

        // For each detail, create stock ledger entries and update site stock
        for (const row of parsed.outwardDeliveryChallanDetails || []) {
          const found = (current.outwardDeliveryChallanDetails || []).find(
            (d) => d.id === row.id
          );
          if (!found) continue;
          const itemId = found.itemId;
          const qty = Number(row.receivedQty ?? 0);

          const fromInfo = fromMap.get(itemId);
          const issueRate = fromInfo ? Number(fromInfo.unitRate) : 0;

          // Ledger: Issue from fromSite
          await tx.stockLedger.create({
            data: {
              siteId: current.fromSiteId,
              transactionDate: now,
              itemId,
              outwardDeliveryChallanId: id,
              receivedQty: 0,
              issuedQty: qty,
              unitRate: issueRate,
              documentType: "OUTWARD_DEILVERY_CHALLAN",
            },
          });

          // Ledger: Receive at toSite
          await tx.stockLedger.create({
            data: {
              siteId: current.toSiteId!,
              transactionDate: now,
              itemId,
              outwardDeliveryChallanId: id,
              receivedQty: qty,
              issuedQty: 0,
              unitRate: issueRate,
              documentType: "OUTWARD_DEILVERY_CHALLAN",
            },
          });

          // Update fromSite SiteItem (decrement stock)
          if (fromInfo) {
            const prev = Number(fromInfo.closingStock || 0);
            const newStock = Math.max(prev - qty, 0);
            const newValue = Number(issueRate) * newStock;
            await tx.siteItem.update({
              where: { id: fromInfo.id },
              data: { closingStock: newStock, closingValue: newValue },
            });
          } else {
            // No from-site record exists: create with zero then deduct (results in zero)
            await tx.siteItem.create({
              data: {
                siteId: current.fromSiteId,
                itemId,
                openingStock: 0,
                openingRate: 0,
                openingValue: 0,
                closingStock: 0,
                closingValue: 0,
                unitRate: issueRate,
              },
            });
          }

          // Update toSite SiteItem (increment stock)
          const toInfo = toMap.get(itemId);
          if (toInfo) {
            const prev = Number(toInfo.closingStock || 0);
            const newStock = prev + qty;
            // adopt the issue rate as the receiving unit rate
            const newRate = issueRate;
            const newValue = newRate * newStock;
            await tx.siteItem.update({
              where: { id: toInfo.id },
              data: {
                closingStock: newStock,
                unitRate: newRate,
                closingValue: newValue,
              },
            });
          } else {
            const newRate = issueRate;
            const newStock = qty;
            const newValue = newRate * newStock;
            await tx.siteItem.create({
              data: {
                siteId: current.toSiteId!,
                itemId,
                openingStock: 0,
                openingRate: 0,
                openingValue: 0,
                closingStock: newStock,
                closingValue: newValue,
                unitRate: newRate,
              },
            });
          }
        }
      });

      return Success({ message: "Challan accepted" });
    }

    return BadRequest("Invalid status action");
  } catch (error: any) {
    if (error instanceof z.ZodError) return BadRequest(error.errors);
    console.error("Patch outward delivery challan error:", error);
    return ApiError("Failed to update outward delivery challan");
  }
}


