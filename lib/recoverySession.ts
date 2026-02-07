// src/lib/recoverySession.ts
import crypto from "crypto";

type Stage = "OTP_VERIFIED" | "QUESTION_VERIFIED";

type RecoveryPayload = {
  v: 1;
  userId: string;
  stage: Stage;
  iat: number; // issued at (unix seconds)
  exp: number; // expiry (unix seconds)
  nonce: string; // random
};

function base64url(input: Buffer | string) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64urlJson(obj: any) {
  return base64url(JSON.stringify(obj));
}

function sign(data: string, secret: string) {
  return base64url(crypto.createHmac("sha256", secret).update(data).digest());
}

function safeEqual(a: string, b: string) {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function getSecret() {
  const secret = process.env.RECOVERY_TOKEN_SECRET;
  if (!secret) {
    // Fail closed: don’t run without a secret
    throw new Error("Missing RECOVERY_TOKEN_SECRET");
  }
  return secret;
}

export function recoveryCookieName() {
  return "recovery_session";
}

export function createRecoveryToken(args: {
  userId: string;
  stage?: Stage;
  ttlSeconds?: number; // default 10 mins
}) {
  const stage: Stage = args.stage ?? "OTP_VERIFIED";
  const ttl = args.ttlSeconds ?? 10 * 60;

  const now = Math.floor(Date.now() / 1000);

  const payload: RecoveryPayload = {
    v: 1,
    userId: args.userId,
    stage,
    iat: now,
    exp: now + ttl,
    nonce: crypto.randomBytes(16).toString("hex"),
  };

  const header = { alg: "HS256", typ: "JWT" };

  const h = base64urlJson(header);
  const p = base64urlJson(payload);
  const data = `${h}.${p}`;

  const sig = sign(data, getSecret());
  return `${data}.${sig}`;
}

export function verifyRecoveryToken(token: string | null) {
  try {
    if (!token) return null;

    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [h, p, sig] = parts;
    const data = `${h}.${p}`;
    const expected = sign(data, getSecret());
    if (!safeEqual(sig, expected)) return null;

    const payloadJson = Buffer.from(p.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const payload = JSON.parse(payloadJson) as RecoveryPayload;

    if (!payload?.userId || !payload?.stage || !payload?.exp) return null;

    const now = Math.floor(Date.now() / 1000);
    if (now >= payload.exp) return null;

    // Validate stage values strictly
    if (payload.stage !== "OTP_VERIFIED" && payload.stage !== "QUESTION_VERIFIED") return null;

    return payload;
  } catch {
    return null;
  }
}

/**
 * Rotate the recovery cookie to a new stage (keeps same TTL window length, but reissues token).
 */
export function upgradeRecoveryTokenStage(token: string | null, newStage: Stage) {
  const session = verifyRecoveryToken(token);
  if (!session?.userId) return null;

  // Keep remaining time; if already near expiry, still ok.
  const now = Math.floor(Date.now() / 1000);
  const remaining = Math.max(30, session.exp - now); // at least 30s remaining
  return createRecoveryToken({ userId: session.userId, stage: newStage, ttlSeconds: remaining });
}
