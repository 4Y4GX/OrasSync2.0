// app/api/analyst/reports/route.ts
import { NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await getUserFromCookie();
    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Check if user is analyst
    if (user.role_id !== 2) {
      return NextResponse.json({ message: "Forbidden: Analyst access only" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get("type") || "attendance"; // attendance, productivity, billable, sentiment, overtime, dept_summary
    const deptId = searchParams.get("dept_id");
    const period = searchParams.get("period") || "week";
    const format = searchParams.get("format") || "json"; // json, csv

    // Calculate date range
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    let startDate: Date;

    if (period === "week") {
      startDate = new Date(today);
      const dayOfWeek = today.getDay();
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      startDate.setDate(today.getDate() - diff);
      startDate.setHours(0, 0, 0, 0);
    } else if (period === "month") {
      startDate = new Date(today.getFullYear(), today.getMonth(), 1, 0, 0, 0, 0);
    } else if (period === "quarter") {
      const quarter = Math.floor(today.getMonth() / 3);
      startDate = new Date(today.getFullYear(), quarter * 3, 1, 0, 0, 0, 0);
    } else {
      startDate = new Date(today.getFullYear(), 0, 1, 0, 0, 0, 0);
    }

    let reportData: any[] = [];
    let headers: string[] = [];

    switch (reportType) {
      case "attendance":
        const clockLogs = await prisma.d_tblclock_log.findMany({
          where: {
            shift_date: { gte: startDate, lte: today },
            ...(deptId && deptId !== "ALL" ? {
              D_tbluser: { dept_id: parseInt(deptId) },
            } : {}),
          },
          include: {
            D_tbluser: {
              include: {
                D_tbldepartment: true,
                D_tblteam: true,
              },
            },
          },
        });

        headers = ["User ID", "Name", "Department", "Team", "Shift Date", "Clock In", "Clock Out", "Early Leave", "Sentiment Done"];
        reportData = clockLogs.map(log => ({
          user_id: log.user_id,
          name: `${log.D_tbluser?.first_name || ""} ${log.D_tbluser?.last_name || ""}`.trim(),
          department: log.D_tbluser?.D_tbldepartment?.dept_name || "N/A",
          team: log.D_tbluser?.D_tblteam?.team_name || "N/A",
          shift_date: log.shift_date?.toISOString().split('T')[0] || "",
          clock_in: log.clock_in_time?.toISOString() || "N/A",
          clock_out: log.clock_out_time?.toISOString() || "Not Clocked Out",
          early_leave: log.is_early_leave ? "Yes" : "No",
          sentiment_done: log.is_sentiment_done ? "Yes" : "No",
        }));
        break;

      case "productivity":
        const timeLogs = await prisma.d_tbltime_log.findMany({
          where: {
            log_date: { gte: startDate, lte: today },
            ...(deptId && deptId !== "ALL" ? {
              dept_id_at_log: parseInt(deptId),
            } : {}),
          },
          include: {
            D_tbluser_D_tbltime_log_user_idToD_tbluser: {
              include: {
                D_tbldepartment: true,
              },
            },
            D_tblactivity: true,
          },
        });

        headers = ["User ID", "Name", "Department", "Activity", "Date", "Hours", "Billable", "Approval Status"];
        reportData = timeLogs.map(log => ({
          user_id: log.user_id,
          name: `${log.D_tbluser_D_tbltime_log_user_idToD_tbluser?.first_name || ""} ${log.D_tbluser_D_tbltime_log_user_idToD_tbluser?.last_name || ""}`.trim(),
          department: log.D_tbluser_D_tbltime_log_user_idToD_tbluser?.D_tbldepartment?.dept_name || "N/A",
          activity: log.D_tblactivity?.activity_name || "Unknown",
          date: log.log_date?.toISOString().split('T')[0] || "",
          hours: log.total_hours?.toNumber() || 0,
          billable: log.D_tblactivity?.is_billable ? "Yes" : "No",
          approval_status: log.approval_status || "PENDING",
        }));
        break;

      case "billable":
        const billableLogs = await prisma.d_tbltime_log.findMany({
          where: {
            log_date: { gte: startDate, lte: today },
            ...(deptId && deptId !== "ALL" ? {
              dept_id_at_log: parseInt(deptId),
            } : {}),
          },
          include: {
            D_tbluser_D_tbltime_log_user_idToD_tbluser: {
              include: {
                D_tbldepartment: true,
              },
            },
            D_tblactivity: true,
          },
        });

        // Group by user
        const userBillableMap = new Map();
        billableLogs.forEach(log => {
          if (!log.user_id) return;
          if (!userBillableMap.has(log.user_id)) {
            userBillableMap.set(log.user_id, {
              user_id: log.user_id,
              name: `${log.D_tbluser_D_tbltime_log_user_idToD_tbluser?.first_name || ""} ${log.D_tbluser_D_tbltime_log_user_idToD_tbluser?.last_name || ""}`.trim(),
              department: log.D_tbluser_D_tbltime_log_user_idToD_tbluser?.D_tbldepartment?.dept_name || "N/A",
              total_hours: 0,
              billable_hours: 0,
              non_billable_hours: 0,
            });
          }
          const userData = userBillableMap.get(log.user_id);
          const hours = log.total_hours?.toNumber() || 0;
          userData.total_hours += hours;
          if (log.D_tblactivity?.is_billable) {
            userData.billable_hours += hours;
          } else {
            userData.non_billable_hours += hours;
          }
        });

        headers = ["User ID", "Name", "Department", "Total Hours", "Billable Hours", "Non-Billable Hours", "Billable Ratio %"];
        reportData = Array.from(userBillableMap.values()).map(user => ({
          user_id: user.user_id,
          name: user.name,
          department: user.department,
          total_hours: Math.round(user.total_hours * 100) / 100,
          billable_hours: Math.round(user.billable_hours * 100) / 100,
          non_billable_hours: Math.round(user.non_billable_hours * 100) / 100,
          billable_ratio: user.total_hours > 0 ? Math.round((user.billable_hours / user.total_hours) * 100) : 0,
        }));
        break;

      case "sentiment":
        const sentimentLogs = await prisma.d_tblsentiment_log.findMany({
          where: {
            created_at: { gte: startDate, lte: today },
            ...(deptId && deptId !== "ALL" ? {
              D_tbluser: { dept_id: parseInt(deptId) },
            } : {}),
          },
          include: {
            D_tbluser: {
              include: {
                D_tbldepartment: true,
              },
            },
          },
        });

        headers = ["User ID", "Name", "Department", "Date", "Sentiment", "Reason"];
        reportData = sentimentLogs.map(log => ({
          user_id: log.user_id,
          name: `${log.D_tbluser?.first_name || ""} ${log.D_tbluser?.last_name || ""}`.trim(),
          department: log.D_tbluser?.D_tbldepartment?.dept_name || "N/A",
          date: log.created_at?.toISOString().split('T')[0] || "",
          sentiment: log.sentiment_status || "N/A",
          reason: log.reason_comment || "N/A",
        }));
        break;

      case "overtime":
        const otRequests = await prisma.d_tblot_request.findMany({
          where: {
            created_at: { gte: startDate, lte: today },
            ...(deptId && deptId !== "ALL" ? {
              D_tbluser: { dept_id: parseInt(deptId) },
            } : {}),
          },
          include: {
            D_tbluser: {
              include: {
                D_tbldepartment: true,
              },
            },
          },
        });

        headers = ["User ID", "Name", "Department", "Start Time", "End Time", "Reason", "Created At"];
        reportData = otRequests.map(req => ({
          user_id: req.user_id,
          name: `${req.D_tbluser?.first_name || ""} ${req.D_tbluser?.last_name || ""}`.trim(),
          department: req.D_tbluser?.D_tbldepartment?.dept_name || "N/A",
          start_time: req.start_time?.toString() || "N/A",
          end_time: req.end_time?.toString() || "N/A",
          reason: req.reason || "N/A",
          created_at: req.created_at?.toISOString() || "",
        }));
        break;

      case "dept_summary":
        const departments = await prisma.d_tbldepartment.findMany({
          where: { is_active: true },
          include: {
            D_tbluser: true,
          },
        });

        const deptReports = await Promise.all(
          departments.map(async (dept) => {
            const deptTimeLogs = await prisma.d_tbltime_log.findMany({
              where: {
                dept_id_at_log: dept.dept_id,
                log_date: { gte: startDate, lte: today },
              },
              include: {
                D_tblactivity: true,
              },
            });

            const deptClockLogs = await prisma.d_tblclock_log.findMany({
              where: {
                shift_date: { gte: startDate, lte: today },
                D_tbluser: { dept_id: dept.dept_id },
              },
            });

            const totalHours = deptTimeLogs.reduce((sum, log) => sum + (log.total_hours?.toNumber() || 0), 0);
            const billableHours = deptTimeLogs.filter(log => log.D_tblactivity?.is_billable).reduce((sum, log) => sum + (log.total_hours?.toNumber() || 0), 0);
            const activeUsers = new Set(deptClockLogs.map(log => log.user_id)).size;

            return {
              department: dept.dept_name,
              total_staff: dept.D_tbluser.length,
              active_staff: activeUsers,
              total_hours: Math.round(totalHours * 100) / 100,
              billable_hours: Math.round(billableHours * 100) / 100,
              billable_ratio: totalHours > 0 ? Math.round((billableHours / totalHours) * 100) : 0,
              avg_hours_per_staff: activeUsers > 0 ? Math.round((totalHours / activeUsers) * 100) / 100 : 0,
            };
          })
        );

        headers = ["Department", "Total Staff", "Active Staff", "Total Hours", "Billable Hours", "Billable Ratio %", "Avg Hours/Staff"];
        reportData = deptReports;
        break;

      default:
        return NextResponse.json({ message: "Invalid report type" }, { status: 400 });
    }

    // Return CSV format if requested
    if (format === "csv") {
      const csvRows = [headers.join(",")];
      reportData.forEach(row => {
        const values = headers.map(header => {
          const key = header.toLowerCase().replace(/ /g, '_').replace(/%/g, '').replace(/-/g, '_').replace(/\//g, '_per_').replace(/_+$/, '');
          let value = row[key];
          if (value === null || value === undefined) value = "";
          if (typeof value === "string" && value.includes(",")) {
            value = `"${value}"`;
          }
          return value;
        });
        csvRows.push(values.join(","));
      });

      const csv = csvRows.join("\n");
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="${reportType}_report_${period}.csv"`,
        },
      });
    }

    return NextResponse.json({
      reportType,
      period,
      headers,
      data: reportData,
      count: reportData.length,
    });
  } catch (error) {
    console.error("Generate report error:", error);
    return NextResponse.json({ message: "Failed to generate report" }, { status: 500 });
  }
}
