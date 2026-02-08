// app/api/manager/timesheets/approve/route.ts
import { NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await getUserFromCookie();
    if (!user || (user.role_id !== 2 && user.role_id !== 3 && user.role_id !== 4)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { tlog_ids, bulk = false } = body;

    if (!tlog_ids || !Array.isArray(tlog_ids) || tlog_ids.length === 0) {
      return NextResponse.json({ message: "Timesheet IDs are required" }, { status: 400 });
    }

    const updateData: any = {
      approval_status: user.role_id === 2 ? "SUPERVISOR_APPROVED" : "MANAGER_APPROVED",
    };

    if (user.role_id === 2) {
      // Supervisor approval
      updateData.approved_by_supervisor_id = "APPROVED";
      updateData.supervisor_approved_at = new Date();
    } else if (user.role_id === 3) {
      // Manager approval
      updateData.approved_by_manager_id = "APPROVED";
      updateData.manager_approved_at = new Date();
    }

    // Update multiple timesheets
    await prisma.d_tbltime_log.updateMany({
      where: {
        tlog_id: { in: tlog_ids.map((id: number) => parseInt(id.toString())) },
      },
      data: updateData,
    });

    // Create audit log
    await prisma.d_tblaudit_log.create({
      data: {
        changed_by: user.user_id,
        action_type: "APPROVE_TIMESHEET",
        table_affected: "D_tbltime_log",
        old_value: null,
        new_value: `Approved ${tlog_ids.length} timesheet(s)`,
      },
    });

    return NextResponse.json({
      message: `${tlog_ids.length} timesheet(s) approved successfully`,
      approved_count: tlog_ids.length,
    });
  } catch (error) {
    console.error("Approve timesheets error:", error);
    return NextResponse.json({ message: "Failed to approve timesheets" }, { status: 500 });
  }
}
