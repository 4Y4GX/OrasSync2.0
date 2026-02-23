import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromCookie } from "@/lib/auth";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

// 1. GET: Check status
export async function GET() {
  const user = await getUserFromCookie();
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const active = await prisma.d_tblclock_log.findFirst({
    where: { 
      user_id: user.user_id, 
      active_key: "ACTIVE" 
    },
    select: { clock_in_time: true }
  });

  return NextResponse.json({ 
    isClockedIn: !!active, 
    startTime: active?.clock_in_time || null 
  });
}

// 2. POST: Start Session
export async function POST() {
  const user = await getUserFromCookie();
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const roleId = Number(user.role_id);
  if (roleId !== 5 && roleId !== 4) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const now = new Date();
  const shiftDate = startOfDay(now);
  
  // ✅ FIX: Use a safe "Placeholder" date that MySQL won't reject.
  // We use a date far in the past but clearly valid: 2000-01-01
  const PLACEHOLDER_DATE = new Date("2000-01-01T00:00:00.000Z");

  try {
    // Zombie Cleanup
    await prisma.d_tblclock_log.updateMany({
      where: { user_id: user.user_id, active_key: "ACTIVE" },
      data: { active_key: null } 
    });

    const newLog = await prisma.d_tblclock_log.create({
      data: {
        user_id: user.user_id,
        shift_date: shiftDate,
        last_log_in: now,
        clock_in_time: now,
        
        // ✅ CHANGED: Using 2000-01-01 instead of 1970 to prevent MySQL "Incorrect datetime" error
        clock_out_time: PLACEHOLDER_DATE, 
        
        active_key: "ACTIVE", 
        is_sentiment_done: true, 
        is_early_leave: false
      }
    });

    return NextResponse.json({ success: true, startTime: newLog.clock_in_time });

  } catch (error: any) {
    console.error("Manager Clock In Error:", error);
    return NextResponse.json({ message: `Database Error: ${error.message}` }, { status: 500 });
  }
}