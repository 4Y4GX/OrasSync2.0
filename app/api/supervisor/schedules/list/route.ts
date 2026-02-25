// app/api/supervisor/schedules/list/route.ts
import { NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await getUserFromCookie();
    if (!user || (user.role_id !== 2 && user.role_id !== 3 && user.role_id !== 4)) {
      return NextResponse.json({ message: "Unauthorized. Supervisor access required." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("user_id");

    if (userId) {
      const schedule = await prisma.d_tblweekly_schedule.findFirst({
        where: {
          user_id: userId,
          is_active: true,
        },
        include: {
          D_tbluser: {
            select: {
              user_id: true,
              first_name: true,
              last_name: true,
              email: true,
            },
          },
          D_tblshift_template_D_tblweekly_schedule_monday_shift_idToD_tblshift_template: true,
          D_tblshift_template_D_tblweekly_schedule_tuesday_shift_idToD_tblshift_template: true,
          D_tblshift_template_D_tblweekly_schedule_wednesday_shift_idToD_tblshift_template: true,
          D_tblshift_template_D_tblweekly_schedule_thursday_shift_idToD_tblshift_template: true,
          D_tblshift_template_D_tblweekly_schedule_friday_shift_idToD_tblshift_template: true,
          D_tblshift_template_D_tblweekly_schedule_saturday_shift_idToD_tblshift_template: true,
          D_tblshift_template_D_tblweekly_schedule_sunday_shift_idToD_tblshift_template: true,
        },
      });

      return NextResponse.json({ schedule });
    }

    let teamMembers;

    if (user.role_id === 4 || user.role_id === 2) {
      teamMembers = await prisma.d_tbluser.findMany({
        where: {
          supervisor_id: user.user_id,
          account_status: "ACTIVE",
        },
        select: {
          user_id: true,
          first_name: true,
          last_name: true,
          email: true,
          D_tbldepartment: {
            select: { dept_name: true },
          },
          D_tblteam: {
            select: { team_name: true },
          },
          D_tblweekly_schedule: {
            where: { is_active: true },
            include: {
              D_tblshift_template_D_tblweekly_schedule_monday_shift_idToD_tblshift_template: true,
              D_tblshift_template_D_tblweekly_schedule_tuesday_shift_idToD_tblshift_template: true,
              D_tblshift_template_D_tblweekly_schedule_wednesday_shift_idToD_tblshift_template: true,
              D_tblshift_template_D_tblweekly_schedule_thursday_shift_idToD_tblshift_template: true,
              D_tblshift_template_D_tblweekly_schedule_friday_shift_idToD_tblshift_template: true,
              D_tblshift_template_D_tblweekly_schedule_saturday_shift_idToD_tblshift_template: true,
              D_tblshift_template_D_tblweekly_schedule_sunday_shift_idToD_tblshift_template: true,
            },
          },
        },
      });
    } else {
      teamMembers = await prisma.d_tbluser.findMany({
        where: {
          account_status: "ACTIVE",
          role_id: 1, 
        },
        select: {
          user_id: true,
          first_name: true,
          last_name: true,
          email: true,
          D_tbldepartment: {
            select: { dept_name: true },
          },
          D_tblteam: {
            select: { team_name: true },
          },
          D_tblweekly_schedule: {
            where: { is_active: true },
            include: {
              D_tblshift_template_D_tblweekly_schedule_monday_shift_idToD_tblshift_template: true,
              D_tblshift_template_D_tblweekly_schedule_tuesday_shift_idToD_tblshift_template: true,
              D_tblshift_template_D_tblweekly_schedule_wednesday_shift_idToD_tblshift_template: true,
              D_tblshift_template_D_tblweekly_schedule_thursday_shift_idToD_tblshift_template: true,
              D_tblshift_template_D_tblweekly_schedule_friday_shift_idToD_tblshift_template: true,
              D_tblshift_template_D_tblweekly_schedule_saturday_shift_idToD_tblshift_template: true,
              D_tblshift_template_D_tblweekly_schedule_sunday_shift_idToD_tblshift_template: true,
            },
          },
        },
      });
    }

    return NextResponse.json({ teamMembers });
  } catch (error) {
    console.error("List schedules error:", error);
    return NextResponse.json({ message: "Failed to fetch schedules" }, { status: 500 });
  }
}