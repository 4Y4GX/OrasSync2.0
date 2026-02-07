import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const ROLE_EMPLOYEE = 1;
const ROLE_ADMIN = 3;

async function verifySession(token: string) {
  const secretString = process.env.JWT_SECRET;
  if (!secretString) throw new Error("JWT_SECRET missing");
  const JWT_SECRET = new TextEncoder().encode(secretString);
  const { payload } = await jwtVerify(token, JWT_SECRET);
  return payload;
}

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  const isEmployeeArea = pathname.startsWith("/employee");
  const isAdminArea = pathname.startsWith("/admin");

  if (!isEmployeeArea && !isAdminArea) return NextResponse.next();

  const token = req.cookies.get("timea_session")?.value;
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  try {
    const payload = await verifySession(token);
    const roleId = Number(payload?.role_id ?? 0);

    if (isAdminArea && roleId !== ROLE_ADMIN) {
      const url = req.nextUrl.clone();
      url.pathname = "/employee/dashboard";
      return NextResponse.redirect(url);
    }

    if (isEmployeeArea && roleId !== ROLE_EMPLOYEE) {
      const url = req.nextUrl.clone();
      url.pathname = roleId === ROLE_ADMIN ? "/admin/dashboard" : "/login";
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
  } catch {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
}

export const config = {
  matcher: ["/employee/:path*", "/admin/:path*"],
};
