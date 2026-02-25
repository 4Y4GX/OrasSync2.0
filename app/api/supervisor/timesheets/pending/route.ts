// app/api/supervisor/timesheets/pending/route.ts
import { NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getUserFromCookie();
    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Check if user is a supervisor
    if (user.role_id !== 2) {
      return NextResponse.json({ message: "Supervisor access only" }, { status: 403 });
    }

    // Get all pending time logs for team members supervised by this user
    const pendingTimesheets = await prisma.d_tbltime_log.findMany({
      where: {
        supervisor_id_at_log: user.user_id,
        approval_status: "PENDING",
        total_hours: { not: null }, // Only completed activities
      },
      include: {
        D_tbluser: {
          select: {
            user_id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
        D_tblactivity: {
          select: {
            activity_name: true,
            activity_code: true,
            is_billable: true,
          },
        },
      },
      orderBy: {
        log_date: "desc",
      },
    });

    // Group by user and date
    const groupedTimesheets: Record<string, any> = {};

    pendingTimesheets.forEach((log) => {
      const key = `${log.user_id}_${log.log_date.toISOString().split('T')[0]}`;
      
      if (!groupedTimesheets[key]) {
        groupedTimesheets[key] = {
          user_id: log.user_id,
          employee_name: `${log.D_tbluser.first_name} ${log.D_tbluser.last_name}`,
          email: log.D_tbluser.email,
          date: log.log_date.toISOString().split('T')[0],
          total_hours: 0,
          activities: [],
          activity_count: 0,
        };
      }

      groupedTimesheets[key].total_hours += log.total_hours || 0;
      groupedTimesheets[key].activity_count += 1;
      groupedTimesheets[key].activities.push({
        tlog_id: log.tlog_id,
        activity_name: log.D_tblactivity?.activity_name,
        activity_code: log.D_tblactivity?.activity_code,
        is_billable: log.D_tblactivity?.is_billable,
        start_time: log.start_time,
        end_time: log.end_time,
        hours: log.total_hours,
      });
    });

    const timesheets = Object.values(groupedTimesheets).map((ts) => ({
      ...ts,
      total_hours: Math.round(ts.total_hours * 10) / 10,
    }));

    return NextResponse.json({
      pendingTimesheets: timesheets,
      count: timesheets.length,
    });
  } catch (error) {
    console.error("Pending timesheets error:", error);
    return NextResponse.json(
      { message: "Failed to fetch pending timesheets" },
      { status: 500 }
    );
  }
}