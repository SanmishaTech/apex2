import { NextResponse } from "next/server";
import { serialize } from "cookie";

export async function POST() {
  // In a real app, you might want to invalidate the refresh token in the database
  // For this example, we'll just clear the cookies.

  const accessTokenCookie = serialize("accessToken", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: -1, // Expire the cookie immediately
  });

  const refreshTokenCookie = serialize("refreshToken", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: -1, // Expire the cookie immediately
  });

  const response = NextResponse.json({ message: "Logout successful" });

  response.headers.append("Set-Cookie", accessTokenCookie);
  response.headers.append("Set-Cookie", refreshTokenCookie);

  return response;
}
