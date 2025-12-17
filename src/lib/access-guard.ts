// Server-side API access guards: authenticate via access token cookie and assert required permissions.
// guardApiAccess() applies prefix + method rule matching (API_ACCESS_RULES) then defers to guardApiPermissions.
import { NextRequest } from "next/server";
import { verifyAccessToken } from "@/lib/jwt";
import { prisma } from "@/lib/prisma";
import { Unauthorized, Error as ApiError, Forbidden } from "@/lib/api-response";
import { ROLES_PERMISSIONS, ROLES } from "@/config/roles";
import { API_ACCESS_RULES, Permission } from "@/config/access-control";

// Return shape reused by both guard functions
export type GuardSuccess = { ok: true; user: { id: number; role: string } };
export type GuardFailure = { ok: false; response: Response };
export type GuardResult = GuardSuccess | GuardFailure;

// Low-level permission guard (ALL required must be present)
export async function guardApiPermissions(
  req: NextRequest,
  required: Permission[]
): Promise<GuardResult> {
  const accessToken = req.cookies.get("accessToken")?.value;
  if (!accessToken)
    return { ok: false, response: Unauthorized("No access token provided") };

  let userId: string | undefined;
  try {
    const decoded = await verifyAccessToken<{ sub: string }>(accessToken);
    userId = decoded.sub;
  } catch {
    return { ok: false, response: Unauthorized("Invalid access token") };
  }

  const user = await prisma.user.findUnique({
    where: { id: Number(userId) },
    select: { id: true, role: true },
  });
  if (!user)
    return { ok: false, response: ApiError("Current user not found", 404) };

  // Resolve role robustly: accept code (e.g., SITE_INCHARGE) or label (e.g., "Site Incharge"),
  // and tolerate case/space/underscore differences.
  const roleInput = (user.role as string) || "";
  function resolveRoleLabel(input: string): string {
    if (!input) return input;
    // Exact code -> label
    const direct = (ROLES as any)[input];
    if (direct) return direct;
    // Normalize input variants
    const norm = input.trim();
    const normUpper = norm.toUpperCase().replace(/\s+/g, "_");
    const fromUpper = (ROLES as any)[normUpper];
    if (fromUpper) return fromUpper;
    // Try match against labels case-insensitively
    const labels: string[] = Object.values(ROLES as any);
    const match = labels.find(
      (lbl) => lbl.toLowerCase() === norm.toLowerCase()
    );
    if (match) return match;
    return input; // fallback
  }
  const roleLabel = resolveRoleLabel(roleInput);
  const perms = (ROLES_PERMISSIONS as any)[roleLabel] || [];
  if (required.length) {
    const missing = required.filter((p) => !(perms as string[]).includes(p));
    if (missing.length) return { ok: false, response: Forbidden() };
  }
  return { ok: true, user: { id: user.id, role: roleLabel } };
}

// Method + path aware guard reading API_ACCESS_RULES
export async function guardApiAccess(req: NextRequest): Promise<GuardResult> {
  const { pathname } = new URL(req.url);
  const method = req.method.toUpperCase();
  const rule = API_ACCESS_RULES.find((r) => pathname.startsWith(r.prefix));
  if (!rule) return guardApiPermissions(req, []); // auth only
  const required = rule.methods?.[method] || rule.permissions || [];
  return guardApiPermissions(req, required);
}
