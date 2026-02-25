// app/api/supervisor/settings/change-password/route.ts
import { NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";
import bcrypt from "bcrypt";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await getUserFromCookie();
    if (!user || user.role_id !== 2) {
      return NextResponse.json(
        { message: "Unauthorized. Supervisor access required." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { current_password, new_password } = body;

    // Validation
    if (!current_password || !new_password) {
      return NextResponse.json(
        { message: "Current password and new password are required" },
        { status: 400 }
      );
    }

    if (new_password.length < 8) {
      return NextResponse.json(
        { message: "New password must be at least 8 characters long" },
        { status: 400 }
      );
    }

    // Get user from database with password
    const dbUser = await prisma.d_tbluser.findUnique({
      where: { user_id: user.user_id },
      select: {
        user_id: true,
        password: true,
      },
    });

    if (!dbUser) {
      return NextResponse.json(
        { message: "User not found" },
        { status: 404 }
      );
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(
      current_password,
      dbUser.password
    );

    if (!isPasswordValid) {
      return NextResponse.json(
        { message: "Current password is incorrect" },
        { status: 401 }
      );
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(new_password, 10);

    // Update password
    await prisma.d_tbluser.update({
      where: { user_id: user.user_id },
      data: { password: hashedPassword },
    });

    // Create audit log
    await prisma.d_tblaudit_log.create({
      data: {
        changed_by: user.user_id,
        action_type: "CHANGE_PASSWORD",
        table_affected: "D_tbluser",
        old_value: "Password changed",
        new_value: "Password updated successfully",
      },
    });

    return NextResponse.json({
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Change password error:", error);
    return NextResponse.json(
      { message: "Failed to change password" },
      { status: 500 }
    );
  }
}