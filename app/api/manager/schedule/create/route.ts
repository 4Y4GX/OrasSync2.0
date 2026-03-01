import { NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
    try {
        const user = await getUserFromCookie();
        if (!user || (user.role_id !== 5 && user.role_id !== 4)) {
            return NextResponse.json({ message: "Unauthorized. Manager access required." }, { status: 403 });
        }

        const body = await request.json();
        const {
            user_id,
            monday_shift_id,
            tuesday_shift_id,
            wednesday_shift_id,
            thursday_shift_id,
            friday_shift_id,
            saturday_shift_id,
            sunday_shift_id,
        } = body;

        if (!user_id) {
            return NextResponse.json({ message: "User ID is required" }, { status: 400 });
        }

        // Check if user exists
        const targetUser = await prisma.d_tbluser.findUnique({
            where: { user_id },
            select: { user_id: true, dept_id: true },
        });

        if (!targetUser) {
            return NextResponse.json({ message: "User not found" }, { status: 404 });
        }

        // Deactivate existing active schedules
        await prisma.d_tblweekly_schedule.updateMany({
            where: {
                user_id,
                is_active: true,
            },
            data: {
                is_active: false,
            },
        });

        // Create new schedule
        const newSchedule = await prisma.d_tblweekly_schedule.create({
            data: {
                user_id,
                monday_shift_id: monday_shift_id || null,
                tuesday_shift_id: tuesday_shift_id || null,
                wednesday_shift_id: wednesday_shift_id || null,
                thursday_shift_id: thursday_shift_id || null,
                friday_shift_id: friday_shift_id || null,
                saturday_shift_id: saturday_shift_id || null,
                sunday_shift_id: sunday_shift_id || null,
                is_active: true,
            },
        });

        // Create audit log
        await prisma.d_tblaudit_log.create({
            data: {
                changed_by: user.user_id,
                action_type: "CREATE_SCHEDULE",
                table_affected: "D_tblweekly_schedule",
                old_value: "N/A",
                new_value: `Created schedule by manager for user: ${user_id}`,
            },
        });

        return NextResponse.json({
            message: "Schedule created successfully",
            schedule: newSchedule,
        });
    } catch (error) {
        console.error("Create schedule error:", error);
        return NextResponse.json({ message: "Failed to create schedule" }, { status: 500 });
    }
}
