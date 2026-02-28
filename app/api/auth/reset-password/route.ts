import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { recoveryCookieName, verifyRecoveryToken } from "@/lib/recoverySession";
import { hashPassword } from "@/lib/password";

export async function POST(request: Request) {
  try {
    const cookieHeader = request.headers.get("cookie") ?? "";
    const tokenMatch = cookieHeader
      .split(";")
      .map((s) => s.trim())
      .find((p) => p.startsWith(`${recoveryCookieName()}=`));

    const token = tokenMatch ? decodeURIComponent(tokenMatch.split("=").slice(1).join("=")) : null;
    const session = verifyRecoveryToken(token);

    if (!session?.userId) {
      return NextResponse.json({ message: "REQUEST FAILED" }, { status: 401 });
    }

    // ✅ must have passed security question in THIS recovery session
    if (session.stage !== "QUESTION_VERIFIED") {
      return NextResponse.json({ message: "REQUEST FAILED" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const newPassword = body?.newPassword;

    if (!newPassword) {
      return NextResponse.json({ message: "REQUEST FAILED" }, { status: 400 });
    }

    const userId = session.userId;

    const userAuth = await prisma.d_tbluser_authentication.findUnique({
      where: { user_id: userId },
      select: { user_id: true },
    });

    if (!userAuth) {
      return NextResponse.json({ message: "REQUEST FAILED" }, { status: 400 });
    }

    const hashedPassword = await hashPassword(newPassword);
    await prisma.d_tbluser_authentication.update({
      where: { user_id: userId },
      data: {
        password_hash: hashedPassword,
        failed_attempts: 0,
        is_disabled: false,
        last_failed_attempt: null,
        // keep question_attempts as-is or reset — safe to reset:
        question_attempts: 0,
      },
    });

    const res = NextResponse.json({ message: "OK" }, { status: 200 });

    // ✅ clear recovery session cookie after successful reset
    res.cookies.set(recoveryCookieName(), "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });

    return res;
  } catch (error) {
    console.error("Error resetting password:", error);
    return NextResponse.json({ message: "REQUEST FAILED" }, { status: 500 });
  }
}
