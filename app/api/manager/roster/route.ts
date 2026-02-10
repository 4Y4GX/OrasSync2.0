import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromCookie } from "@/lib/auth";

export async function GET() {
  const user = await getUserFromCookie();
  if (!user || (user.role_id !== 5 && user.role_id !== 4)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    // Fetch all Supervisors (4) and Employees (1)
    const roster = await prisma.d_tbluser.findMany({
      where: {
        role_id: { in: [1, 4] }, 
        // Optional: If you want to restrict to the manager's department only:
        // dept_id: user.dept_id 
      },
      select: {
        user_id: true,
        first_name: true,
        last_name: true,
        role_id: true,
        
        // Fetch relations (Team & Position)
        D_tblteam: {
          select: { team_name: true }
        },
        D_tblposition: {
          select: { pos_name: true }
        },

        // Fetch LATEST clock log to determine status
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
        { role_id: 'desc' }, // Supervisors (4) first, then Employees (1)
        { last_name: 'asc' }
      ]
    });

    // Transform data for the frontend
    const formattedRoster = roster.map((u) => {
      const lastLog = u.D_tblclock_log[0];
      
      // Logic: If they have an ACTIVE key OR (clocked in AND not clocked out), they are "IN"
      const isClockedIn = lastLog && (lastLog.active_key === "ACTIVE" || (lastLog.clock_in_time && !lastLog.clock_out_time));
      
      return {
        user_id: u.user_id,
        name: `${u.first_name} ${u.last_name}`,
        role_id: u.role_id,
        team: u.D_tblteam?.team_name || null, // Handle nulls as requested
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