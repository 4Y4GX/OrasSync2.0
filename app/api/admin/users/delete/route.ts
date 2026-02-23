import { NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function DELETE(request: Request) {
  try {
    const user = await getUserFromCookie();
    // Validate Admin (Role 3)
    if (!user || user.role_id !== 3) {
      return NextResponse.json({ message: "Unauthorized." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const userIdToDelete = searchParams.get("user_id");

    if (!userIdToDelete) {
      return NextResponse.json({ message: "User ID is required" }, { status: 400 });
    }

    // SOFT DELETE TRANSACTION (With increased timeout)
    await prisma.$transaction(async (tx) => {
        // 1. Update User Status to DEACTIVATED
        await tx.d_tbluser.update({
            where: { user_id: userIdToDelete },
            data: { 
                account_status: "DEACTIVATED",
                resignation_date: new Date() 
            }
        });

        // 2. Disable Authentication (Prevent Login)
        try {
            await tx.d_tbluser_authentication.update({
                where: { user_id: userIdToDelete },
                data: { is_disabled: true }
            });
        } catch(e) {
            // Ignore if auth record doesn't exist
        }
    }, {
        maxWait: 5000, // Wait max 5s for a connection
        timeout: 10000 // Allow transaction to run for 10s (Fixes the crash)
    });

    // 3. Create Audit Log (Outside transaction for speed)
    await prisma.d_tblaudit_log.create({
        data: {
            changed_by: user.user_id,
            action_type: "SOFT_DELETE_USER",
            table_affected: "D_tbluser",
            old_value: `User ${userIdToDelete} was ACTIVE`,
            new_value: `User ${userIdToDelete} is now DEACTIVATED`,
        }
    });

    return NextResponse.json({ message: "User deactivated successfully" });

  } catch (error) {
    console.error("Delete error:", error);
    return NextResponse.json({ message: "Failed to deactivate user" }, { status: 500 });
  }
}