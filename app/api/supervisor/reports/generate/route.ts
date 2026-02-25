// app/api/supervisor/reports/generate/route.ts
import { NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await getUserFromCookie();
    if (!user || user.role_id !== 2) {
      return NextResponse.json(
        { message: "Unauthorized. Supervisor access required." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { report_type, employee_id, format, start_date, end_date } = body;

    // Validation
    if (!report_type || !format) {
      return NextResponse.json(
        { message: "Report type and format are required" },
        { status: 400 }
      );
    }

    // Get date range based on report type
    let startDate: Date;
    let endDate: Date = new Date();

    switch (report_type) {
      case "daily":
        startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case "weekly":
        startDate = new Date();
        startDate.setDate(startDate.getDate() - startDate.getDay());
        startDate.setHours(0, 0, 0, 0);
        break;
      case "monthly":
        startDate = new Date();
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
        break;
      case "custom":
        if (!start_date || !end_date) {
          return NextResponse.json(
            { message: "Start date and end date required for custom reports" },
            { status: 400 }
          );
        }
        startDate = new Date(start_date);
        endDate = new Date(end_date);
        break;
      default:
        return NextResponse.json(
          { message: "Invalid report type" },
          { status: 400 }
        );
    }

    // Get team members
    const teamMembers = await prisma.d_tbluser.findMany({
      where: {
        supervisor_id: user.user_id,
        account_status: "ACTIVE",
        ...(employee_id && employee_id !== "all" ? { user_id: employee_id } : {}),
      },
      select: {
        user_id: true,
        first_name: true,
        last_name: true,
        email: true,
      },
    });

    const teamUserIds = teamMembers.map((m) => m.user_id);

    // Get time logs for the period
    const timeLogs = await prisma.d_tbltime_log.findMany({
      where: {
        user_id: { in: teamUserIds },
        log_date: {
          gte: startDate,
          lte: endDate,
        },
        total_hours: { not: null },
      },
      include: {
        D_tbluser: {
          select: {
            first_name: true,
            last_name: true,
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
        log_date: "asc",
      },
    });

    // Get clock records for attendance
    const clockRecords = await prisma.d_tblclock.findMany({
      where: {
        user_id: { in: teamUserIds },
        clock_in_time: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        D_tbluser: {
          select: {
            first_name: true,
            last_name: true,
          },
        },
      },
      orderBy: {
        clock_in_time: "asc",
      },
    });

    // Calculate summary statistics
    const summary = teamMembers.map((member) => {
      const memberLogs = timeLogs.filter((log) => log.user_id === member.user_id);
      const memberClocks = clockRecords.filter((clock) => clock.user_id === member.user_id);

      const totalHours = memberLogs.reduce((sum, log) => sum + (log.total_hours || 0), 0);
      const billableHours = memberLogs
        .filter((log) => log.D_tblactivity?.is_billable)
        .reduce((sum, log) => sum + (log.total_hours || 0), 0);

      // Activity breakdown
      const activityBreakdown: { [key: string]: number } = {};
      memberLogs.forEach((log) => {
        const activityName = log.D_tblactivity?.activity_name || "Unknown";
        activityBreakdown[activityName] = (activityBreakdown[activityName] || 0) + (log.total_hours || 0);
      });

      // Attendance summary
      const daysPresent = new Set(
        memberClocks.map((clock) => clock.clock_in_time.toISOString().split("T")[0])
      ).size;

      return {
        employee_id: member.user_id,
        employee_name: `${member.first_name} ${member.last_name}`,
        email: member.email,
        total_hours: Math.round(totalHours * 100) / 100,
        billable_hours: Math.round(billableHours * 100) / 100,
        non_billable_hours: Math.round((totalHours - billableHours) * 100) / 100,
        activity_breakdown: activityBreakdown,
        days_present: daysPresent,
        total_clock_ins: memberClocks.length,
      };
    });

    // Generate report based on format
    let reportData;
    
    if (format === "json") {
      reportData = {
        report_type,
        period: {
          start: startDate.toISOString().split("T")[0],
          end: endDate.toISOString().split("T")[0],
        },
        generated_by: `${user.first_name} ${user.last_name}`,
        generated_at: new Date().toISOString(),
        summary,
        total_team_hours: summary.reduce((sum, s) => sum + s.total_hours, 0),
        total_team_billable: summary.reduce((sum, s) => sum + s.billable_hours, 0),
      };
    } else if (format === "csv") {
      // CSV format
      const csvHeaders = [
        "Employee Name",
        "Email",
        "Total Hours",
        "Billable Hours",
        "Non-Billable Hours",
        "Days Present",
        "Clock-ins",
      ];

      const csvRows = summary.map((s) => [
        s.employee_name,
        s.email,
        s.total_hours,
        s.billable_hours,
        s.non_billable_hours,
        s.days_present,
        s.total_clock_ins,
      ]);

      const csvContent = [
        csvHeaders.join(","),
        ...csvRows.map((row) => row.join(",")),
      ].join("\n");

      reportData = {
        format: "csv",
        content: csvContent,
        filename: `team_report_${report_type}_${startDate.toISOString().split("T")[0]}_${endDate.toISOString().split("T")[0]}.csv`,
      };
    } else {
      // PDF format - return data for frontend to generate PDF
      reportData = {
        format: "pdf",
        report_type,
        period: {
          start: startDate.toISOString().split("T")[0],
          end: endDate.toISOString().split("T")[0],
        },
        generated_by: `${user.first_name} ${user.last_name}`,
        generated_at: new Date().toISOString(),
        summary,
        total_team_hours: summary.reduce((sum, s) => sum + s.total_hours, 0),
        total_team_billable: summary.reduce((sum, s) => sum + s.billable_hours, 0),
        filename: `team_report_${report_type}_${startDate.toISOString().split("T")[0]}_${endDate.toISOString().split("T")[0]}.pdf`,
      };
    }

    // Create audit log
    await prisma.d_tblaudit_log.create({
      data: {
        changed_by: user.user_id,
        action_type: "GENERATE_REPORT",
        table_affected: "Reports",
        old_value: null,
        new_value: `Generated ${report_type} report in ${format} format`,
      },
    });

    return NextResponse.json({
      message: "Report generated successfully",
      report: reportData,
    });
  } catch (error) {
    console.error("Generate report error:", error);
    return NextResponse.json(
      { message: "Failed to generate report" },
      { status: 500 }
    );
  }
}