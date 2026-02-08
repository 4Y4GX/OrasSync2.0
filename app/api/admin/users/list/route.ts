// app/api/admin/users/list/route.ts
import { NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await getUserFromCookie();
    if (!user || user.role_id !== 4) {
      return NextResponse.json({ message: "Unauthorized. Admin access required." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const search = searchParams.get("search") || "";
    const roleFilter = searchParams.get("role") || "";
    const statusFilter = searchParams.get("status") || "";

    const skip = (page - 1) * limit;

    // Build where clause
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

    // Get total count
    const total = await prisma.d_tbluser.count({ where });

    // Get users with relations
    const users = await prisma.d_tbluser.findMany({
      where,
      include: {
        D_tblrole: true,
        D_tblposition: true,
        D_tbldepartment: true,
        D_tblteam: true,
        D_tbluser_D_tbluser_supervisor_idToD_tbluser: {
          select: {
            user_id: true,
            first_name: true,
            last_name: true,
          },
        },
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
    console.error("List users error:", error);
    return NextResponse.json({ message: "Failed to fetch users" }, { status: 500 });
  }
}
