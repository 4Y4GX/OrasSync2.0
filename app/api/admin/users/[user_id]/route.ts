// app/api/admin/users/[user_id]/route.ts
import { NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ user_id: string }> }
) {
  try {
    const user = await getUserFromCookie();
    if (!user || user.role_id !== 4) {
      return NextResponse.json({ message: "Unauthorized. Admin access required." }, { status: 403 });
    }

    const { user_id } = await params;

    const targetUser = await prisma.d_tbluser.findUnique({
      where: { user_id },
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
            email: true,
          },
        },
        D_tbluser_D_tbluser_manager_idToD_tbluser: {
          select: {
            user_id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
        D_tbluser_stats: true,
        D_tbluser_authentication: {
          select: {
            is_first_login: true,
            failed_attempts: true,
            is_disabled: true,
          },
        },
      },
    });

    if (!targetUser) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user: targetUser });
  } catch (error) {
    console.error("Get user error:", error);
    return NextResponse.json({ message: "Failed to fetch user" }, { status: 500 });
  }
}
