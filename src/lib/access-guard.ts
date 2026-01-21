// Server-side API access guards: authenticate via access token cookie and assert required permissions.
// guardApiAccess() applies prefix + method rule matching (API_ACCESS_RULES) then defers to guardApiPermissions.
import { NextRequest } from "next/server";
import { verifyAccessToken } from "@/lib/jwt";
import { prisma } from "@/lib/prisma";
import { Unauthorized, Error as ApiError, Forbidden } from "@/lib/api-response";
import { API_ACCESS_RULES, Permission } from "@/config/access-control";

// Return shape reused by both guard functions
export type GuardSuccess = {
  ok: true;
  user: { id: number; role: string | null; permissions: string[] };
};
export type GuardFailure = { ok: false; response: Response };
export type GuardResult = GuardSuccess | GuardFailure;

async function resolveUserAccess(userId: number): Promise<{
  role: string | null;
  permissions: string[];
}> {
  // userRoles is modeled as an array on User; DB constraint should keep it to max 1.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      userRoles: {
        select: {
          role: {
            select: {
              name: true,
              permissions: {
                select: {
                  permission: { select: { permissionName: true } },
                },
              },
            },
          },
        },
      },
      userPermissions: {
        select: {
          permission: { select: { permissionName: true } },
        },
      },
    },
  });

  if (!user) return { role: null, permissions: [] };

  const roleName = user.userRoles?.[0]?.role?.name ?? null;
  const rolePerms =
    user.userRoles?.[0]?.role?.permissions
      ?.map((rp) => rp.permission.permissionName)
      .filter(Boolean) ?? [];
  const userPerms =
    user.userPermissions
      ?.map((up) => up.permission.permissionName)
      .filter(Boolean) ?? [];

  const effective = Array.from(new Set([...rolePerms, ...userPerms]));
  return { role: roleName, permissions: effective };
}

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

  const numericUserId = Number(userId);
  const access = await resolveUserAccess(numericUserId);
  if (!access)
    return { ok: false, response: ApiError("Current user not found", 404) };

  if (required.length) {
    const permSet = new Set(access.permissions);
    const missing = required.filter((p) => !permSet.has(p));
    if (missing.length) return { ok: false, response: Forbidden() };
  }

  return {
    ok: true,
    user: { id: numericUserId, role: access.role, permissions: access.permissions },
  };
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
