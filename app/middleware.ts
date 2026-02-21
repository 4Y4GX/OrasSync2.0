import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const ROLE_EMPLOYEE = 1;
const ROLE_ANALYST = 2;
const ROLE_ADMIN = 3;
const ROLE_SUPERVISOR = 4;
const ROLE_MANAGER = 5;

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
  const isSupervisorArea = pathname.startsWith("/supervisor");
  const isManagerArea = pathname.startsWith("/manager");
  const isAdminArea = pathname.startsWith("/admin");
  const isAnalystArea = pathname.startsWith("/analyst");

  if (!isEmployeeArea && !isSupervisorArea && !isManagerArea && !isAdminArea && !isAnalystArea) return NextResponse.next();

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

    // Analyst area - only analysts and admins can access
    if (isAnalystArea && roleId !== ROLE_ANALYST && roleId !== ROLE_ADMIN) {
      const url = req.nextUrl.clone();
      if (roleId === ROLE_EMPLOYEE) url.pathname = "/employee/dashboard";
      else if (roleId === ROLE_SUPERVISOR) url.pathname = "/supervisor/dashboard";
      else if (roleId === ROLE_MANAGER) url.pathname = "/manager/dashboard";
      else url.pathname = "/login";
      return NextResponse.redirect(url);
    }

    // Allow Supervisors (4) and Managers (5) to access Employee areas (like sentiment)
    if (isEmployeeArea && roleId !== ROLE_EMPLOYEE && roleId !== ROLE_SUPERVISOR && roleId !== ROLE_MANAGER) {
      const url = req.nextUrl.clone();
      url.pathname = roleId === ROLE_ADMIN ? "/admin/dashboard" : roleId === ROLE_ANALYST ? "/analyst/dashboard" : "/login";
      return NextResponse.redirect(url);
    }

    if (isSupervisorArea && roleId !== ROLE_SUPERVISOR) {
      const url = req.nextUrl.clone();
      url.pathname = roleId === ROLE_ADMIN ? "/admin/dashboard" : "/login"; // Fallback
      if (roleId === ROLE_EMPLOYEE) url.pathname = "/employee/dashboard";
      if (roleId === ROLE_MANAGER) url.pathname = "/manager/dashboard";
      return NextResponse.redirect(url);
    }

    if (isManagerArea && roleId !== ROLE_MANAGER) {
      const url = req.nextUrl.clone();
      url.pathname = roleId === ROLE_ADMIN ? "/admin/dashboard" : "/login"; // Fallback
      if (roleId === ROLE_EMPLOYEE) url.pathname = "/employee/dashboard";
      if (roleId === ROLE_SUPERVISOR) url.pathname = "/supervisor/dashboard";
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
  matcher: ["/employee/:path*", "/admin/:path*", "/supervisor/:path*", "/manager/:path*", "/analyst/:path*"],
};
