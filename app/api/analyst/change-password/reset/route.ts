import { NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { recoveryCookieName, verifyRecoveryToken } from "@/lib/recoverySession";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
    try {
        const user = await getUserFromCookie();
        if (!user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        // Verify recovery token is at QUESTION_VERIFIED stage
        const cookieHeader = request.headers.get("cookie") ?? "";
        const tokenMatch = cookieHeader
            .split(";")
            .map((s) => s.trim())
            .find((p) => p.startsWith(`${recoveryCookieName()}=`));

        const token = tokenMatch
            ? decodeURIComponent(tokenMatch.split("=").slice(1).join("="))
            : null;
        const session = verifyRecoveryToken(token);

        if (!session?.userId || session.userId !== user.user_id) {
            return NextResponse.json({ message: "INVALID_SESSION" }, { status: 401 });
        }

        if (session.stage !== "QUESTION_VERIFIED") {
            return NextResponse.json({ message: "INVALID_STAGE" }, { status: 403 });
        }

        const body = await request.json().catch(() => ({}));
        const newPassword = (body as any)?.newPassword;

        if (!newPassword || typeof newPassword !== "string") {
            return NextResponse.json(
                { message: "Password is required" },
                { status: 400 }
            );
        }

        // Validate password format
        const password = newPassword.trim();

        if (password.length < 8 || password.length > 30) {
            return NextResponse.json(
                { message: "Password must be 8-30 characters" },
                { status: 400 }
            );
        }

        if (!/[A-Z]/.test(password)) {
            return NextResponse.json(
                { message: "Password must contain at least one uppercase letter" },
                { status: 400 }
            );
        }

        if (!/[a-z]/.test(password)) {
            return NextResponse.json(
                { message: "Password must contain at least one lowercase letter" },
                { status: 400 }
            );
        }

        if (!/[0-9]/.test(password)) {
            return NextResponse.json(
                { message: "Password must contain at least one number" },
                { status: 400 }
            );
        }

        // Check for emojis
        const emojiRegex =
            /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
        if (emojiRegex.test(password)) {
            return NextResponse.json(
                { message: "Password must not contain emojis" },
                { status: 400 }
            );
        }

        const userId = user.user_id;

        // Update password (plaintext as per user request)
        await prisma.d_tbluser_authentication.update({
            where: { user_id: userId },
            data: {
                password_hash: password,
                question_attempts: 0,
            },
        });

        // Clear recovery session cookie
        const res = NextResponse.json({ message: "PASSWORD_CHANGED" });
        res.cookies.set(recoveryCookieName(), "", {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            path: "/",
            maxAge: 0,
        });

        return res;
    } catch (error) {
        console.error("Change password reset error:", error);
        return NextResponse.json(
            { message: "Failed to change password" },
            { status: 500 }
        );
    }
}
