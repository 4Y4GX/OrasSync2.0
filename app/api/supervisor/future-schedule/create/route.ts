import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromCookie } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const user = await getUserFromCookie();
    if (!user || (user.role_id !== 4 && user.role_id !== 3 && user.role_id !== 2)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    
    // Convert generic time string "09:00" to a valid DateTime for Prisma
    const startDateTime = new Date(`${body.shift_date}T${body.start_time}:00Z`);
    const endDateTime = new Date(`${body.shift_date}T${body.end_time}:00Z`);

    const newActivity = await prisma.d_tblfuture_schedule.create({
      data: {
        user_id: body.user_id,
        activity_id: body.activity_id,
        shift_date: new Date(body.shift_date),
        start_time: startDateTime,
        end_time: endDateTime
      }
    });

    return NextResponse.json({ message: "Success", activity: newActivity }, { status: 201 });
  } catch (error) {
    console.error("Failed to create activity", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}