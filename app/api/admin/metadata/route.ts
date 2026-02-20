import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromCookie } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getUserFromCookie();
    
    // Ensure only Admins (Role ID 3) can access this metadata
    if (!user || user.role_id !== 3) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }

    // Role IDs based on your latest update
    const ROLE_SUPERVISOR = 4;
    const ROLE_MANAGER = 5;

    // Fetch Roles, Depts, Positions, Teams as usual
    const [roles, departments, positions, teams] = await Promise.all([
      prisma.d_tblrole.findMany({ orderBy: { role_name: 'asc' } }),
      prisma.d_tbldepartment.findMany({ orderBy: { dept_name: 'asc' } }),
      prisma.d_tblposition.findMany({ orderBy: { pos_name: 'asc' } }),
      prisma.d_tblteam.findMany({ orderBy: { team_name: 'asc' } }),
    ]);

    // FETCH SUPERVISORS: Strictly Role ID 4 and ACTIVE
    const supervisors = await prisma.d_tbluser.findMany({
      where: {
        role_id: ROLE_SUPERVISOR,
        account_status: "ACTIVE",
      },
      select: {
        user_id: true,
        first_name: true,
        last_name: true,
      },
      orderBy: { first_name: 'asc' },
    });

    // FETCH MANAGERS: Strictly Role ID 5 and ACTIVE
    const managers = await prisma.d_tbluser.findMany({
      where: {
        role_id: ROLE_MANAGER,
        account_status: "ACTIVE",
      },
      select: {
        user_id: true,
        first_name: true,
        last_name: true,
      },
      orderBy: { first_name: 'asc' },
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
    console.error("Metadata fetch error:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}