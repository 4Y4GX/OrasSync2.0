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
  const isAnalystArea = pathname.startsWith("/analyst");
  const isSupervisorArea = pathname.startsWith("/supervisor");
  const isManagerArea = pathname.startsWith("/manager");
  const isAdminArea = pathname.startsWith("/admin");
  const isLoginArea = pathname === "/login" || pathname === "/";

  if (!isEmployeeArea && !isAnalystArea && !isSupervisorArea && !isManagerArea && !isAdminArea && !isLoginArea) return NextResponse.next();

  const token = req.cookies.get("timea_session")?.value;
  if (!token) {
    if (isLoginArea) return NextResponse.next();

    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  try {
    const payload = await verifySession(token);
    const roleId = Number(payload?.role_id ?? 0);

    // Helper to get the correct dashboard for a given role
    const getDashboardForRole = (role: number) => {
      switch (role) {
        case ROLE_EMPLOYEE: return "/employee/dashboard";
        case ROLE_ANALYST: return "/analyst/dashboard";
        case ROLE_ADMIN: return "/admin/dashboard";
        case ROLE_SUPERVISOR: return "/supervisor/dashboard";
        case ROLE_MANAGER: return "/manager/dashboard";
        default: return "/login";
      }
    };

    if (isLoginArea) {
      const url = req.nextUrl.clone();
      url.pathname = getDashboardForRole(roleId);
      return NextResponse.redirect(url);
    }

    if (isAdminArea && roleId !== ROLE_ADMIN) {
      const url = req.nextUrl.clone();
      url.pathname = getDashboardForRole(roleId);
      return NextResponse.redirect(url);
    }

    if (isAnalystArea && roleId !== ROLE_ANALYST) {
      const url = req.nextUrl.clone();
      url.pathname = getDashboardForRole(roleId);
      return NextResponse.redirect(url);
    }

    // Allow Supervisors (4) and Managers (5) to access Employee areas (like sentiment)
    if (isEmployeeArea && roleId !== ROLE_EMPLOYEE && roleId !== ROLE_SUPERVISOR && roleId !== ROLE_MANAGER) {
      const url = req.nextUrl.clone();
      url.pathname = getDashboardForRole(roleId);
      return NextResponse.redirect(url);
    }

    if (isSupervisorArea && roleId !== ROLE_SUPERVISOR) {
      const url = req.nextUrl.clone();
      url.pathname = getDashboardForRole(roleId);
      return NextResponse.redirect(url);
    }

    if (isManagerArea && roleId !== ROLE_MANAGER) {
      const url = req.nextUrl.clone();
      url.pathname = getDashboardForRole(roleId);
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
  } catch {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    const res = isLoginArea ? NextResponse.next() : NextResponse.redirect(url);
    res.cookies.delete("timea_session");
    return res;
  }
}

export const config = {
  matcher: ["/employee/:path*", "/analyst/:path*", "/admin/:path*", "/supervisor/:path*", "/manager/:path*", "/login", "/"],
};
