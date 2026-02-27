import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

function toYMD(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export async function POST(req: Request) {
  try {
    const user = await getUserFromCookie();
    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const userId = (user as any).user_id ?? null;
    if (!userId) {
      return NextResponse.json(
        { message: "Session user missing user_id" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { tlog_ids } = body;

    if (!tlog_ids || !Array.isArray(tlog_ids) || tlog_ids.length === 0) {
      return NextResponse.json(
        { message: "No time logs provided for submission" },
        { status: 400 }
      );
    }

    // Fetch the time logs to verify ownership and get shift info
    const timeLogs = await prisma.d_tbltime_log.findMany({
      where: {
        tlog_id: { in: tlog_ids.map((id: number) => parseInt(id.toString())) },
        user_id: String(userId),
        // Look for NOT_SUBMITTED or REJECTED logs (so users can resubmit fixed logs)
        approval_status: { in: ["NOT_SUBMITTED", "REJECTED"] }, 
      },
      select: {
        tlog_id: true,
        log_date: true,
        shift_date: true,
        supervisor_id_at_log: true,
      },
    });

    if (timeLogs.length === 0) {
      return NextResponse.json(
        { message: "No eligible un-submitted time logs found to submit" },
        { status: 400 }
      );
    }

    // Fetch user's weekly schedule and shift templates
    const weeklySchedule = await prisma.d_tblweekly_schedule.findFirst({
      where: {
        user_id: String(userId),
        is_active: true,
      },
    });

    const shiftTemplates = await prisma.d_tblshift_template.findMany();
    const shiftMap: Record<number, string> = {};
    shiftTemplates.forEach((s) => {
      shiftMap[s.shift_id] = s.shift_name ?? `Shift ${s.shift_id}`;
    });

    // Helper to get shift info for a given date
    function getShiftForDate(date: Date): { shift_id: number | null; shift_name: string } {
      if (!weeklySchedule) return { shift_id: null, shift_name: "Unassigned" };
      
      const weekday = date.getDay();
      
      let shiftId: number | null = null;
      switch (weekday) {
        case 0: shiftId = weeklySchedule.sunday_shift_id; break;
        case 1: shiftId = weeklySchedule.monday_shift_id; break;
        case 2: shiftId = weeklySchedule.tuesday_shift_id; break;
        case 3: shiftId = weeklySchedule.wednesday_shift_id; break;
        case 4: shiftId = weeklySchedule.thursday_shift_id; break;
        case 5: shiftId = weeklySchedule.friday_shift_id; break;
        case 6: shiftId = weeklySchedule.saturday_shift_id; break;
      }
      
      return {
        shift_id: shiftId,
        shift_name: shiftId ? (shiftMap[shiftId] ?? `Shift ${shiftId}`) : "Day Off",
      };
    }

    // Get the user's supervisor
    const userDetails = await prisma.d_tbluser.findUnique({
      where: { user_id: String(userId) },
      select: { supervisor_id: true },
    });

    const supervisorId = userDetails?.supervisor_id || null;

    // Group logs by shift and update supervisor_id_at_log
    const groupedByShift: Record<string, { shift_name: string; tlog_ids: number[]; count: number }> = {};

    for (const log of timeLogs) {
      const logDate = log.shift_date ?? log.log_date ?? new Date();
      const shiftInfo = getShiftForDate(new Date(logDate));
      const shiftKey = shiftInfo.shift_name;

      if (!groupedByShift[shiftKey]) {
        groupedByShift[shiftKey] = {
          shift_name: shiftInfo.shift_name,
          tlog_ids: [],
          count: 0,
        };
      }

      groupedByShift[shiftKey].tlog_ids.push(log.tlog_id);
      groupedByShift[shiftKey].count++;
    }

    // ✅ FIX: Setting supervisor and manager columns strictly to "PENDING" instead of null
    const updateResult = await prisma.d_tbltime_log.updateMany({
      where: {
        tlog_id: { in: timeLogs.map((t) => t.tlog_id) },
      },
      data: {
        supervisor_id_at_log: supervisorId ?? "",
        approval_status: "PENDING",        
        approved_by_supervisor_id: "PENDING", 
        approved_by_manager_id: "PENDING",    
        rejection_reason: null,            
      },
    });

    // Create audit log for submission
    await prisma.d_tblaudit_log.create({
      data: {
        changed_by: String(userId),
        action_type: "SUBMIT_TIMESHEET",
        table_affected: "D_tbltime_log",
        old_value: null,
        new_value: JSON.stringify({
          submitted_count: timeLogs.length,
          shifts: Object.keys(groupedByShift),
          supervisor_id: supervisorId,
        }),
      },
    });

    // Build response summary
    const summary = Object.values(groupedByShift).map((group) => ({
      shift_name: group.shift_name,
      logs_submitted: group.count,
    }));

    return NextResponse.json({
      message: `Successfully submitted ${timeLogs.length} time log(s) for review`,
      submitted_count: timeLogs.length,
      supervisor_id: supervisorId,
      by_shift: summary,
    });
  } catch (err: any) {
    console.error("TIMESHEET_SUBMIT_ERROR:", err);
    return NextResponse.json(
      { message: err?.message ?? "Failed to submit timesheet" },
      { status: 500 }
    );
  }
}