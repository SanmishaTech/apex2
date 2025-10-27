import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error } from "@/lib/api-response";
import { paginate } from "@/lib/paginate";
import { guardApiAccess } from "@/lib/access-guard";

// GET /api/cashbook-budgets?search=&page=1&perPage=10&sort=name&order=desc&month=&siteId=&boqId=
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const perPage = Math.min(100, Math.max(1, Number(searchParams.get("perPage")) || 10));
  const search = searchParams.get("search")?.trim() || "";
  const month = searchParams.get("month")?.trim() || "";
  const siteIdParam = searchParams.get("siteId");
  const boqIdParam = searchParams.get("boqId");
  const sort = (searchParams.get("sort") || "name") as string;
  const order = (searchParams.get("order") === "asc" ? "asc" : "desc") as "asc" | "desc";

  // Build dynamic filter with explicit shape
  type CashbookBudgetWhere = {
    siteId?: number;
    month?: string;
    boqId?: number;
    OR?: Array<{
      name?: { contains: string };
    }>;
  };
  const where: CashbookBudgetWhere = {};
  
  // Role-based site filtering (if not admin role 1, filter by user's site)
  // TODO: Implement session-based site filtering based on user role
  if (siteIdParam) {
    where.siteId = Number(siteIdParam);
  }
  
  if (month) {
    where.month = month;
  }
  
  if (boqIdParam) {
    where.boqId = Number(boqIdParam);
  }
  
  if (search) {
    where.OR = [
      { name: { contains: search } },
    ];
  }

  // Allow listed sortable fields only
  const sortableFields = new Set(["name", "totalBudget", "createdAt"]);
  const orderBy: Record<string, "asc" | "desc"> = sortableFields.has(sort) ? { [sort]: order } : { name: "asc" };

  const result = await paginate({
    model: prisma.cashbookBudget as any,
    where,
    orderBy,
    page,
    perPage,
    select: {
      id: true,
      name: true,
      month: true,
      totalBudget: true,
      siteId: true,
      boqId: true,
      attachCopyUrl: true,
      approved1Remarks: true,
      remarksForFinalApproval: true,
      approvedBy: true,
      approvedDatetime: true,
      approvedBudgetAmount: true,
      approved1By: true,
      approved1Datetime: true,
      approved1BudgetAmount: true,
      acceptedBy: true,
      acceptedDatetime: true,
      createdAt: true,
      updatedAt: true,
      site: {
        select: { id: true, site: true }
      },
      boq: {
        select: { id: true, boqNo: true }
      },
      _count: {
        select: { budgetItems: true }
      }
    },
  });
  return Success(result);
}

// POST /api/cashbook-budgets  (create cashbook budget with items)
export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  let body: unknown;
  try { body = await req.json(); } catch { return Error('Invalid JSON body', 400); }
  const { name, month, siteId, boqId, attachCopyUrl, approved1Remarks, remarksForFinalApproval, budgetItems } = (body as Partial<{
    name: string;
    month: string;
    siteId: number | string;
    boqId: number | string | null;
    attachCopyUrl: string;
    approved1Remarks: string;
    remarksForFinalApproval: string;
    budgetItems: Array<{ cashbookHeadId: number | string; description: string; amount: string; }>;
  }>) || {};

  if (!name?.trim()) return Error('Budget name is required', 400);
  if (!month?.trim()) return Error('Month is required', 400);
  if (!siteId) return Error('Site is required', 400);
  if (!budgetItems || !Array.isArray(budgetItems) || budgetItems.length === 0) {
    return Error('At least one budget item is required', 400);
  }

  // Validate budget items
  for (const item of budgetItems) {
    if (!item.cashbookHeadId) return Error('Cashbook head is required for all items', 400);
    if (!item.amount || isNaN(Number(item.amount))) return Error('Valid amount is required for all items', 400);
  }

  // Check for duplicate (unique month + siteId + boqId)
  const existingBudget = await prisma.cashbookBudget.findFirst({
    where: {
      month: month.trim(),
      siteId: Number(siteId),
      boqId: boqId ? Number(boqId) : null,
    },
  });
  
  if (existingBudget) {
    return Error('Budget for this month, site, and BOQ combination already exists', 409);
  }
  
  // Calculate total budget from items
  const totalBudget = budgetItems.reduce((sum, item) => sum + Number(item.amount), 0);

  try {
    const created = await prisma.cashbookBudget.create({
      data: {
        name: name.trim(),
        month: month.trim(),
        siteId: Number(siteId),
        boqId: boqId ? Number(boqId) : null,
        attachCopyUrl: attachCopyUrl?.trim() || null,
        approved1Remarks: approved1Remarks?.trim() || null,
        remarksForFinalApproval: remarksForFinalApproval?.trim() || null,
        totalBudget: totalBudget,
        budgetItems: {
          create: budgetItems.map(item => ({
            cashbookHeadId: Number(item.cashbookHeadId),
            description: item.description?.trim() || null,
            amount: Number(item.amount),
          }))
        }
      },
      include: {
        budgetItems: {
          include: {
            cashbookHead: {
              select: { id: true, cashbookHeadName: true }
            }
          }
        },
        site: {
          select: { id: true, site: true }
        }
      }
    });
    return Success(created, 201);
  } catch (e: unknown) {
    console.error('Error creating cashbook budget:', e);
    return Error('Failed to create cashbook budget');
  }
}

// PATCH /api/cashbook-budgets  { id, name, month, siteId, boqName, attachCopyUrl, approved1Remarks, remarksForFinalApproval, budgetItems }
export async function PATCH(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  let body: unknown;
  try { body = await req.json(); } catch { return Error('Invalid JSON body', 400); }
  const { id, name, month, siteId, boqId, attachCopyUrl, approved1Remarks, remarksForFinalApproval, budgetItems } = (body as Partial<{
    id: number | string;
    name: string;
    month: string;
    siteId: number | string;
    boqId: number | string | null;
    attachCopyUrl: string;
    approved1Remarks: string;
    remarksForFinalApproval: string;
    budgetItems: Array<{ id?: number; cashbookHeadId: number | string; description: string; amount: string; }>;
  }>) || {};

  if (!id) return Error('Budget id required', 400);
  if (!name?.trim()) return Error('Budget name is required', 400);
  if (!month?.trim()) return Error('Month is required', 400);
  if (!siteId) return Error('Site is required', 400);
  if (!budgetItems || !Array.isArray(budgetItems) || budgetItems.length === 0) {
    return Error('At least one budget item is required', 400);
  }

  // Validate budget items
  for (const item of budgetItems) {
    if (!item.cashbookHeadId) return Error('Cashbook head is required for all items', 400);
    if (!item.amount || isNaN(Number(item.amount))) return Error('Valid amount is required for all items', 400);
  }

  // Check for duplicate (unique month + siteId + boqId), excluding current budget
  const existingBudget = await prisma.cashbookBudget.findFirst({
    where: {
      id: { not: Number(id) },
      month: month.trim(),
      siteId: Number(siteId),
      boqId: boqId ? Number(boqId) : null,
    },
  });
  
  if (existingBudget) {
    return Error('Budget for this month, site, and BOQ combination already exists', 409);
  }
  
  // Calculate total budget from items
  const totalBudget = budgetItems.reduce((sum, item) => sum + Number(item.amount), 0);

  try {
    const updated = await prisma.cashbookBudget.update({
      where: { id: Number(id) },
      data: {
        name: name.trim(),
        month: month.trim(),
        siteId: Number(siteId),
        boqId: boqId ? Number(boqId) : null,
        attachCopyUrl: attachCopyUrl?.trim() || null,
        approved1Remarks: approved1Remarks?.trim() || null,
        remarksForFinalApproval: remarksForFinalApproval?.trim() || null,
        totalBudget: totalBudget,
        budgetItems: {
          deleteMany: {},
          create: budgetItems.map(item => ({
            cashbookHeadId: Number(item.cashbookHeadId),
            description: item.description?.trim() || null,
            amount: Number(item.amount),
          }))
        }
      },
      include: {
        budgetItems: {
          include: {
            cashbookHead: {
              select: { id: true, cashbookHeadName: true }
            }
          }
        },
        site: {
          select: { id: true, site: true }
        }
      }
    });
    return Success(updated);
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err?.code === 'P2025') return Error('Cashbook budget not found', 404);
    console.error('Error updating cashbook budget:', e);
    return Error('Failed to update cashbook budget');
  }
}