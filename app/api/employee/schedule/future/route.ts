// app/api/employee/schedule/future/route.ts
import { NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Format TIME field (stored as UTC Date) to HH:MM string
function formatTimeField(timeValue: Date | null): string | null {
  if (!timeValue) return null;
  const hours = timeValue.getUTCHours();
  const minutes = timeValue.getUTCMinutes();
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}

// Parse HH:MM string to Date object for TIME field storage
function parseTimeString(timeStr: string): Date {
  const [hours, minutes] = timeStr.split(":").map(Number);
  const date = new Date(Date.UTC(1970, 0, 1, hours, minutes, 0));
  return date;
}

// GET: List future scheduled activities for a user
export async function GET(req: Request) {
  try {
    const user = await getUserFromCookie();
    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId") || user.user_id;
    const year = searchParams.get("year");
    const month = searchParams.get("month");

    // Build date filter if year/month provided
    let dateFilter = {};
    if (year && month) {
      const startDate = new Date(Number(year), Number(month), 1);
      const endDate = new Date(Number(year), Number(month) + 1, 0);
      dateFilter = {
        shift_date: {
          gte: startDate,
          lte: endDate,
        },
      };
    }

    const futureSchedules = await prisma.d_tblfuture_schedule.findMany({
      where: {
        user_id: userId,
        ...dateFilter,
      },
      include: {
        D_tblactivity: {
          select: {
            activity_id: true,
            activity_code: true,
            activity_name: true,
            is_billable: true,
          },
        },
      },
      orderBy: [
        { shift_date: "asc" },
        { start_time: "asc" },
      ],
    });

    // Format the response
    const formatted = futureSchedules.map((schedule) => ({
      fts_id: schedule.fts_id,
      user_id: schedule.user_id,
      activity_id: schedule.activity_id,
      activity_name: schedule.D_tblactivity?.activity_name,
      activity_code: schedule.D_tblactivity?.activity_code,
      is_billable: schedule.D_tblactivity?.is_billable,
      shift_date: schedule.shift_date?.toISOString().split("T")[0],
      start_time: formatTimeField(schedule.start_time),
      end_time: formatTimeField(schedule.end_time),
      created_at: schedule.created_at,
    }));

    return NextResponse.json({ schedules: formatted });
  } catch (error) {
    console.error("Get future schedules error:", error);
    return NextResponse.json(
      { message: "Failed to get future schedules" },
      { status: 500 }
    );
  }
}

// POST: Create a new future scheduled activity
export async function POST(req: Request) {
  try {
    const user = await getUserFromCookie();
    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { activity_id, shift_date, start_time, end_time } = body;

    // Validate required fields
    if (!activity_id || !shift_date || !start_time || !end_time) {
      return NextResponse.json(
        { message: "Missing required fields: activity_id, shift_date, start_time, end_time" },
        { status: 400 }
      );
    }

    // Validate activity exists and is active
    const activity = await prisma.d_tblactivity.findFirst({
      where: {
        activity_id: Number(activity_id),
        is_active: true,
      },
    });

    if (!activity) {
      return NextResponse.json(
        { message: "Activity not found or inactive" },
        { status: 400 }
      );
    }

    // Parse the shift_date
    const scheduledDate = new Date(shift_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Ensure the date is in the future
    if (scheduledDate < today) {
      return NextResponse.json(
        { message: "Cannot schedule activities in the past" },
        { status: 400 }
      );
    }

    // Get the user's weekly schedule to validate shift times
    const weeklySchedule = await prisma.d_tblweekly_schedule.findFirst({
      where: {
        user_id: user.user_id,
        is_active: true,
      },
    });

    if (!weeklySchedule) {
      return NextResponse.json(
        { message: "No active schedule found for user" },
        { status: 400 }
      );
    }

    // Get the shift for the specific day of week
    const dayOfWeek = scheduledDate.getDay();
    let shiftId: number | null = null;
    
    switch (dayOfWeek) {
      case 0: shiftId = weeklySchedule.sunday_shift_id; break;
      case 1: shiftId = weeklySchedule.monday_shift_id; break;
      case 2: shiftId = weeklySchedule.tuesday_shift_id; break;
      case 3: shiftId = weeklySchedule.wednesday_shift_id; break;
      case 4: shiftId = weeklySchedule.thursday_shift_id; break;
      case 5: shiftId = weeklySchedule.friday_shift_id; break;
      case 6: shiftId = weeklySchedule.saturday_shift_id; break;
    }

    if (!shiftId) {
      return NextResponse.json(
        { message: "No shift scheduled for this day" },
        { status: 400 }
      );
    }

    // Get the shift template to validate times
    const shiftTemplate = await prisma.d_tblshift_template.findUnique({
      where: { shift_id: shiftId },
    });

    if (!shiftTemplate) {
      return NextResponse.json(
        { message: "Shift template not found" },
        { status: 400 }
      );
    }

    // Parse times for validation
    const [startHour, startMin] = start_time.split(":").map(Number);
    const [endHour, endMin] = end_time.split(":").map(Number);
    
    const shiftStartHour = shiftTemplate.start_time?.getUTCHours() ?? 0;
    const shiftStartMin = shiftTemplate.start_time?.getUTCMinutes() ?? 0;
    const shiftEndHour = shiftTemplate.end_time?.getUTCHours() ?? 23;
    const shiftEndMin = shiftTemplate.end_time?.getUTCMinutes() ?? 59;

    // Convert to minutes for easier comparison
    const activityStart = startHour * 60 + startMin;
    const activityEnd = endHour * 60 + endMin;
    const shiftStart = shiftStartHour * 60 + shiftStartMin;
    const shiftEnd = shiftEndHour * 60 + shiftEndMin;

    // Validate start time is before end time
    if (activityStart >= activityEnd) {
      return NextResponse.json(
        { message: "Start time must be before end time" },
        { status: 400 }
      );
    }

    // Validate activity times are within shift times
    if (activityStart < shiftStart || activityEnd > shiftEnd) {
      const shiftStartStr = `${String(shiftStartHour).padStart(2, "0")}:${String(shiftStartMin).padStart(2, "0")}`;
      const shiftEndStr = `${String(shiftEndHour).padStart(2, "0")}:${String(shiftEndMin).padStart(2, "0")}`;
      return NextResponse.json(
        { message: `Activity time must be within shift hours (${shiftStartStr} - ${shiftEndStr})` },
        { status: 400 }
      );
    }

    // Create the future schedule entry
    const newSchedule = await prisma.d_tblfuture_schedule.create({
      data: {
        user_id: user.user_id,
        activity_id: Number(activity_id),
        shift_date: scheduledDate,
        start_time: parseTimeString(start_time),
        end_time: parseTimeString(end_time),
        created_by: user.user_id,
      },
      include: {
        D_tblactivity: {
          select: {
            activity_name: true,
            activity_code: true,
          },
        },
      },
    });

    return NextResponse.json({
      message: "Future activity scheduled successfully",
      schedule: {
        fts_id: newSchedule.fts_id,
        activity_name: newSchedule.D_tblactivity?.activity_name,
        shift_date: newSchedule.shift_date?.toISOString().split("T")[0],
        start_time: formatTimeField(newSchedule.start_time),
        end_time: formatTimeField(newSchedule.end_time),
      },
    });
  } catch (error) {
    console.error("Create future schedule error:", error);
    return NextResponse.json(
      { message: "Failed to create future schedule" },
      { status: 500 }
    );
  }
}

// DELETE: Remove a future scheduled activity
export async function DELETE(req: Request) {
  try {
    const user = await getUserFromCookie();
    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const ftsId = searchParams.get("fts_id");

    if (!ftsId) {
      return NextResponse.json(
        { message: "Missing fts_id parameter" },
        { status: 400 }
      );
    }

    // Verify the schedule belongs to the user
    const existingSchedule = await prisma.d_tblfuture_schedule.findFirst({
      where: {
        fts_id: Number(ftsId),
        user_id: user.user_id,
      },
    });

    if (!existingSchedule) {
      return NextResponse.json(
        { message: "Future schedule not found or unauthorized" },
        { status: 404 }
      );
    }

    // Delete the schedule
    await prisma.d_tblfuture_schedule.delete({
      where: { fts_id: Number(ftsId) },
    });

    return NextResponse.json({ message: "Future schedule deleted successfully" });
  } catch (error) {
    console.error("Delete future schedule error:", error);
    return NextResponse.json(
      { message: "Failed to delete future schedule" },
      { status: 500 }
    );
  }
}
