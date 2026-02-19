import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromCookie } from "@/lib/auth";

export async function GET(req: Request) {
    try {
        const user = await getUserFromCookie();

        if (!user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const userData = await prisma.d_tbluser.findUnique({
            where: { user_id: user.user_id },
            select: {
                first_name: true,
                last_name: true,
                role_id: true,
                email: true,
                pos_id: true,
                D_tblrole: {
                    select: { role_name: true }
                },
                D_tblposition: {
                    select: { pos_name: true }
                }
            }
        });

        if (!userData) {
            return NextResponse.json({ message: "User not found" }, { status: 404 });
        }

        return NextResponse.json({
            name: `${userData.first_name || ''} ${userData.last_name || ''}`.trim(),
            role: userData.D_tblrole?.role_name || "User",
            position: userData.D_tblposition?.pos_name || "Employee",
            initials: (userData.first_name?.[0] || "") + (userData.last_name?.[0] || "")
        });

    } catch (error: any) {
        console.error("USER_ME_ERROR:", error);
        return NextResponse.json(
            { message: "Failed to fetch user data" },
            { status: 500 }
        );
    }
}
