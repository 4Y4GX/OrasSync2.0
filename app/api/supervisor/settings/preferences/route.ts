// app/api/supervisor/settings/preferences/route.ts
import { NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET preferences
export async function GET() {
  try {
    const user = await getUserFromCookie();
    if (!user || user.role_id !== 2) {
      return NextResponse.json(
        { message: "Unauthorized. Supervisor access required." },
        { status: 403 }
      );
    }

    // Get user preferences
    const preferences = await prisma.d_tbluser_preferences.findUnique({
      where: { user_id: user.user_id },
    });

    // If no preferences exist, return defaults
    if (!preferences) {
      return NextResponse.json({
        email_notifications: true,
        in_app_notifications: true,
        theme_locked: false,
        auto_approve_threshold: null,
      });
    }

    return NextResponse.json({
      email_notifications: preferences.email_notifications ?? true,
      in_app_notifications: preferences.in_app_notifications ?? true,
      theme_locked: preferences.theme_locked ?? false,
      auto_approve_threshold: preferences.auto_approve_threshold,
    });
  } catch (error) {
    console.error("Get preferences error:", error);
    return NextResponse.json(
      { message: "Failed to fetch preferences" },
      { status: 500 }
    );
  }
}

// UPDATE preferences
export async function PUT(request: Request) {
  try {
    const user = await getUserFromCookie();
    if (!user || user.role_id !== 2) {
      return NextResponse.json(
        { message: "Unauthorized. Supervisor access required." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      email_notifications,
      in_app_notifications,
      theme_locked,
      auto_approve_threshold,
    } = body;

    // Upsert preferences (update if exists, create if not)
    const updatedPreferences = await prisma.d_tbluser_preferences.upsert({
      where: { user_id: user.user_id },
      update: {
        email_notifications:
          email_notifications !== undefined
            ? email_notifications
            : undefined,
        in_app_notifications:
          in_app_notifications !== undefined
            ? in_app_notifications
            : undefined,
        theme_locked: theme_locked !== undefined ? theme_locked : undefined,
        auto_approve_threshold:
          auto_approve_threshold !== undefined
            ? auto_approve_threshold
            : undefined,
      },
      create: {
        user_id: user.user_id,
        email_notifications: email_notifications ?? true,
        in_app_notifications: in_app_notifications ?? true,
        theme_locked: theme_locked ?? false,
        auto_approve_threshold: auto_approve_threshold ?? null,
      },
    });

    // Create audit log
    await prisma.d_tblaudit_log.create({
      data: {
        changed_by: user.user_id,
        action_type: "UPDATE_PREFERENCES",
        table_affected: "D_tbluser_preferences",
        old_value: "Preferences updated",
        new_value: JSON.stringify(updatedPreferences),
      },
    });

    return NextResponse.json({
      message: "Preferences updated successfully",
      preferences: updatedPreferences,
    });
  } catch (error) {
    console.error("Update preferences error:", error);
    return NextResponse.json(
      { message: "Failed to update preferences" },
      { status: 500 }
    );
  }
}