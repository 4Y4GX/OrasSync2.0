import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromCookie } from "@/lib/auth";

export async function GET() {
  const user = await getUserFromCookie();

  if (!user || (user.role_id !== 5 && user.role_id !== 4)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const managerData = await prisma.d_tbluser.findUnique({
      where: { user_id: user.user_id },
      select: { dept_id: true }
    });

    if (!managerData || !managerData.dept_id) {
      return NextResponse.json({ message: "Department not found for this user" }, { status: 400 });
    }

    // Fetch all employees in the department and their active weekly schedule template
    const employees = await prisma.d_tbluser.findMany({
      where: {
        dept_id: managerData.dept_id,
        role_id: { in: [1, 4] }
      },
      select: {
        user_id: true,
        first_name: true,
        last_name: true,
        role_id: true,
        D_tblweekly_schedule: {
          where: { is_active: true },
          take: 1,
          include: {
            // Prisma auto-generates these long relation names based on your schema
            D_tblshift_template_D_tblweekly_schedule_monday_shift_idToD_tblshift_template: true,
            D_tblshift_template_D_tblweekly_schedule_tuesday_shift_idToD_tblshift_template: true,
            D_tblshift_template_D_tblweekly_schedule_wednesday_shift_idToD_tblshift_template: true,
            D_tblshift_template_D_tblweekly_schedule_thursday_shift_idToD_tblshift_template: true,
            D_tblshift_template_D_tblweekly_schedule_friday_shift_idToD_tblshift_template: true,
            D_tblshift_template_D_tblweekly_schedule_saturday_shift_idToD_tblshift_template: true,
            D_tblshift_template_D_tblweekly_schedule_sunday_shift_idToD_tblshift_template: true,
          }
        }
      }
    });

    // Helper to format Prisma db.Time into a readable 12-hour format
    const formatTime = (dateObj: Date | null) => {
      if (!dateObj) return null;
      return new Date(dateObj).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
    };

    // Restructure the data so the frontend can easily loop through it by day
    const formattedSchedule = employees.map(emp => {
      const sched = emp.D_tblweekly_schedule[0];

      const getShiftData = (shiftRef: any) => {
        if (!shiftRef) return null; // Employee has the day off
        return {
          shift_name: shiftRef.shift_name,
          time: `${formatTime(shiftRef.start_time)} - ${formatTime(shiftRef.end_time)}`
        };
      };

      return {
        user_id: emp.user_id,
        name: `${emp.first_name} ${emp.last_name}`,
        role_id: emp.role_id,
        schedule: {
          monday: getShiftData(sched?.D_tblshift_template_D_tblweekly_schedule_monday_shift_idToD_tblshift_template),
          tuesday: getShiftData(sched?.D_tblshift_template_D_tblweekly_schedule_tuesday_shift_idToD_tblshift_template),
          wednesday: getShiftData(sched?.D_tblshift_template_D_tblweekly_schedule_wednesday_shift_idToD_tblshift_template),
          thursday: getShiftData(sched?.D_tblshift_template_D_tblweekly_schedule_thursday_shift_idToD_tblshift_template),
          friday: getShiftData(sched?.D_tblshift_template_D_tblweekly_schedule_friday_shift_idToD_tblshift_template),
          saturday: getShiftData(sched?.D_tblshift_template_D_tblweekly_schedule_saturday_shift_idToD_tblshift_template),
          sunday: getShiftData(sched?.D_tblshift_template_D_tblweekly_schedule_sunday_shift_idToD_tblshift_template),
        }
      };
    });

    return NextResponse.json({ schedule: formattedSchedule });

  } catch (error) {
    console.error("Schedule Fetch Error:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}