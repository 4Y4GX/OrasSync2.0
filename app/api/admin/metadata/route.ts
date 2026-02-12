// app/api/admin/metadata/route.ts
import { NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getUserFromCookie();
    if (!user || user.role_id !== 3) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }

    // SEQUENTIAL FETCHING (Prevents connection overload)
    const roles = await prisma.d_tblrole.findMany({ orderBy: { role_id: "asc" } });
    const departments = await prisma.d_tbldepartment.findMany({ orderBy: { dept_name: "asc" } });
    const positions = await prisma.d_tblposition.findMany({ orderBy: { pos_name: "asc" } });
    
    const teams = await prisma.d_tblteam.findMany({
        include: { D_tbldepartment: true },
        orderBy: { team_name: "asc" },
    });

    const supervisors = await prisma.d_tbluser.findMany({
        where: { role_id: { in: [2, 3, 4] }, account_status: "ACTIVE" },
        select: { user_id: true, first_name: true, last_name: true },
        orderBy: { first_name: "asc" },
    });

    const managers = await prisma.d_tbluser.findMany({
        where: { role_id: { in: [3, 4] }, account_status: "ACTIVE" },
        select: { user_id: true, first_name: true, last_name: true },
        orderBy: { first_name: "asc" },
    });

    return NextResponse.json({
      roles,
      departments,
      positions,
      teams,
      supervisors,
      managers,
    });
  } catch (error) {
    console.error("Metadata error:", error);
    return NextResponse.json({ message: "Failed to fetch metadata" }, { status: 500 });
  }
}