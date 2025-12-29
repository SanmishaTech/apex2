import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/jwt";

// Auth middleware with public path exclusions to avoid redirect loops
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // PUBLIC (unauthenticated) paths
  const isStaticAsset =
    /\.(?:js|css|png|jpg|jpeg|gif|svg|ico|webp|woff2?|ttf)$/i.test(pathname);
  const publicPaths = [
    "/login",
    "/api/auth/login", // login endpoint
  ];
  const isPublic =
    isStaticAsset ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/public") ||
    publicPaths.includes(pathname);

  const accessToken = req.cookies.get("accessToken")?.value;

  // If public path, skip auth entirely
  if (isPublic) {
    // Optional: if already authenticated and hitting /login, redirect to dashboard
    if (pathname === "/login" && accessToken) {
      try {
        await verifyAccessToken(accessToken);
        return NextResponse.redirect(new URL("/dashboard", req.url));
      } catch {
        /* ignore invalid token; fall through */
      }
    }
    return NextResponse.next();
  }

  if (!accessToken) {
    return pathname.startsWith("/api/")
      ? NextResponse.json({ message: "Unauthorized" }, { status: 401 })
      : NextResponse.redirect(new URL("/login", req.url));
  }

  try {
    await verifyAccessToken(accessToken);
    return NextResponse.next();
  } catch {
    return pathname.startsWith("/api/")
      ? NextResponse.json({ message: "Unauthorized" }, { status: 401 })
      : NextResponse.redirect(new URL("/login", req.url));
  }
}

// Configure which paths the middleware should run on
export const config = {
  // Match everything and rely on early returns to skip internals/static
  matcher: ["/:path*"],
};
