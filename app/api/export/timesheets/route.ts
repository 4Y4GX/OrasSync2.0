// app/api/export/timesheets/route.ts
import { NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await getUserFromCookie();
    if (!user || (user.role_id !== 2 && user.role_id !== 3 && user.role_id !== 4)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");

    if (!startDate || !endDate) {
      return NextResponse.json({ message: "Start and end dates are required" }, { status: 400 });
    }

    let whereClause: any = {
      log_date: {
        gte: new Date(startDate),
        lte: new Date(endDate),
      },
    };

    // Filter by role
    if (user.role_id === 2) {
      whereClause.supervisor_id_at_log = user.user_id;
    }

    const timesheets = await prisma.d_tbltime_log.findMany({
      where: whereClause,
      include: {
        D_tbluser_D_tbltime_log_user_idToD_tbluser: {
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
      orderBy: [{ log_date: "desc" }, { user_id: "asc" }],
    });

    // Convert to CSV
    const headers = [
      "Log ID",
      "User ID",
      "Employee Name",
      "Email",
      "Date",
      "Activity",
      "Activity Code",
      "Billable",
      "Start Time",
      "End Time",
      "Total Hours",
      "Approval Status",
      "Rejection Reason",
    ];

    const rows = timesheets.map(t => [
      t.tlog_id,
      t.user_id,
      `${t.D_tbluser_D_tbltime_log_user_idToD_tbluser?.first_name} ${t.D_tbluser_D_tbltime_log_user_idToD_tbluser?.last_name}`,
      t.D_tbluser_D_tbltime_log_user_idToD_tbluser?.email || "",
      t.log_date?.toISOString().split('T')[0] || "",
      t.D_tblactivity?.activity_name || "",
      t.D_tblactivity?.activity_code || "",
      t.D_tblactivity?.is_billable ? "Yes" : "No",
      t.start_time,
      t.end_time || "",
      t.total_hours?.toString() || "",
      t.approval_status,
      t.rejection_reason || "",
    ]);

    const csv = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(",")),
    ].join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="timesheets_${startDate}_to_${endDate}.csv"`,
      },
    });
  } catch (error) {
    console.error("Export timesheets error:", error);
    return NextResponse.json({ message: "Failed to export timesheets" }, { status: 500 });
  }
}
