import { NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
    recoveryCookieName,
    verifyRecoveryToken,
    upgradeRecoveryTokenStage,
} from "@/lib/recoverySession";
import { verifySecurityAnswer, hashSecurityAnswer } from "@/lib/securityAnswer";

export const dynamic = "force-dynamic";

function getRecoveryTokenFromRequest(request: Request) {
    const cookieHeader = request.headers.get("cookie") ?? "";
    const tokenMatch = cookieHeader
        .split(";")
        .map((s) => s.trim())
        .find((p) => p.startsWith(`${recoveryCookieName()}=`));
    return tokenMatch
        ? decodeURIComponent(tokenMatch.split("=").slice(1).join("="))
        : null;
}

// GET: Fetch a random security question for the user
export async function GET(request: Request) {
    try {
        const user = await getUserFromCookie();
        if (!user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const token = getRecoveryTokenFromRequest(request);
        const session = verifyRecoveryToken(token);

        if (!session?.userId || session.userId !== user.user_id) {
            return NextResponse.json({ message: "INVALID_SESSION" }, { status: 401 });
        }

        if (
            session.stage !== "OTP_VERIFIED" &&
            session.stage !== "QUESTION_VERIFIED"
        ) {
            return NextResponse.json({ message: "INVALID_STAGE" }, { status: 403 });
        }

        // Get all user's security answers with their questions
        const userAnswers = await prisma.d_tbluser_security_answers.findMany({
            where: { user_id: user.user_id },
            include: { D_tblsecurity_questions: true },
        });

        if (userAnswers.length === 0) {
            return NextResponse.json(
                { message: "NO_SECURITY_QUESTIONS" },
                { status: 403 }
            );
        }

        // Pick a random question
        const randomIndex = Math.floor(Math.random() * userAnswers.length);
        const selected = userAnswers[randomIndex];

        // Get current attempt count
        const auth = await prisma.d_tbluser_authentication.findUnique({
            where: { user_id: user.user_id },
            select: { question_attempts: true },
        });

        return NextResponse.json({
            question_id: selected.question_id,
            question_text:
                selected.D_tblsecurity_questions?.question_text ?? "Security Question",
            attempts: auth?.question_attempts ?? 0,
        });
    } catch (error) {
        console.error("Change password question GET error:", error);
        return NextResponse.json(
            { message: "Failed to fetch question" },
            { status: 500 }
        );
    }
}

// POST: Verify the security question answer
export async function POST(request: Request) {
    try {
        const user = await getUserFromCookie();
        if (!user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const token = getRecoveryTokenFromRequest(request);
        const session = verifyRecoveryToken(token);

        if (!session?.userId || session.userId !== user.user_id) {
            return NextResponse.json({ message: "INVALID_SESSION" }, { status: 401 });
        }

        if (session.stage !== "OTP_VERIFIED") {
            if (session.stage === "QUESTION_VERIFIED") {
                return NextResponse.json({ message: "ALREADY_VERIFIED" });
            }
            return NextResponse.json({ message: "INVALID_STAGE" }, { status: 403 });
        }

        const body = await request.json().catch(() => ({}));
        const { questionId, answer } = body as {
            questionId?: number;
            answer?: string;
        };

        if (!questionId || typeof answer !== "string") {
            return NextResponse.json(
                { message: "Missing question ID or answer" },
                { status: 400 }
            );
        }

        const userId = user.user_id;

        // Check current attempts
        const userAuth = await prisma.d_tbluser_authentication.findUnique({
            where: { user_id: userId },
            select: { question_attempts: true },
        });

        if (!userAuth) {
            return NextResponse.json(
                { message: "Auth record not found" },
                { status: 400 }
            );
        }

        const currentAttempts = userAuth.question_attempts ?? 0;

        if (currentAttempts >= 3) {
            return NextResponse.json(
                { message: "QUESTION_LOCKED", attempts: currentAttempts },
                { status: 403 }
            );
        }

        // Get the correct answer (bcrypt comparison with legacy plaintext migration)
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
                { message: "WRONG_ANSWER", attempts: nextAttempts },
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

            // If 3 failed attempts — disable account and force logout
            if (nextAttempts >= 3) {
                await prisma.d_tbluser_authentication.update({
                    where: { user_id: userId },
                    data: { is_disabled: true },
                });

                const res = NextResponse.json(
                    { message: "ACCOUNT_LOCKED", attempts: nextAttempts },
                    { status: 403 }
                );

                // Clear session cookies to force logout
                res.cookies.set("timea_session", "", {
                    path: "/",
                    maxAge: 0,
                });
                res.cookies.set(recoveryCookieName(), "", {
                    path: "/",
                    maxAge: 0,
                });

                return res;
            }

            return NextResponse.json(
                { message: "WRONG_ANSWER", attempts: nextAttempts },
                { status: 401 }
            );
        }

        // Correct answer — reset attempts and upgrade token
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

        const upgraded = upgradeRecoveryTokenStage(token, "QUESTION_VERIFIED");
        if (!upgraded) {
            return NextResponse.json(
                { message: "TOKEN_UPGRADE_FAILED" },
                { status: 500 }
            );
        }

        const res = NextResponse.json({ message: "QUESTION_VERIFIED" });
        res.cookies.set(recoveryCookieName(), upgraded, {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            path: "/",
            maxAge: 10 * 60,
        });

        return res;
    } catch (error) {
        console.error("Change password question POST error:", error);
        return NextResponse.json(
            { message: "Failed to verify answer" },
            { status: 500 }
        );
    }
}
