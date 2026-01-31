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
  siteCode: z.string().min(1, "Site Code is required"),
  site: z.string().min(1, "Site name is required").optional(),
  shortName: z.string().optional().nullable(),
  companyId: z.number().optional().nullable(),
  zoneId: z.preprocess(
    (v) => (v === null || v === undefined || v === "" ? undefined : Number(v)),
    z
      .number({ required_error: "Zone is required" })
      .refine((v) => typeof v === "number" && !Number.isNaN(v), {
        message: "Zone is required",
      })
  ),
  status: z
    .enum(["ONGOING", "HOLD", "CLOSED", "COMPLETED", "MOBILIZATION_STAGE"]) 
    .optional(),
  attachCopyUrl: z.string().optional().nullable(),
  // legacy top-level contactPerson/contactNo removed (we use siteContactPersons array)
  deliveryAddresses: z
    .array(
      z.object({
        id: z.number().optional(),
        addressLine1: z.string().optional().nullable(),
        addressLine2: z.string().optional().nullable(),
        stateId: z.number().optional().nullable(),
        cityId: z.number().optional().nullable(),
        pinCode: z.string().optional().nullable(),
      })
    )
    .optional(),
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
  startDate: z
    .union([z.string(), z.date()])
    .optional()
    .nullable()
    .transform((v) => (v ? new Date(v as any) : null)),
  endDate: z
    .union([z.string(), z.date()])
    .optional()
    .nullable()
    .transform((v) => (v ? new Date(v as any) : null)),
  extension1EndDate: z
    .union([z.string(), z.date()])
    .optional()
    .nullable()
    .transform((v) => (v ? new Date(v as any) : null)),
  extension2EndDate: z
    .union([z.string(), z.date()])
    .optional()
    .nullable()
    .transform((v) => (v ? new Date(v as any) : null)),
  completionPeriodInMonths: z
    .preprocess((v) => (v === "" || v === null || typeof v === "undefined" ? null : Number(v)), z.number().optional().nullable())
    .optional()
    .nullable(),
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
        zoneId: true,
        status: true,
        attachCopyUrl: true,
        startDate: true,
        endDate: true,
        completionPeriodInMonths: true,
        extension1EndDate: true,
        extension2EndDate: true,
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
        zone: {
          select: {
            id: true,
            zoneName: true,
          },
        },
        siteContactPersons: true,
        siteDeliveryAddresses: true,
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
    let contactPersonsPayload:
      | Array<{
          id?: number;
          name: string;
          contactNo: string;
          email?: string | null;
        }>
      | undefined;
    let deliveryAddressesPayload: any[] | undefined;

    // Handle multipart form data for file uploads
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      attachCopyFile = form.get("attachCopy") as File;

      // Extract other form data
      siteData = {
        siteCode: String(form.get("siteCode") ?? ""),
        site: form.get("site") || undefined,
        shortName: form.get("shortName") || undefined,
        companyId: form.get("companyId")
          ? Number(form.get("companyId"))
          : undefined,
        zoneId: (() => {
          const raw = form.get("zoneId");
          if (raw === null) return undefined;
          const v = String(raw).trim();
          if (v === "") return null;
          const n = Number(v);
          return Number.isNaN(n) ? undefined : n;
        })(),
        status: form.get("status") || undefined,
        // legacy top-level contactPerson/contactNo omitted
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
        startDate: form.get("startDate") || undefined,
        endDate: form.get("endDate") || undefined,
        extension1EndDate: form.get("extension1EndDate") || undefined,
        extension2EndDate: form.get("extension2EndDate") || undefined,
        completionPeriodInMonths: form.get("completionPeriodInMonths") || undefined,
      };

      const contactPersonsRaw = form.get("contactPersons") as string | null;
      const deliveryAddressesRaw = form.get("deliveryAddresses") as
        | string
        | null;
      if (contactPersonsRaw) {
        contactPersonsPayload = JSON.parse(contactPersonsRaw.toString());
      }
      if (deliveryAddressesRaw) {
        deliveryAddressesPayload = JSON.parse(deliveryAddressesRaw.toString());
      }

      siteData = Object.fromEntries(
        Object.entries(siteData).filter(([_, value]) => value !== undefined)
      );
    } else {
      // Handle JSON data
      siteData = await req.json();
      if (Array.isArray(siteData?.contactPersons)) {
        contactPersonsPayload = siteData.contactPersons;
      }
      if (Array.isArray(siteData?.deliveryAddresses)) {
        // deliveryAddresses in JSON payload - handle similar to contactPersons
        deliveryAddressesPayload = siteData.deliveryAddresses;
      }
      if ("contactPersons" in siteData) delete siteData.contactPersons;
      if ("deliveryAddresses" in siteData) delete siteData.deliveryAddresses;
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

    // Custom uniqueness validation for site name
    if (validatedData.site) {
      const existingSite = await prisma.site.findFirst({
        where: {
          site: validatedData.site,
          id: { not: id }, // Exclude current site
        },
        select: { id: true },
      });
      if (existingSite) {
        return BadRequest([
          {
            code: "custom",
            path: ["site"],
            message: "Site name already exists",
          },
        ]);
      }
    }

    const contactPersonsSchema = z.array(
      z.object({
        id: z.number().optional(),
        name: z.string().min(1),
        contactNo: z.string().min(1),
        email: z
          .union([z.string().email(), z.literal(""), z.null()])
          .optional(),
      })
    );

    const contactPersons = contactPersonsPayload
      ? contactPersonsSchema.parse(contactPersonsPayload)
      : undefined;

    // parse delivery addresses payload if present
    const deliveryAddressesSchema = z.array(
      z.object({
        id: z.number().optional(),
        addressLine1: z.string().optional().nullable(),
        addressLine2: z.string().optional().nullable(),
        stateId: z.number().optional().nullable(),
        cityId: z.number().optional().nullable(),
        pinCode: z.string().optional().nullable(),
      })
    );

    let deliveryAddresses: z.infer<typeof deliveryAddressesSchema> | undefined;
    if (typeof deliveryAddressesPayload !== "undefined") {
      deliveryAddresses = deliveryAddressesSchema.parse(
        deliveryAddressesPayload || []
      );
    }

    const siteUpdateData = validatedData;

    const updated = await prisma.$transaction(async (tx) => {
      await tx.site.update({
        where: { id },
        data: siteUpdateData,
        select: {
          id: true,
          siteCode: true,
          site: true,
          shortName: true,
          companyId: true,
          zoneId: true,
          status: true,
          attachCopyUrl: true,
          startDate: true,
          endDate: true,
          completionPeriodInMonths: true,
          extension1EndDate: true,
          extension2EndDate: true,
          // legacy top-level contact fields omitted
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
          zone: {
            select: {
              id: true,
              zoneName: true,
            },
          },
          siteDeliveryAddresses: true,
        },
      });

      if (!contactPersons) {
        await tx.siteContactPerson.deleteMany({ where: { siteId: id } });
      } else {
        const existing = await tx.siteContactPerson.findMany({
          where: { siteId: id },
          select: { id: true },
        });

        const incomingIds = contactPersons
          .map((person) => {
            if (typeof person.id === "string") return Number(person.id);
            return person.id;
          })
          .filter(
            (pid): pid is number =>
              typeof pid === "number" && !Number.isNaN(pid)
          );

        const toDelete = existing
          .map((p) => p.id)
          .filter((existingId) => !incomingIds.includes(existingId));

        // 1) Update existing and create new ones from incoming list
        for (const person of contactPersons) {
          if (person.id) {
            // Update by id and siteId; if not found, create new
            const updateResult = await tx.siteContactPerson.updateMany({
              where: { id: person.id, siteId: id },
              data: {
                name: person.name,
                contactNo: person.contactNo,
                email: person.email || null,
              },
            });
            if (updateResult.count === 0) {
              await tx.siteContactPerson.create({
                data: {
                  siteId: id,
                  name: person.name,
                  contactNo: person.contactNo,
                  email: person.email || null,
                },
              });
            }
          } else {
            await tx.siteContactPerson.create({
              data: {
                siteId: id,
                name: person.name,
                contactNo: person.contactNo,
                email: person.email || null,
              },
            });
          }
        }

        // 2) Delete any removed contacts
        if (toDelete.length) {
          await tx.siteContactPerson.deleteMany({
            where: { id: { in: toDelete } },
          });
        }
      }
      // Handle delivery addresses
      if (typeof deliveryAddresses === "undefined") {
        // If not provided, remove all existing delivery addresses
        await tx.siteDeliveryAddress.deleteMany({ where: { siteId: id } });
      } else {
        const existingAddrs = await tx.siteDeliveryAddress.findMany({
          where: { siteId: id },
          select: { id: true },
        });
        const incomingIds = deliveryAddresses
          .map((d) => {
            if (typeof d.id === "string") return Number(d.id);
            return d.id;
          })
          .filter(
            (v): v is number => typeof v === "number" && !Number.isNaN(v)
          );
        const toDelete = existingAddrs
          .map((e) => e.id)
          .filter((eid) => !incomingIds.includes(eid));

        // 1) Update existing and create new ones from incoming list
        for (const addr of deliveryAddresses) {
          if (addr.id) {
            const updateResult = await tx.siteDeliveryAddress.updateMany({
              where: { id: addr.id, siteId: id },
              data: {
                addressLine1: addr.addressLine1 || null,
                addressLine2: addr.addressLine2 || null,
                stateId: addr.stateId ?? null,
                cityId: addr.cityId ?? null,
                pinCode: addr.pinCode || null,
              },
            });
            if (updateResult.count === 0) {
              await tx.siteDeliveryAddress.create({
                data: {
                  siteId: id,
                  addressLine1: addr.addressLine1 || null,
                  addressLine2: addr.addressLine2 || null,
                  stateId: addr.stateId ?? null,
                  cityId: addr.cityId ?? null,
                  pinCode: addr.pinCode || null,
                },
              });
            }
          } else {
            await tx.siteDeliveryAddress.create({
              data: {
                siteId: id,
                addressLine1: addr.addressLine1 || null,
                addressLine2: addr.addressLine2 || null,
                stateId: addr.stateId ?? null,
                cityId: addr.cityId ?? null,
                pinCode: addr.pinCode || null,
              },
            });
          }
        }

        // 2) Delete any addresses not present in incoming list
        if (toDelete.length) {
          await tx.siteDeliveryAddress.deleteMany({
            where: { id: { in: toDelete } },
          });
        }
      }

      return tx.site.findUniqueOrThrow({
        where: { id },
        select: {
          id: true,
          siteCode: true,
          site: true,
          shortName: true,
          companyId: true,
          status: true,
          attachCopyUrl: true,
          startDate: true,
          endDate: true,
          completionPeriodInMonths: true,
          extension1EndDate: true,
          extension2EndDate: true,
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
          siteContactPersons: true,
          siteDeliveryAddresses: true,
        },
      });
    });

    return Success(updated);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    if (error.code === "P2025") return NotFound("Site not found");
    if (error.code === "P2002") {
      const target = (error?.meta as any)?.target;
      if (Array.isArray(target) && target.includes("siteCode")) {
        return BadRequest([
          {
            code: "custom",
            path: ["siteCode"],
            message: "Site Code already exists",
          },
        ]);
      }
      if (Array.isArray(target) && target.includes("site")) {
        return BadRequest([
          {
            code: "custom",
            path: ["site"],
            message: "Site name already exists",
          },
        ]);
      }
      return BadRequest("Unique constraint violation");
    }
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
