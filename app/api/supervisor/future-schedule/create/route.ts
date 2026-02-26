import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromCookie } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const user = await getUserFromCookie();
    
    // Check if user is a Supervisor (role_id 4) or Manager (role_id 5/2 depending on your setup)
    if (!user || (user.role_id !== 4 && user.role_id !== 2)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    
    // Combine the date and time strings into valid JavaScript Date objects for Prisma
    const startDateTime = new Date(`${body.shift_date}T${body.start_time}:00`);
    const endDateTime = new Date(`${body.shift_date}T${body.end_time}:00`);

    // Push to the database
    const newActivity = await prisma.d_tblfuture_schedule.create({
      data: {
        user_id: body.user_id,
        activity_id: body.activity_id,
        shift_date: new Date(body.shift_date),
        start_time: startDateTime,
        end_time: endDateTime,
        created_by: user.user_id, // Captures who assigned the schedule
      }
    });

    // This will print directly in your VS Code terminal running the Next.js server
    console.log("✅ NEW ACTIVITY SAVED TO DATABASE:");
    console.log(newActivity);

    return NextResponse.json({ message: "Success", activity: newActivity }, { status: 201 });
  } catch (error) {
    console.error("Failed to create activity", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}