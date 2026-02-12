// app/api/admin/users/list/route.ts
import { NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    // 1. Authentication Check
    const user = await getUserFromCookie();
    
    // CHANGED: Checks for role_id 3 (Admin)
    if (!user || user.role_id !== 3) {
      console.error("Access Denied: User is not admin or not logged in", user);
      return NextResponse.json({ message: "Unauthorized. Admin access required." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const search = searchParams.get("search") || "";
    const roleFilter = searchParams.get("role") || "";
    const statusFilter = searchParams.get("status") || "";

    const skip = (page - 1) * limit;

    // 2. Build Search Query
    const where: any = {};

    if (search) {
      where.OR = [
        { user_id: { contains: search } },
        { first_name: { contains: search } },
        { last_name: { contains: search } },
        { email: { contains: search } },
      ];
    }

    if (roleFilter) {
      where.role_id = parseInt(roleFilter);
    }

    if (statusFilter) {
      where.account_status = statusFilter;
    }

    // 3. Execute Query with ALL required relations
    const total = await prisma.d_tbluser.count({ where });

    const users = await prisma.d_tbluser.findMany({
      where,
      include: {
        D_tblrole: true,
        D_tblposition: true,
        D_tbldepartment: true,
        D_tblteam: true, // Added Team relation
        // Fetch Supervisor Name
        D_tbluser_D_tbluser_supervisor_idToD_tbluser: {
          select: {
            user_id: true,
            first_name: true,
            last_name: true,
          },
        },
        // Fetch Manager Name
        D_tbluser_D_tbluser_manager_idToD_tbluser: {
          select: {
            user_id: true,
            first_name: true,
            last_name: true,
          },
        },
      },
      orderBy: { account_created_at: "desc" },
      skip,
      take: limit,
    });

    return NextResponse.json({
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    // This logs the ACTUAL error to your terminal/command prompt
    console.error("CRITICAL ERROR in /api/admin/users/list:", error);
    return NextResponse.json({ message: "Failed to fetch users. Check server logs." }, { status: 500 });
  }
}