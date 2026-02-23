import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromCookie } from "@/lib/auth";

export async function GET() {
  const user = await getUserFromCookie();
  
  if (!user || (user.role_id !== 5 && user.role_id !== 4)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const managerData = await prisma.d_tbluser.findUnique({
      where: { user_id: user.user_id }, 
      select: { dept_id: true }
    });

    if (!managerData || !managerData.dept_id) {
      return NextResponse.json({ message: "Department not found for this user" }, { status: 400 });
    }

    const roster = await prisma.d_tbluser.findMany({
      where: {
        role_id: { in: [1, 4] }, 
        dept_id: managerData.dept_id 
      },
      select: {
        user_id: true,
        first_name: true,
        last_name: true,
        role_id: true,
        D_tblteam: { select: { team_name: true } },
        D_tblposition: { select: { pos_name: true } },
        D_tblclock_log: {
          orderBy: { clock_in_time: 'desc' },
          take: 1,
          select: {
            clock_in_time: true,
            clock_out_time: true,
            active_key: true
          }
        }
      },
      orderBy: [
        { role_id: 'desc' },
        { last_name: 'asc' }
      ]
    });

    const formattedRoster = roster.map((u) => {
      const lastLog = u.D_tblclock_log[0];
      const isClockedIn = lastLog && (lastLog.active_key === "ACTIVE" || (lastLog.clock_in_time && !lastLog.clock_out_time));
      
      return {
        user_id: u.user_id,
        name: `${u.first_name} ${u.last_name}`,
        role_id: u.role_id,
        team: u.D_tblteam?.team_name || null,
        position: u.D_tblposition?.pos_name || null,
        status: isClockedIn ? "in" : "out"
      };
    });

    return NextResponse.json({ roster: formattedRoster });

  } catch (error) {
    console.error("Roster Fetch Error:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}