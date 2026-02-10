import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromCookie } from "@/lib/auth";

export async function POST(req: Request) {
  const user = await getUserFromCookie();
  if (!user || (user.role_id !== 5 && user.role_id !== 4)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { targetUserId, date, startTime, endTime, task } = body;

    if (!targetUserId || !date || !startTime || !endTime) {
      return NextResponse.json({ message: "Missing fields" }, { status: 400 });
    }

    // 1. Convert Date to Day of Week (0=Sun, 1=Mon, etc.)
    const scheduleDate = new Date(date);
    const dayIndex = scheduleDate.getDay(); 

    // 2. Create a specific "Task Shift" Template
    // We store the "Task" in the description field
    const newShift = await prisma.d_tblshift_template.create({
      data: {
        shift_name: "Manager Override",
        start_time: new Date(`${date}T${startTime}:00`),
        end_time: new Date(`${date}T${endTime}:00`),
        description: task || "Manager Assigned Task", 
      }
    });

    // 3. Find or Create the Weekly Schedule for this User
    // Note: In your current schema, schedules are Weekly. 
    // This override will apply to this day of the week moving forward.
    const weeklySchedule = await prisma.d_tblweekly_schedule.upsert({
      where: { 
        // We need a unique way to find it. Since there's no unique(user_id) in schema, 
        // we use findFirst logic or rely on ID. 
        // Ideally, D_tblweekly_schedule should have @unique([user_id]).
        // Assuming user_id is unique enough for this logic:
        schedule_id: 0 // Placeholder, see update logic below
      },
      create: {
        user_id: targetUserId,
        is_active: true,
        // Set the specific day
        monday_shift_id: dayIndex === 1 ? newShift.shift_id : null,
        tuesday_shift_id: dayIndex === 2 ? newShift.shift_id : null,
        wednesday_shift_id: dayIndex === 3 ? newShift.shift_id : null,
        thursday_shift_id: dayIndex === 4 ? newShift.shift_id : null,
        friday_shift_id: dayIndex === 5 ? newShift.shift_id : null,
        saturday_shift_id: dayIndex === 6 ? newShift.shift_id : null,
        sunday_shift_id: dayIndex === 0 ? newShift.shift_id : null,
      },
      update: {
        // Dynamically update the correct column based on dayIndex
        monday_shift_id: dayIndex === 1 ? newShift.shift_id : undefined,
        tuesday_shift_id: dayIndex === 2 ? newShift.shift_id : undefined,
        wednesday_shift_id: dayIndex === 3 ? newShift.shift_id : undefined,
        thursday_shift_id: dayIndex === 4 ? newShift.shift_id : undefined,
        friday_shift_id: dayIndex === 5 ? newShift.shift_id : undefined,
        saturday_shift_id: dayIndex === 6 ? newShift.shift_id : undefined,
        sunday_shift_id: dayIndex === 0 ? newShift.shift_id : undefined,
      }
    });
    
    // WORKAROUND: Because `upsert` needs a unique constraint that might be missing on user_id
    // We use updateMany as a fallback if upsert fails or logic is complex
    const existing = await prisma.d_tblweekly_schedule.findFirst({ where: { user_id: targetUserId }});
    if (existing) {
       const updateData: any = {};
       if (dayIndex === 1) updateData.monday_shift_id = newShift.shift_id;
       if (dayIndex === 2) updateData.tuesday_shift_id = newShift.shift_id;
       if (dayIndex === 3) updateData.wednesday_shift_id = newShift.shift_id;
       if (dayIndex === 4) updateData.thursday_shift_id = newShift.shift_id;
       if (dayIndex === 5) updateData.friday_shift_id = newShift.shift_id;
       if (dayIndex === 6) updateData.saturday_shift_id = newShift.shift_id;
       if (dayIndex === 0) updateData.sunday_shift_id = newShift.shift_id;
       
       await prisma.d_tblweekly_schedule.update({
         where: { schedule_id: existing.schedule_id },
         data: updateData
       });
    }

    return NextResponse.json({ success: true, shift: newShift });

  } catch (error) {
    console.error("Assign Error:", error);
    return NextResponse.json({ message: "Failed to assign schedule" }, { status: 500 });
  }
}