import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error, BadRequest, NotFound } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import {
  validatePAN,
  validateTAN,
  validateCIN,
  validateGST,
} from "@/lib/tax-validation";

const updateSchema = z.object({
  siteCode: z.string().optional().nullable(),
  site: z.string().min(1, "Site name is required").optional(),
  shortName: z.string().optional().nullable(),
  companyId: z.number().optional().nullable(),
  status: z.enum(["Ongoing", "Hold", "Monitor"]).optional(),
  attachCopyUrl: z.string().optional().nullable(),
  contactPerson: z.string().optional().nullable(),
  contactNo: z.string().optional().nullable(),
  addressLine1: z.string().optional().nullable(),
  addressLine2: z.string().optional().nullable(),
  stateId: z.number().optional().nullable(),
  cityId: z.number().optional().nullable(),
  pinCode: z.string().optional().nullable(),
  longitude: z.string().optional().nullable(),
  latitude: z.string().optional().nullable(),
  panNo: z
    .string()
    .optional()
    .nullable()
    .refine((val) => !val || validatePAN(val), {
      message:
        "Invalid PAN format. Format: AAAAA9999A (5 letters + 4 digits + 1 letter)",
    }),
  gstNo: z
    .string()
    .optional()
    .nullable()
    .refine((val) => !val || validateGST(val), {
      message: "Invalid GST format. Format: 99AAAAA9999A9A9",
    }),
  tanNo: z
    .string()
    .optional()
    .nullable()
    .refine((val) => !val || validateTAN(val), {
      message:
        "Invalid TAN format. Format: AAAA99999A (4 letters + 5 digits + 1 letter)",
    }),
  cinNo: z
    .string()
    .optional()
    .nullable()
    .refine((val) => !val || validateCIN(val), {
      message: "Invalid CIN format. Format: U99999AA9999AAA999999",
    }),
});

// GET /api/sites/[id] - Get specific site
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt((await context.params).id);
    if (isNaN(id)) return BadRequest("Invalid site ID");

    const site = await prisma.site.findUnique({
      where: { id },
      select: {
        id: true,
        siteCode: true,
        site: true,
        shortName: true,
        companyId: true,
        status: true,
        attachCopyUrl: true,
        contactPerson: true,
        contactNo: true,
        addressLine1: true,
        addressLine2: true,
        pinCode: true,
        longitude: true,
        latitude: true,
        panNo: true,
        gstNo: true,
        tanNo: true,
        cinNo: true,
        createdAt: true,
        updatedAt: true,
        stateId: true,
        cityId: true,
        company: {
          select: {
            id: true,
            companyName: true,
            shortName: true,
          },
        },
        state: {
          select: {
            id: true,
            state: true,
          },
        },
        city: {
          select: {
            id: true,
            city: true,
          },
        },
      },
    });

    if (!site) return NotFound("Site not found");
    return Success(site);
  } catch (error) {
    console.error("Get site error:", error);
    return Error("Failed to fetch site");
  }
}

// PATCH /api/sites/[id] - Update specific site
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt((await context.params).id);
    if (isNaN(id)) return BadRequest("Invalid site ID");

    const contentType = req.headers.get("content-type") || "";
    let siteData: any;
    let attachCopyFile: File | null = null;

    // Handle multipart form data for file uploads
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      attachCopyFile = form.get("attachCopy") as File;

      // Extract other form data
      siteData = {
        siteCode: form.get("siteCode") || undefined,
        site: form.get("site") || undefined,
        shortName: form.get("shortName") || undefined,
        companyId: form.get("companyId")
          ? Number(form.get("companyId"))
          : undefined,
        status: form.get("status") || undefined,
        contactPerson: form.get("contactPerson") || undefined,
        contactNo: form.get("contactNo") || undefined,
        addressLine1: form.get("addressLine1") || undefined,
        addressLine2: form.get("addressLine2") || undefined,
        stateId: form.get("stateId") ? Number(form.get("stateId")) : undefined,
        cityId: form.get("cityId") ? Number(form.get("cityId")) : undefined,
        pinCode: form.get("pinCode") || undefined,
        longitude: form.get("longitude") || undefined,
        latitude: form.get("latitude") || undefined,
        panNo: form.get("panNo") || undefined,
        gstNo: form.get("gstNo") || undefined,
        tanNo: form.get("tanNo") || undefined,
        cinNo: form.get("cinNo") || undefined,
      };

      // Remove undefined values
      siteData = Object.fromEntries(
        Object.entries(siteData).filter(([_, v]) => v !== undefined)
      );
    } else {
      // Handle JSON data
      siteData = await req.json();
    }

    // Handle file upload if present
    let attachCopyUrl = siteData.attachCopyUrl;
    if (attachCopyFile && attachCopyFile.size > 0) {
      // Validate file size
      if (attachCopyFile.size > 20 * 1024 * 1024) {
        return Error("Attach copy file too large (max 20MB)", 413);
      }

      // Get current site to potentially remove old file
      const currentSite = await prisma.site.findUnique({
        where: { id },
        select: { attachCopyUrl: true },
      });

      // Generate unique filename and save new file
      const ext = path.extname(attachCopyFile.name) || ".pdf";
      const filename = `${Date.now()}-${crypto.randomUUID()}${ext}`;
      const dir = path.join(process.cwd(), "uploads", "sites");
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(
        path.join(dir, filename),
        Buffer.from(await attachCopyFile.arrayBuffer())
      );
      attachCopyUrl = `/uploads/sites/${filename}`;

      // Clean up old file if it exists
      if (currentSite?.attachCopyUrl) {
        try {
          const oldFilePath = path.join(
            process.cwd(),
            "public",
            currentSite.attachCopyUrl
          );
          await fs.unlink(oldFilePath);
        } catch (error) {
          // Ignore errors when cleaning up old files
          console.warn("Could not delete old attach copy file:", error);
        }
      }
    }

    const validatedData = updateSchema.parse({
      ...siteData,
      attachCopyUrl,
    });

    const updated = await prisma.site.update({
      where: { id },
      data: validatedData,
      select: {
        id: true,
        siteCode: true,
        site: true,
        shortName: true,
        companyId: true,
        status: true,
        attachCopyUrl: true,
        contactPerson: true,
        contactNo: true,
        addressLine1: true,
        addressLine2: true,
        pinCode: true,
        longitude: true,
        latitude: true,
        panNo: true,
        gstNo: true,
        tanNo: true,
        cinNo: true,
        createdAt: true,
        updatedAt: true,
        stateId: true,
        cityId: true,
        company: {
          select: {
            id: true,
            companyName: true,
            shortName: true,
          },
        },
        state: {
          select: {
            id: true,
            state: true,
          },
        },
        city: {
          select: {
            id: true,
            city: true,
          },
        },
      },
    });

    return Success(updated);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    if (error.code === "P2025") return NotFound("Site not found");
    if (error.code === "P2002") return Error("Site already exists", 409);
    console.error("Update site error:", error);
    return Error("Failed to update site");
  }
}

// DELETE /api/sites/[id] - Delete specific site
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt((await context.params).id);
    if (isNaN(id)) return BadRequest("Invalid site ID");

    // Get site to check if file needs to be cleaned up
    const site = await prisma.site.findUnique({
      where: { id },
      select: { attachCopyUrl: true },
    });

    if (!site) return NotFound("Site not found");

    // Delete the site record
    await prisma.site.delete({
      where: { id },
    });

    // Clean up file if it exists
    if (site.attachCopyUrl) {
      try {
        const filePath = path.join(process.cwd(), "public", site.attachCopyUrl);
        await fs.unlink(filePath);
      } catch (error) {
        // Ignore errors when cleaning up files
        console.warn("Could not delete attach copy file:", error);
      }
    }

    return Success({ message: "Site deleted successfully" });
  } catch (error: any) {
    if (error.code === "P2025") return NotFound("Site not found");
    console.error("Delete site error:", error);
    return Error("Failed to delete site");
  }
}
