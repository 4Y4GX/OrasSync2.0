// app/api/admin/users/delete/route.ts
import { NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function DELETE(request: Request) {
  try {
    const user = await getUserFromCookie();
    if (!user || user.role_id !== 4) {
      return NextResponse.json({ message: "Unauthorized. Admin access required." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const user_id = searchParams.get("user_id");

    if (!user_id) {
      return NextResponse.json({ message: "User ID is required" }, { status: 400 });
    }

    // Prevent self-deletion
    if (user_id === user.user_id) {
      return NextResponse.json({ message: "Cannot delete your own account" }, { status: 400 });
    }

    // Get existing user
    const existingUser = await prisma.d_tbluser.findUnique({
      where: { user_id },
    });

    if (!existingUser) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    // Soft delete by setting account status to DEACTIVATED
    const deletedUser = await prisma.d_tbluser.update({
      where: { user_id },
      data: {
        account_status: "DEACTIVATED",
        resignation_date: new Date(),
      },
    });

    // Disable authentication
    await prisma.d_tbluser_authentication.update({
      where: { user_id },
      data: {
        is_disabled: true,
      },
    });

    logAudit({
      type: "audit",
      event: "USER_DELETED",
      color: "red",
      data: {
        adminId: user.user_id,
        targetId: user_id,
        targetEmail: existingUser.email
      }
    });

    // Create audit log
    await prisma.d_tblaudit_log.create({
      data: {
        changed_by: user.user_id,
        action_type: "DELETE_USER",
        table_affected: "D_tbluser",
        old_value: JSON.stringify(existingUser),
        new_value: `User deactivated: ${user_id}`,
      },
    });

    return NextResponse.json({
      message: "User deactivated successfully",
      user: deletedUser,
    });
  } catch (error) {
    console.error("Delete user error:", error);
    return NextResponse.json({ message: "Failed to delete user" }, { status: 500 });
  }
}
