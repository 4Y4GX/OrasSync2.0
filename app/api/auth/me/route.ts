import { NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sessionUser = await getUserFromCookie();
    
    // Check if session exists
    if (!sessionUser || !sessionUser.user_id) {
      return NextResponse.json({ message: "Not logged in" }, { status: 401 });
    }
    
    // FETCH FULL USER DETAILS FROM DATABASE
    const dbUser = await prisma.d_tbluser.findUnique({
        where: { user_id: sessionUser.user_id },
        select: {
            user_id: true,
            first_name: true,
            last_name: true,
            role_id: true
        }
    });

    if (!dbUser) {
        return NextResponse.json({ message: "User not found in DB" }, { status: 404 });
    }
    
    // Return the safe database user to the frontend
    return NextResponse.json(dbUser);

  } catch (error) {
    console.error("Auth /me error:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}