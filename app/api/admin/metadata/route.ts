// app/api/admin/metadata/route.ts
import { NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getUserFromCookie();
    if (!user || user.role_id !== 4) {
      return NextResponse.json({ message: "Unauthorized. Admin access required." }, { status: 403 });
    }

    // Fetch all metadata needed for user management
    const [roles, departments, positions, teams, supervisors, managers] = await Promise.all([
      prisma.d_tblrole.findMany({
        orderBy: { role_id: "asc" },
      }),
      prisma.d_tbldepartment.findMany({
        orderBy: { dept_name: "asc" },
      }),
      prisma.d_tblposition.findMany({
        orderBy: { pos_name: "asc" },
      }),
      prisma.d_tblteam.findMany({
        include: {
          D_tbldepartment: true,
        },
        orderBy: { team_name: "asc" },
      }),
      prisma.d_tbluser.findMany({
        where: {
          role_id: { in: [2, 3, 4] }, // Supervisors, Managers, Admins
          account_status: "ACTIVE",
        },
        select: {
          user_id: true,
          first_name: true,
          last_name: true,
          role_id: true,
          D_tblrole: true,
        },
        orderBy: { first_name: "asc" },
      }),
      prisma.d_tbluser.findMany({
        where: {
          role_id: { in: [3, 4] }, // Managers, Admins
          account_status: "ACTIVE",
        },
        select: {
          user_id: true,
          first_name: true,
          last_name: true,
          role_id: true,
          D_tblrole: true,
        },
        orderBy: { first_name: "asc" },
      }),
    ]);

    return NextResponse.json({
      roles,
      departments,
      positions,
      teams,
      supervisors,
      managers,
    });
  } catch (error) {
    console.error("Get metadata error:", error);
    return NextResponse.json({ message: "Failed to fetch metadata" }, { status: 500 });
  }
}
