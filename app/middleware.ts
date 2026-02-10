import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

// Role IDs based on your database roles table
const ROLE_EMPLOYEE = 1;
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

  // Identify which area the user is trying to access
  const isEmployeeArea = pathname.startsWith("/employee");
  const isAdminArea = pathname.startsWith("/admin");
  const isManagerArea = pathname.startsWith("/manager");
  const isSupervisorArea = pathname.startsWith("/supervisor");

  // If the path doesn't start with any protected prefix, let the request through
  if (!isEmployeeArea && !isAdminArea && !isManagerArea && !isSupervisorArea) {
    return NextResponse.next();
  }

  // Check for the session cookie
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

    // 1. Admin Area Protection
    if (isAdminArea && roleId !== ROLE_ADMIN) {
      // Fallback: If they are a Manager/Supervisor, send to their respective dash, else Employee
      return redirectToCorrectDashboard(roleId, req);
    }

    // 2. Manager Area Protection
    if (isManagerArea && roleId !== ROLE_MANAGER) {
      return redirectToCorrectDashboard(roleId, req);
    }

    // 3. Supervisor Area Protection
    if (isSupervisorArea && roleId !== ROLE_SUPERVISOR) {
      return redirectToCorrectDashboard(roleId, req);
    }

    // 4. Employee Area Protection
    // Note: Usually, Admins/Managers/Supervisors are allowed to see Employee views, 
    // but if you want it strictly for Role 1, use: if (isEmployeeArea && roleId !== ROLE_EMPLOYEE)
    if (isEmployeeArea && roleId !== ROLE_EMPLOYEE) {
       // If an Admin/Manager/Supervisor tries to access /employee, redirect them to their own dashboard
       return redirectToCorrectDashboard(roleId, req);
    }

    return NextResponse.next();
  } catch (error) {
    console.error("Middleware Auth Error:", error);
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
}

/**
 * Helper to send users to their designated home base if they try to 
 * access a URL they aren't authorized for.
 */
function redirectToCorrectDashboard(roleId: number, req: NextRequest) {
  const url = req.nextUrl.clone();
  if (roleId === ROLE_ADMIN) url.pathname = "/admin/dashboard";
  else if (roleId === ROLE_MANAGER) url.pathname = "/manager/dashboard";
  else if (roleId === ROLE_SUPERVISOR) url.pathname = "/supervisor/dashboard";
  else url.pathname = "/employee/dashboard";
  
  return NextResponse.redirect(url);
}

// Ensure the middleware runs on all dashboard paths
export const config = {
  matcher: [
    "/employee/:path*", 
    "/admin/:path*", 
    "/manager/:path*", 
    "/supervisor/:path*"
  ],
};