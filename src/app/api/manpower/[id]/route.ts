import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error as ApiError } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import fs from "fs/promises";
import path from "path";

// GET /api/manpower/:id
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;
  const { id } = await context.params;
  const idNum = Number(id);
  if (Number.isNaN(idNum)) return ApiError("Invalid id", 400);
  try {
    const rec = await prisma.manpower.findUnique({
      where: { id: idNum },
      select: {
        id: true,
        firstName: true,
        middleName: true,
        lastName: true,
        supplierId: true,
        manpowerSupplier: { select: { id: true, supplierName: true } },
        dateOfBirth: true,
        address: true,
        location: true,
        mobileNumber: true,
        wage: true,
        category: true,
        skillSet: true,
        bank: true,
        branch: true,
        accountNumber: true,
        ifscCode: true,
        pfNo: true,
        esicNo: true,
        unaNo: true,
        panNumber: true,
        panDocumentUrl: true,
        aadharNo: true,
        aadharDocumentUrl: true,
        voterIdNo: true,
        voterIdDocumentUrl: true,
        drivingLicenceNo: true,
        drivingLicenceDocumentUrl: true,
        bankDetailsDocumentUrl: true,
        watch: true,
        createdAt: true,
        updatedAt: true,
        manpowerDocuments: {
          select: {
            id: true,
            documentName: true,
            documentUrl: true,
          },
          orderBy: { id: "asc" },
        },
      },
    });
    if (!rec) return ApiError("Not found", 404);
    return Success(rec);
  } catch {
    return ApiError("Failed to fetch manpower");
  }
}

// DELETE /api/manpower/:id
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;
  const { id } = await context.params;
  const idNum = Number(id);
  if (Number.isNaN(idNum)) return ApiError("Invalid id", 400);
  try {
    // Fetch URLs before delete so we can remove files from disk
    const rec = await prisma.manpower.findUnique({
      where: { id: idNum },
      select: {
        panDocumentUrl: true,
        aadharDocumentUrl: true,
        voterIdDocumentUrl: true,
        drivingLicenceDocumentUrl: true,
        bankDetailsDocumentUrl: true,
      },
    });

    await prisma.manpower.delete({ where: { id: idNum } });

    // Best-effort cleanup of uploaded files (ignore errors)
    const urls = [
      rec?.panDocumentUrl,
      rec?.aadharDocumentUrl,
      rec?.voterIdDocumentUrl,
      rec?.drivingLicenceDocumentUrl,
      rec?.bankDetailsDocumentUrl,
    ].filter((u): u is string => typeof u === "string" && !!u);

    for (const url of urls) {
      try {
        // Only allow deletion under /uploads/manpower
        if (!url.startsWith("/uploads/manpower/")) continue;
        const rel = url.replace(/^\//, ""); // remove leading slash
        const abs = path.join(process.cwd(), rel);
        const safeBase = path.join(process.cwd(), "uploads", "manpower");
        const normalized = path.normalize(abs);
        if (!normalized.startsWith(safeBase)) continue; // safety check
        await fs.unlink(normalized).catch(() => {});
      } catch {
        // ignore individual file errors
      }
    }

    return Success({ id: idNum });
  } catch (e: any) {
    if (e?.code === "P2025") return ApiError("Not found", 404);
    return ApiError("Failed to delete manpower");
  }
}