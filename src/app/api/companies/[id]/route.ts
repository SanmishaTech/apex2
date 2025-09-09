import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error, BadRequest, NotFound } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { validatePAN, validateTAN, validateCIN, validateGST } from "@/lib/tax-validation";

const updateSchema = z.object({
  companyName: z.string().min(1, "Company name is required").optional(),
  shortName: z.string().optional().nullable(),
  contactPerson: z.string().optional().nullable(),
  contactNo: z.string().optional().nullable(),
  addressLine1: z.string().optional().nullable(),
  addressLine2: z.string().optional().nullable(),
  stateId: z.number().optional().nullable(),
  cityId: z.number().optional().nullable(),
  pinCode: z.string().optional().nullable(),
  logoUrl: z.string().optional().nullable(),
  closed: z.boolean().optional(),
  panNo: z.string()
    .optional()
    .nullable()
    .refine((val) => !val || validatePAN(val), {
      message: "Invalid PAN format. Format: AAAAA9999A (5 letters + 4 digits + 1 letter)"
    }),
  gstNo: z.string()
    .optional()
    .nullable()
    .refine((val) => !val || validateGST(val), {
      message: "Invalid GST format. Format: 99AAAAA9999A9A9"
    }),
  tanNo: z.string()
    .optional()
    .nullable()
    .refine((val) => !val || validateTAN(val), {
      message: "Invalid TAN format. Format: AAAA99999A (4 letters + 5 digits + 1 letter)"
    }),
  cinNo: z.string()
    .optional()
    .nullable()
    .refine((val) => !val || validateCIN(val), {
      message: "Invalid CIN format. Format: U99999AA9999AAA999999"
    }),
});

// GET /api/companies/[id] - Get single company
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt(params.id);
    if (isNaN(id)) return BadRequest("Invalid company ID");

    const company = await prisma.company.findUnique({
      where: { id },
      select: { 
        id: true, 
        companyName: true, 
        shortName: true,
        contactPerson: true,
        contactNo: true,
        addressLine1: true,
        addressLine2: true,
        pinCode: true,
        logoUrl: true,
        closed: true,
        panNo: true,
        gstNo: true,
        tanNo: true,
        cinNo: true,
        createdAt: true,
        updatedAt: true,
        stateId: true,
        cityId: true,
        state: {
          select: {
            id: true,
            state: true
          }
        },
        city: {
          select: {
            id: true,
            city: true
          }
        }
      }
    });

    if (!company) return NotFound('Company not found');
    return Success(company);
  } catch (error) {
    console.error("Get company error:", error);
    return Error("Failed to fetch company");
  }
}

// PATCH /api/companies/[id] - Update company
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt(params.id);
    if (isNaN(id)) return BadRequest("Invalid company ID");

    const contentType = req.headers.get('content-type') || '';
    let companyData: Record<string, unknown>;
    let logoFile: File | null = null;

    // Handle multipart form data for file uploads
    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      logoFile = form.get('logo') as File;
      
      // Extract other form data
      companyData = {
        companyName: form.get('companyName') || undefined,
        shortName: form.get('shortName') || null,
        contactPerson: form.get('contactPerson') || null,
        contactNo: form.get('contactNo') || null,
        addressLine1: form.get('addressLine1') || null,
        addressLine2: form.get('addressLine2') || null,
        stateId: form.get('stateId') ? Number(form.get('stateId')) : null,
        cityId: form.get('cityId') ? Number(form.get('cityId')) : null,
        pinCode: form.get('pinCode') || null,
        closed: form.get('closed') === 'true',
        panNo: form.get('panNo') || null,
        gstNo: form.get('gstNo') || null,
        tanNo: form.get('tanNo') || null,
        cinNo: form.get('cinNo') || null,
      };
      
      // Remove undefined values for partial updates
      Object.keys(companyData).forEach(key => {
        if (companyData[key] === undefined) {
          delete companyData[key];
        }
      });
    } else {
      // Handle JSON data
      companyData = await req.json();
    }

    // Handle logo upload if present
    if (logoFile && logoFile.size > 0) {
      // Validate file type and size
      if (!logoFile.type?.startsWith('image/')) {
        return Error('Logo must be an image file', 415);
      }
      if (logoFile.size > 20 * 1024 * 1024) {
        return Error('Logo file too large (max 20MB)', 413);
      }
      
      // Get current company to potentially delete old logo
      const currentCompany = await prisma.company.findUnique({
        where: { id },
        select: { logoUrl: true }
      });
      
      // Generate unique filename and save
      const ext = path.extname(logoFile.name) || '.png';
      const filename = `${Date.now()}-${crypto.randomUUID()}${ext}`;
      const dir = path.join(process.cwd(), 'public', 'uploads', 'companies');
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, filename), Buffer.from(await logoFile.arrayBuffer()));
      companyData.logoUrl = `/uploads/companies/${filename}`;
      
      // Delete old logo file if it exists
      if (currentCompany?.logoUrl && currentCompany.logoUrl.startsWith('/uploads/companies/')) {
        const oldPath = path.join(process.cwd(), 'public', currentCompany.logoUrl);
        try {
          await fs.unlink(oldPath);
        } catch (error) {
          console.warn("Could not delete old logo file:", error);
        }
      }
    }

    const updateData = updateSchema.parse(companyData);

    if (Object.keys(updateData).length === 0) {
      return BadRequest("No valid fields to update");
    }

    const updated = await prisma.company.update({
      where: { id },
      data: updateData,
      select: { 
        id: true, 
        companyName: true, 
        shortName: true,
        contactPerson: true,
        contactNo: true,
        addressLine1: true,
        addressLine2: true,
        pinCode: true,
        logoUrl: true,
        closed: true,
        panNo: true,
        gstNo: true,
        tanNo: true,
        cinNo: true,
        createdAt: true,
        updatedAt: true,
        stateId: true,
        cityId: true,
        state: {
          select: {
            id: true,
            state: true
          }
        },
        city: {
          select: {
            id: true,
            city: true
          }
        }
      }
    });

    return Success(updated);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    if (error && typeof error === 'object' && 'code' in error) {
      if (error.code === 'P2025') return NotFound('Company not found');
      if (error.code === 'P2002') {
        return Error('Company with this name already exists', 409);
      }
    }
    console.error("Update company error:", error);
    return Error("Failed to update company");
  }
}

// DELETE /api/companies/[id] - Delete company
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const id = parseInt(params.id);
    if (isNaN(id)) return BadRequest("Invalid company ID");

    // Get company to potentially delete logo file
    const company = await prisma.company.findUnique({
      where: { id },
      select: { logoUrl: true }
    });

    if (!company) return NotFound('Company not found');

    await prisma.company.delete({
      where: { id }
    });

    // Delete logo file if it exists
    if (company.logoUrl && company.logoUrl.startsWith('/uploads/companies/')) {
      const logoPath = path.join(process.cwd(), 'public', company.logoUrl);
      try {
        await fs.unlink(logoPath);
      } catch (error) {
        console.warn("Could not delete logo file:", error);
      }
    }

    return Success({ message: "Company deleted successfully" });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') return NotFound('Company not found');
    console.error("Delete company error:", error);
    return Error("Failed to delete company");
  }
}
