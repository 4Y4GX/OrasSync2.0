// app/api/supervisor/team/status/route.ts
import { NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getUserFromCookie();
    if (!user || (user.role_id !== 2 && user.role_id !== 3 && user.role_id !== 4)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }

    const today = new Date();
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());

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
          D_tblclock_log: {
            where: {
              shift_date: todayDate,
            },
            select: {
              clock_id: true,
              clock_in_time: true,
              clock_out_time: true,
              is_sentiment_done: true,
            },
          },
          D_tbltime_log: {
            where: {
              log_date: todayDate,
              end_time: null, // Active activity
            },
            include: {
              D_tblactivity: {
                select: {
                  activity_name: true,
                  activity_code: true,
                  is_billable: true,
                },
              },
            },
            take: 1,
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
          D_tblclock_log: {
            where: {
              shift_date: todayDate,
            },
            select: {
              clock_id: true,
              clock_in_time: true,
              clock_out_time: true,
              is_sentiment_done: true,
            },
          },
          D_tbltime_log: {
            where: {
              log_date: todayDate,
              end_time: null, // Active activity
            },
            include: {
              D_tblactivity: {
                select: {
                  activity_name: true,
                  activity_code: true,
                  is_billable: true,
                },
              },
            },
            take: 1,
          },
        },
        orderBy: { first_name: "asc" },
      });
    }

    // Calculate status for each member
    const teamStatus = teamMembers.map((member) => {
      const clockLog = member.D_tblclock_log[0];
      const activeActivity = member.D_tbltime_log[0];

      let status = "Offline";
      let hoursToday = 0;
      let currentActivity = "Not Clocked In";

      if (clockLog) {
        if (clockLog.clock_out_time) {
          status = "Clocked Out";
          const clockIn = new Date(clockLog.clock_in_time);
          const clockOut = new Date(clockLog.clock_out_time);
          hoursToday = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60);
        } else {
          status = "Working";
          const clockIn = new Date(clockLog.clock_in_time);
          const now = new Date();
          hoursToday = (now.getTime() - clockIn.getTime()) / (1000 * 60 * 60);

          if (activeActivity) {
            currentActivity = activeActivity.D_tblactivity?.activity_name || "Unknown Activity";
          } else {
            currentActivity = "No Active Task";
          }
        }
      }

      return {
        user_id: member.user_id,
        name: `${member.first_name} ${member.last_name}`,
        email: member.email,
        department: member.D_tbldepartment?.dept_name || "—",
        team: member.D_tblteam?.team_name || "—",
        position: member.D_tblposition?.pos_name || "—",
        status,
        hours_today: Math.round(hoursToday * 100) / 100,
        current_activity: currentActivity,
        is_billable: activeActivity?.D_tblactivity?.is_billable || false,
        clock_in_time: clockLog?.clock_in_time || null,
        clock_out_time: clockLog?.clock_out_time || null,
      };
    });

    return NextResponse.json({ teamStatus });
  } catch (error) {
    console.error("Get team status error:", error);
    return NextResponse.json({ message: "Failed to fetch team status" }, { status: 500 });
  }
}
