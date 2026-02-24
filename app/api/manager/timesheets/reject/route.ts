import { NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await getUserFromCookie();
    if (!user || (user.role_id !== 2 && user.role_id !== 4 && user.role_id !== 5)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { tlog_ids, reason } = body;

    if (!tlog_ids || !Array.isArray(tlog_ids) || tlog_ids.length === 0) {
      return NextResponse.json({ message: "Timesheet IDs are required" }, { status: 400 });
    }

    if (!reason || reason.trim().length === 0) {
      return NextResponse.json({ message: "Rejection reason is required" }, { status: 400 });
    }

    // MANAGER SECURITY CHECK: Ensure supervisor has approved first
    if (user.role_id === 5) {
      const pendingLogs = await prisma.d_tbltime_log.findMany({
        where: {
          tlog_id: { in: tlog_ids.map((id: number) => parseInt(id.toString())) },
          approval_status: { not: "SUPERVISOR_APPROVED" }
        }
      });
      
      if (pendingLogs.length > 0) {
        return NextResponse.json({ message: "Cannot process: One or more timesheets are awaiting Supervisor approval." }, { status: 403 });
      }
    }

    const updateData: any = {
      approval_status: "REJECTED",
      rejection_reason: reason.trim(),
    };

    if (user.role_id === 2 || user.role_id === 4) {
      updateData.approved_by_supervisor_id = "REJECTED";
    } else if (user.role_id === 5) {
      updateData.approved_by_manager_id = "REJECTED";
    }

    await prisma.d_tbltime_log.updateMany({
      where: {
        tlog_id: { in: tlog_ids.map((id: number) => parseInt(id.toString())) },
      },
      data: updateData,
    });

    await prisma.d_tblaudit_log.create({
      data: {
        changed_by: user.user_id,
        action_type: "REJECT_TIMESHEET",
        table_affected: "D_tbltime_log",
        old_value: null,
        new_value: `Rejected ${tlog_ids.length} timesheet(s): ${reason}`,
      },
    });

    return NextResponse.json({
      message: `${tlog_ids.length} timesheet(s) rejected successfully`,
      rejected_count: tlog_ids.length,
    });
  } catch (error) {
    console.error("Reject timesheets error:", error);
    return NextResponse.json({ message: "Failed to reject timesheets" }, { status: 500 });
  }
}