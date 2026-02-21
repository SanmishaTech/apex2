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
import { PERMISSIONS } from "@/config/roles";

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

    const permSet = new Set((auth.user.permissions || []) as string[]);
    const has = (p: string) => permSet.has(p);

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
        // Update SiteItem logs at fromSite for existing records
        const approveItemIds = (
          current.outwardDeliveryChallanDetails || []
        ).map((d) => d.itemId);
        if (approveItemIds.length > 0) {
          await tx.siteItem.updateMany({
            where: {
              siteId: current.fromSiteId,
              itemId: { in: approveItemIds },
            },
            data: { log: "APPROVE ODC OLD" },
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

        // Load expiry flags for all items
        const detailItemIds = (current.outwardDeliveryChallanDetails || []).map(
          (d) => d.itemId
        );
        const items = await tx.item.findMany({
          where: { id: { in: detailItemIds } },
          select: { id: true, isExpiryDate: true },
        });
        const isExpiryByItemId = new Map<number, boolean>(
          items.map((it) => [Number(it.id), Boolean((it as any).isExpiryDate)])
        );

        // Load all batch rows for this challan (for expiry items)
        const detailIds = (current.outwardDeliveryChallanDetails || [])
          .map((d) => d.id)
          .filter((v): v is number => typeof v === "number");
        const odcDetailBatches = detailIds.length
          ? await tx.outwardDeliveryChallanDetailBatch.findMany({
              where: { outwardDeliveryChallanDetailId: { in: detailIds } },
              select: {
                outwardDeliveryChallanDetailId: true,
                batchNumber: true,
                expiryDate: true,
                qty: true,
                unitRate: true,
                amount: true,
              },
              orderBy: [{ id: "asc" }],
            })
          : [];
        const batchesByDetailId = new Map<number, typeof odcDetailBatches>();
        for (const b of odcDetailBatches) {
          const k = Number(b.outwardDeliveryChallanDetailId);
          const prev = batchesByDetailId.get(k) || [];
          prev.push(b);
          batchesByDetailId.set(k, prev);
        }

        // Prepare maps for site items (from and to sites)
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

          const isExpiry = isExpiryByItemId.get(itemId) ?? false;
          const detailBatches = batchesByDetailId.get(found.id) || [];
          if (isExpiry && detailBatches.length > 0) {
            const sum = detailBatches.reduce(
              (acc, b) => acc + Number(b.qty || 0),
              0
            );
            if (Number(sum.toFixed(2)) !== Number(qty.toFixed(2))) {
              throw new Error(
                `Received qty must match batch qty total (${Number(sum.toFixed(
                  2
                ))}) for item ${itemId}`
              );
            }
          }

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
            const prevStock = Number(toInfo.closingStock || 0);
            const prevValue = Number(toInfo.closingValue || 0);
            const newStock = prevStock + qty;
            const incValue = issueRate * qty;
            const newValue = prevValue + incValue;
            const newRate = newStock !== 0 ? newValue / newStock : 0;
            await tx.siteItem.update({
              where: { id: toInfo.id },
              data: {
                closingStock: newStock,
                unitRate: newRate,
                closingValue: newValue,
                log: "ACCEPT ODC OLD",
              },
            });
          } else {
            const newStock = qty;
            const newValue = issueRate * qty;
            const newRate = newStock !== 0 ? newValue / newStock : 0;
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
                log: "ACCEPT ODC NEW",
              },
            });
          }

          // Batch-wise stock movement for expiry items
          if (isExpiry && detailBatches.length > 0) {
            const fromSiteItem = await tx.siteItem.findFirst({
              where: { siteId: current.fromSiteId, itemId },
              select: { id: true },
            });
            if (!fromSiteItem?.id) {
              throw new Error("From-site stock record not found for batch movement");
            }
            const toSiteItem = await tx.siteItem.findFirst({
              where: { siteId: current.toSiteId!, itemId },
              select: { id: true },
            });
            const toSiteItemId = toSiteItem?.id
              ? toSiteItem.id
              : (
                  await tx.siteItem.create({
                    data: {
                      siteId: current.toSiteId!,
                      itemId,
                      openingStock: 0,
                      openingRate: 0,
                      openingValue: 0,
                      closingStock: 0,
                      closingValue: 0,
                      unitRate: issueRate,
                      log: "ACCEPT ODC BATCH NEW",
                    } as any,
                    select: { id: true },
                  })
                ).id;

            for (const b of detailBatches) {
              const bn = String(b.batchNumber || "").trim();
              const exp = String(b.expiryDate || "").trim();
              const bQty = Number(b.qty || 0);
              const unitRate = Number(b.unitRate || issueRate || 0);
              const bAmount = Number((unitRate * bQty).toFixed(2));

              const fromBatch = await tx.siteItemBatch.findFirst({
                where: { siteItemId: fromSiteItem.id, batchNumber: bn },
                select: { id: true, expiryDate: true, closingQty: true, closingValue: true },
              });
              if (!fromBatch) {
                throw new Error(`From-site batch not found: ${bn}`);
              }
              if (String(fromBatch.expiryDate || "") !== exp) {
                throw new Error(
                  `Expiry date mismatch for batch ${bn}. Expected ${fromBatch.expiryDate}`
                );
              }
              const prevFromQty = Number(fromBatch.closingQty || 0);
              const prevFromVal = Number(fromBatch.closingValue || 0);
              if (bQty > prevFromQty) {
                throw new Error(
                  `Batch qty cannot exceed from-site batch closing qty (${prevFromQty}) for batch ${bn}`
                );
              }
              const nextFromQty = Math.max(0, Number((prevFromQty - bQty).toFixed(2)));
              const nextFromVal = Math.max(0, Number((prevFromVal - bAmount).toFixed(2)));
              const nextFromRate = nextFromQty > 0 ? Number((nextFromVal / nextFromQty).toFixed(2)) : 0;
              await tx.siteItemBatch.update({
                where: { id: fromBatch.id },
                data: {
                  closingQty: nextFromQty as any,
                  closingValue: nextFromVal as any,
                  unitRate: nextFromRate as any,
                } as any,
              });

              const toBatch = await tx.siteItemBatch.findFirst({
                where: { siteItemId: toSiteItemId, batchNumber: bn },
                select: { id: true, expiryDate: true, closingQty: true, closingValue: true },
              });
              if (toBatch && String(toBatch.expiryDate || "") !== exp) {
                throw new Error(
                  `Expiry date mismatch for batch ${bn} at To Site. Expected ${toBatch.expiryDate}`
                );
              }

              if (!toBatch) {
                await tx.siteItemBatch.create({
                  data: {
                    siteItemId: toSiteItemId,
                    siteId: current.toSiteId!,
                    itemId,
                    batchNumber: bn,
                    expiryDate: exp,
                    closingQty: bQty as any,
                    closingValue: bAmount as any,
                    unitRate: unitRate as any,
                  } as any,
                });
              } else {
                const prevToQty = Number(toBatch.closingQty || 0);
                const prevToVal = Number(toBatch.closingValue || 0);
                const nextToQty = Number((prevToQty + bQty).toFixed(2));
                const nextToVal = Number((prevToVal + bAmount).toFixed(2));
                const nextToRate = nextToQty > 0 ? Number((nextToVal / nextToQty).toFixed(2)) : 0;
                await tx.siteItemBatch.update({
                  where: { id: toBatch.id },
                  data: {
                    closingQty: nextToQty as any,
                    closingValue: nextToVal as any,
                    unitRate: nextToRate as any,
                  } as any,
                });
              }
            }
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
