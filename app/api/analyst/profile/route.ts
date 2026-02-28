import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const sessionUser = await getUserFromCookie();
        if (!sessionUser) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        // Ensure the user is an analyst
        if (sessionUser.role_id !== 2) {
            return NextResponse.json({ message: "Forbidden: Analyst access only" }, { status: 403 });
        }

        const userId = sessionUser.user_id;

        // Fetch user profile
        const userProfile = await prisma.d_tbluser.findFirst({
            where: { user_id: userId },
            select: {
                user_id: true,
                first_name: true,
                last_name: true,
                D_tbldepartment: { select: { dept_name: true } },
                D_tblposition: { select: { pos_name: true } },
            },
        });

        if (!userProfile) {
            return NextResponse.json({ message: "User not found" }, { status: 404 });
        }

        const first = (userProfile.first_name ?? "").toString().trim();
        const last = (userProfile.last_name ?? "").toString().trim();
        const fullName = `${first}${last ? ` ${last}` : ""}`.trim() || null;

        const dept = userProfile.D_tbldepartment?.dept_name ?? null;
        const position = userProfile.D_tblposition?.pos_name ?? null;

        return NextResponse.json({
            userProfile: {
                user_id: userId,
                name: fullName,
                first_name: userProfile.first_name ?? null,
                last_name: userProfile.last_name ?? null,
                dept_name: dept,
                pos_name: position,
            },
        });
    } catch (error) {
        console.error("Get analyst profile error:", error);
        return NextResponse.json({ message: "Failed to fetch profile" }, { status: 500 });
    }
}
