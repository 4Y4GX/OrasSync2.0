// app/api/supervisor/team/members/route.ts
import { NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getUserFromCookie();
    if (!user || (user.role_id !== 2 && user.role_id !== 3 && user.role_id !== 4)) {
      return NextResponse.json({ message: "Unauthorized. Supervisor access required." }, { status: 403 });
    }

    let teamMembers;

    if (user.role_id === 2) {
      // Supervisor: get their team members
      teamMembers = await prisma.d_tbluser.findMany({
        where: {
          supervisor_id: user.user_id,
          account_status: "ACTIVE",
        },
        select: {
          user_id: true,
          first_name: true,
          last_name: true,
          email: true,
          D_tbldepartment: {
            select: { dept_name: true },
          },
          D_tblteam: {
            select: { team_name: true },
          },
          D_tblposition: {
            select: { pos_name: true },
          },
        },
        orderBy: { first_name: "asc" },
      });
    } else {
      // Manager/Admin: get all employees
      teamMembers = await prisma.d_tbluser.findMany({
        where: {
          role_id: 1,
          account_status: "ACTIVE",
        },
        select: {
          user_id: true,
          first_name: true,
          last_name: true,
          email: true,
          D_tbldepartment: {
            select: { dept_name: true },
          },
          D_tblteam: {
            select: { team_name: true },
          },
          D_tblposition: {
            select: { pos_name: true },
          },
        },
        orderBy: { first_name: "asc" },
      });
    }

    return NextResponse.json({ teamMembers });
  } catch (error) {
    console.error("Get team members error:", error);
    return NextResponse.json({ message: "Failed to fetch team members" }, { status: 500 });
  }
}
