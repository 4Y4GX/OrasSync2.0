import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromCookie } from "@/lib/auth";

export async function POST() {
    const user = await getUserFromCookie();
    if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const now = new Date();

    try {
        // 1. Find the active session using the KEY
        const active = await prisma.d_tblclock_log.findFirst({
            where: {
                user_id: user.user_id,
                active_key: "ACTIVE"
            }
        });

        if (!active) {
            return NextResponse.json({ message: "No active session found." }, { status: 400 });
        }

        // 2. Update with REAL clock out time
        await prisma.d_tblclock_log.update({
            where: { clock_id: active.clock_id },
            data: {
                clock_out_time: now, // Overwrite the placeholder with real time
                active_key: null     // Unlock the session
            }
        });

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error("Supervisor Clock Out Error:", error);
        return NextResponse.json({ message: "Database Update Failed" }, { status: 500 });
    }
}
