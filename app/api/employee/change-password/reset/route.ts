import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromCookie } from "@/lib/auth";
import { recoveryCookieName, verifyRecoveryToken } from "@/lib/recoverySession";

const EMOJI_RE = /[\p{Extended_Pictographic}\uFE0F\u200D]/gu;

function validatePassword(pw: string): string | null {
    if (!pw || pw.length < 8) return "Password must be at least 8 characters";
    if (pw.length > 30) return "Password must be at most 30 characters";
    if (EMOJI_RE.test(pw)) return "Password must not contain emojis";
    if (!/[A-Z]/.test(pw)) return "Password must contain at least one uppercase letter";
    if (!/[a-z]/.test(pw)) return "Password must contain at least one lowercase letter";
    if (!/[0-9]/.test(pw)) return "Password must contain at least one number";
    return null;
}

export async function POST(request: Request) {
    try {
        const user = await getUserFromCookie();
        if (!user?.user_id) {
            return NextResponse.json({ message: "UNAUTHORIZED" }, { status: 401 });
        }

        // Verify recovery token
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

        if (!newPassword) {
            return NextResponse.json({ message: "PASSWORD_REQUIRED" }, { status: 400 });
        }

        const validationError = validatePassword(newPassword);
        if (validationError) {
            return NextResponse.json({ message: validationError }, { status: 400 });
        }

        const userId = user.user_id;

        await prisma.d_tbluser_authentication.update({
            where: { user_id: userId },
            data: {
                password_hash: newPassword,
                question_attempts: 0,
            },
        });

        // Clear recovery cookie
        const res = NextResponse.json({ message: "OK" });
        res.cookies.set(recoveryCookieName(), "", {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            path: "/",
            maxAge: 0,
        });

        return res;
    } catch (error) {
        console.error("Employee Reset-Password Error:", error);
        return NextResponse.json({ message: "REQUEST_FAILED" }, { status: 500 });
    }
}
