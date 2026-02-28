import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromCookie } from "@/lib/auth";
import {
    recoveryCookieName,
    verifyRecoveryToken,
    upgradeRecoveryTokenStage,
} from "@/lib/recoverySession";
import { verifySecurityAnswer, hashSecurityAnswer } from "@/lib/securityAnswer";

function getTokenFromRequest(request: Request) {
    const cookieHeader = request.headers.get("cookie") ?? "";
    const tokenMatch = cookieHeader
        .split(";")
        .map((s) => s.trim())
        .find((p) => p.startsWith(`${recoveryCookieName()}=`));
    return tokenMatch
        ? decodeURIComponent(tokenMatch.split("=").slice(1).join("="))
        : null;
}

// GET: Fetch a random security question
export async function GET(request: Request) {
    try {
        const user = await getUserFromCookie();
        if (!user?.user_id) {
            return NextResponse.json({ message: "UNAUTHORIZED" }, { status: 401 });
        }

        const token = getTokenFromRequest(request);
        const session = verifyRecoveryToken(token);

        if (!session?.userId || session.userId !== user.user_id) {
            return NextResponse.json({ message: "INVALID_SESSION" }, { status: 401 });
        }

        if (session.stage !== "OTP_VERIFIED") {
            return NextResponse.json({ message: "INVALID_STAGE" }, { status: 403 });
        }

        // Get all security answers for this user (with question text)
        const answers = await prisma.d_tbluser_security_answers.findMany({
            where: { user_id: user.user_id },
            include: { D_tblsecurity_questions: true },
        });

        if (!answers.length) {
            return NextResponse.json(
                { message: "NO_SECURITY_QUESTIONS" },
                { status: 404 }
            );
        }

        // Pick a random one
        const random = answers[Math.floor(Math.random() * answers.length)];

        return NextResponse.json({
            questionId: random.question_id,
            question: random.D_tblsecurity_questions?.question_text ?? "Unknown question",
        });
    } catch (error) {
        console.error("Employee Get-Question Error:", error);
        return NextResponse.json({ message: "REQUEST_FAILED" }, { status: 500 });
    }
}

// POST: Verify security question answer
export async function POST(request: Request) {
    try {
        const user = await getUserFromCookie();
        if (!user?.user_id) {
            return NextResponse.json({ message: "UNAUTHORIZED" }, { status: 401 });
        }

        const token = getTokenFromRequest(request);
        const session = verifyRecoveryToken(token);

        if (!session?.userId || session.userId !== user.user_id) {
            return NextResponse.json({ message: "INVALID_SESSION" }, { status: 401 });
        }

        // If already QUESTION_VERIFIED, allow idempotent OK
        if (session.stage === "QUESTION_VERIFIED") {
            return NextResponse.json({ message: "OK" });
        }

        if (session.stage !== "OTP_VERIFIED") {
            return NextResponse.json({ message: "INVALID_STAGE" }, { status: 403 });
        }

        const body = await request.json().catch(() => ({}));
        const { questionId, answer } = body as { questionId?: number; answer?: string };

        if (!questionId || typeof answer !== "string") {
            return NextResponse.json({ message: "INVALID_INPUT" }, { status: 400 });
        }

        const userId = user.user_id;

        const userAuth = await prisma.d_tbluser_authentication.findUnique({
            where: { user_id: userId },
            select: { question_attempts: true, is_disabled: true },
        });

        if (!userAuth) {
            return NextResponse.json({ message: "REQUEST_FAILED" }, { status: 400 });
        }

        const currentAttempts = userAuth.question_attempts ?? 0;

        // Already locked out
        if (currentAttempts >= 3) {
            return NextResponse.json(
                { message: "ACCOUNT_LOCKED", attempts: 3, maxAttempts: 3 },
                { status: 403 }
            );
        }

        // Get correct answer
        const correctAnswer = await prisma.d_tbluser_security_answers.findFirst({
            where: { user_id: userId, question_id: Number(questionId) },
            select: { answer_hash: true, answer_id: true },
        });

        if (!correctAnswer || !correctAnswer.answer_hash) {
            const nextAttempts = currentAttempts + 1;
            await prisma.d_tbluser_authentication.update({
                where: { user_id: userId },
                data: { question_attempts: nextAttempts },
            });
            return NextResponse.json(
                { message: "INCORRECT_ANSWER", attempts: nextAttempts, maxAttempts: 3 },
                { status: 401 }
            );
        }

        const { match: isCorrect, needsMigration } = await verifySecurityAnswer(answer, correctAnswer.answer_hash);

        if (!isCorrect) {
            const nextAttempts = currentAttempts + 1;

            await prisma.d_tbluser_authentication.update({
                where: { user_id: userId },
                data: { question_attempts: nextAttempts },
            });

            // 3 failed attempts → disable account
            if (nextAttempts >= 3) {
                await prisma.d_tbluser_authentication.update({
                    where: { user_id: userId },
                    data: { is_disabled: true },
                });

                // Create incident
                const dedupeKey = `SQ_LOCK_${userId}`;
                try {
                    const existing = await prisma.d_tblaccount_recovery_incident.findFirst({
                        where: { dedupe_key: dedupeKey, status: "OPEN" },
                        select: { incident_id: true },
                    });
                    if (!existing) {
                        await prisma.d_tblaccount_recovery_incident.create({
                            data: {
                                user_id: userId,
                                incident_type: "ACCOUNT_LOCKED_SECURITY_QUESTION_FAILURE",
                                status: "OPEN",
                                dedupe_key: dedupeKey,
                                created_at: new Date(),
                            },
                        });
                    }
                } catch { }

                // Clear session cookie to force logout
                const res = NextResponse.json(
                    { message: "ACCOUNT_DISABLED", attempts: 3, maxAttempts: 3 },
                    { status: 403 }
                );
                res.cookies.set("timea_session", "", {
                    httpOnly: true,
                    sameSite: "lax",
                    secure: process.env.NODE_ENV === "production",
                    path: "/",
                    maxAge: 0,
                });
                res.cookies.set(recoveryCookieName(), "", {
                    httpOnly: true,
                    sameSite: "lax",
                    secure: process.env.NODE_ENV === "production",
                    path: "/",
                    maxAge: 0,
                });
                return res;
            }

            return NextResponse.json(
                {
                    message: "INCORRECT_ANSWER",
                    attempts: nextAttempts,
                    maxAttempts: 3,
                },
                { status: 401 }
            );
        }

        // Correct answer — reset attempts
        await prisma.d_tbluser_authentication.update({
            where: { user_id: userId },
            data: { question_attempts: 0 },
        });

        // Migrate legacy plaintext answer to bcrypt hash
        if (needsMigration) {
            const hashed = await hashSecurityAnswer(answer);
            await prisma.d_tbluser_security_answers.update({
                where: { answer_id: correctAnswer.answer_id },
                data: { answer_hash: hashed },
            });
        }

        // Upgrade recovery token to QUESTION_VERIFIED
        const upgraded = upgradeRecoveryTokenStage(token, "QUESTION_VERIFIED");
        if (!upgraded) {
            return NextResponse.json({ message: "TOKEN_UPGRADE_FAILED" }, { status: 401 });
        }

        const res = NextResponse.json({ message: "OK" });
        res.cookies.set(recoveryCookieName(), upgraded, {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            path: "/",
            maxAge: 10 * 60,
        });

        return res;
    } catch (error) {
        console.error("Employee Verify-Question Error:", error);
        return NextResponse.json({ message: "REQUEST_FAILED" }, { status: 500 });
    }
}
