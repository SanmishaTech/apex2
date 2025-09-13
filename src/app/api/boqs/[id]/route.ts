import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Success, Error } from '@/lib/api-response';
import { guardApiAccess } from '@/lib/access-guard';

// GET /api/boqs/:id
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const { id } = await context.params;
  const idNum = Number(id);
  if (Number.isNaN(idNum)) return Error('Invalid id', 400);
  try {
    const boq = await prisma.boq.findUnique({
      where: { id: idNum },
      select: {
        id: true,
        boqNo: true,
        siteId: true,
        site: { select: { id: true, site: true } },
        workName: true,
        workOrderNo: true,
        workOrderDate: true,
        startDate: true,
        endDate: true,
        totalWorkValue: true,
        gstRate: true,
        agreementNo: true,
        agreementStatus: true,
        completionPeriod: true,
        completionDate: true,
        dateOfExpiry: true,
        commencementDate: true,
        timeExtensionDate: true,
        defectLiabilityPeriod: true,
        performanceSecurityMode: true,
        performanceSecurityDocumentNo: true,
        performanceSecurityPeriod: true,
        createdAt: true,
        updatedAt: true,
        items: {
          select: {
            id: true,
            activityId: true,
            clientSrNo: true,
            item: true,
            unitId: true,
            qty: true,
            rate: true,
            amount: true,
            openingQty: true,
            openingValue: true,
            closingQty: true,
            closingValue: true,
            isGroup: true,
          },
          orderBy: { id: 'asc' },
        },
      }
    });
    if (!boq) return Error('BOQ not found', 404);
    return Success(boq);
  } catch {
    return Error('Failed to fetch BOQ');
  }
}

// DELETE /api/boqs/:id
export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;
  const { id } = await context.params;
  const idNum = Number(id);
  if (Number.isNaN(idNum)) return Error('Invalid id', 400);
  try {
    await prisma.boq.delete({ where: { id: idNum } });
    return Success({ id: idNum }, 200);
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err?.code === 'P2025') return Error('BOQ not found', 404);
    return Error('Failed to delete BOQ');
  }
}
