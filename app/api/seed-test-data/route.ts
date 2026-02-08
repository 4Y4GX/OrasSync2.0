import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Seed test data for OraSync
 * Creates shift templates, schedules, and activities
 */
export async function POST() {
  try {
    // 1. Create Shift Templates
    const morningShift = await prisma.d_tblshift_template.upsert({
      where: { shift_id: 1 },
      update: {},
      create: {
        shift_id: 1,
        shift_name: "Morning Shift",
        start_time: new Date("2024-01-01T09:00:00"),
        end_time: new Date("2024-01-01T17:00:00"),
        description: "Regular 9 AM - 5 PM shift"
      }
    });

    const afternoonShift = await prisma.d_tblshift_template.upsert({
      where: { shift_id: 2 },
      update: {},
      create: {
        shift_id: 2,
        shift_name: "Afternoon Shift",
        start_time: new Date("2024-01-01T13:00:00"),
        end_time: new Date("2024-01-01T21:00:00"),
        description: "Regular 1 PM - 9 PM shift"
      }
    });

    const nightShift = await prisma.d_tblshift_template.upsert({
      where: { shift_id: 3 },
      update: {},
      create: {
        shift_id: 3,
        shift_name: "Night Shift",
        start_time: new Date("2024-01-01T22:00:00"),
        end_time: new Date("2024-01-02T06:00:00"),
        description: "Regular 10 PM - 6 AM shift"
      }
    });

    // 2. Create Activities
    await prisma.d_tblactivity.createMany({
      data: [
        { activity_id: 1, activity_code: "DEV", activity_name: "Development", is_billable: true },
        { activity_id: 2, activity_code: "MEET", activity_name: "Meeting", is_billable: true },
        { activity_id: 3, activity_code: "TEST", activity_name: "Testing", is_billable: true },
        { activity_id: 4, activity_code: "DOC", activity_name: "Documentation", is_billable: true },
        { activity_id: 5, activity_code: "EMAIL", activity_name: "Email", is_billable: false },
        { activity_id: 6, activity_code: "BREAK", activity_name: "Break", is_billable: false },
        { activity_id: 7, activity_code: "TRAIN", activity_name: "Training", is_billable: false },
      ],
      skipDuplicates: true
    });

    // 3. Find all employees (role_id = 1)
    const employees = await prisma.d_tbluser.findMany({
      where: { 
        role_id: 1,
        account_status: 'ACTIVE'
      }
    });

    // 4. Create schedules for all employees
    let schedulesCreated = 0;
    for (const employee of employees) {
      // Check if employee already has an active schedule
      const existingSchedule = await prisma.d_tblweekly_schedule.findFirst({
        where: {
          user_id: employee.user_id,
          is_active: true
        }
      });

      if (!existingSchedule) {
        // Create weekly schedule (Monday-Friday: Morning Shift, Weekend: Off)
        await prisma.d_tblweekly_schedule.create({
          data: {
            user_id: employee.user_id,
            monday_shift_id: 1,    // Morning Shift
            tuesday_shift_id: 1,   // Morning Shift
            wednesday_shift_id: 1, // Morning Shift
            thursday_shift_id: 1,  // Morning Shift
            friday_shift_id: 1,    // Morning Shift
            saturday_shift_id: null, // Off
            sunday_shift_id: null,   // Off
            is_active: true
          }
        });
        schedulesCreated++;
      }
    }

    return NextResponse.json({
      success: true,
      message: "Test data seeded successfully",
      data: {
        shiftTemplates: 3,
        activities: 7,
        employeesProcessed: employees.length,
        schedulesCreated
      }
    });

  } catch (error: any) {
    console.error("Seed error:", error);
    return NextResponse.json(
      { 
        success: false,
        message: "Error seeding test data", 
        error: error.message 
      }, 
      { status: 500 }
    );
  }
}
