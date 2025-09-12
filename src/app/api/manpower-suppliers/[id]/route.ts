import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Success, Error } from '@/lib/api-response';
import { guardApiAccess } from '@/lib/access-guard';

// GET /api/manpower-suppliers/:id
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const { id } = await context.params;
  const idNum = Number(id);
  if (Number.isNaN(idNum)) return Error('Invalid id', 400);
  try {
    const record = await prisma.manpowerSupplier.findUnique({
      where: { id: idNum },
      select: {
        id: true,
        vendorCode: true,
        supplierName: true,
        contactPerson: true,
        representativeName: true,
        localContactNo: true,
        permanentContactNo: true,
        address: true,
        state: true,
        permanentAddress: true,
        city: true,
        pincode: true,
        bankName: true,
        accountNo: true,
        ifscNo: true,
        rtgsNo: true,
        panNo: true,
        adharNo: true,
        pfNo: true,
        esicNo: true,
        gstNo: true,
        numberOfWorkers: true,
        typeOfWork: true,
        workDone: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!record) return Error('Manpower supplier not found', 404);
    return Success(record);
  } catch {
    return Error('Failed to fetch manpower supplier');
  }
}

// DELETE /api/manpower-suppliers/:id
export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const { id } = await context.params;
  const idNum = Number(id);
  if (Number.isNaN(idNum)) return Error('Invalid id', 400);
  try {
    await prisma.manpowerSupplier.delete({ where: { id: idNum } });
    return Success({ id: idNum }, 200);
  } catch (e: any) {
    if (e?.code === 'P2025') return Error('Manpower supplier not found', 404);
    return Error('Failed to delete manpower supplier');
  }
}
