"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../../login/Login.module.css";
import AuthShell from "../../components/AuthShell";
import { Eye, EyeOff, CheckCircle } from "lucide-react";

// Aggressive Emoji Regex
const emojiRegex =
  /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2300}-\u{23FF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{1F1E0}-\u{1F1FF}]/gu;

interface Question {
  question_id: number;
  question_text: string;
}

// 15–20 chars only, must include upper+lower+number+symbol from: ! @ ? _ -
const STRONG_PASS_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@?_\-])[A-Za-z\d!@?_\-]{15,20}$/;

function maskEmail(email: string) {
  const at = email.indexOf("@");
  if (at <= 0) return "***";

  const local = email.slice(0, at);
  const domainFull = email.slice(at + 1);
  const dot = domainFull.lastIndexOf(".");

  const domain = dot > 0 ? domainFull.slice(0, dot) : domainFull;
  const tld = dot > 0 ? domainFull.slice(dot) : "";

  const localMasked =
    local.length <= 2 ? `${local[0] ?? ""}***` : `${local.slice(0, 2)}***`;
  const domainMasked = domain.length <= 1 ? `g***` : `${domain[0]}****`;

  return `${localMasked}@${domainMasked}${tld}`;
}

function passwordChecks(pw: string) {
  const lengthOk = pw.length >= 15 && pw.length <= 20;
  const upperOk = /[A-Z]/.test(pw);
  const lowerOk = /[a-z]/.test(pw);
  const numberOk = /\d/.test(pw);
  const symbolOk = /[!@?_\-]/.test(pw);
  const onlyAllowed = /^[A-Za-z\d!@?_\-]*$/.test(pw);

  return {
    lengthOk,
    upperOk,
    lowerOk,
    numberOk,
    symbolOk,
    onlyAllowed,
    strongOk: lengthOk && upperOk && lowerOk && numberOk && symbolOk && onlyAllowed,
  };
}

function stripEmojis(text: string) {
  return text.replace(emojiRegex, "");
}

function clampPasswordInput(raw: string) {
  // Keep your existing policy: no emojis, and hard-limit to 20 chars (UI enforcement)
  return stripEmojis(raw).slice(0, 20);
}

export default function ChangePasswordPage() {
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [shakeError, setShakeError] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [message, setMessage] = useState("");

  const [userId, setUserId] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);

  // STEP 1
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [otpSent, setOtpSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // STEP 2
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass1, setShowPass1] = useState(false);
  const [showPass2, setShowPass2] = useState(false);
  const [touchedPw, setTouchedPw] = useState(false);
  const [touchedConfirm, setTouchedConfirm] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  // Caps Lock (Step 2 only)
  const [capsOn1, setCapsOn1] = useState(false);
  const [capsOn2, setCapsOn2] = useState(false);

  // STEP 3
  const [q1, setQ1] = useState("");
  const [a1, setA1] = useState("");
  const [a1Confirm, setA1Confirm] = useState("");
  const [q2, setQ2] = useState("");
  const [a2, setA2] = useState("");
  const [a2Confirm, setA2Confirm] = useState("");
  const [q3, setQ3] = useState("");
  const [a3, setA3] = useState("");
  const [a3Confirm, setA3Confirm] = useState("");

  useEffect(() => {
    const tempId = localStorage.getItem("temp_user_id");
    const tempEmail = localStorage.getItem("temp_user_email");

    if (!tempId) {
      router.push("/login");
      return;
    }

    setUserId(tempId);
    if (tempEmail) setEmail(tempEmail);

    fetch("/api/auth/first-login")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setQuestions(data);
      })
      .catch(() => setError("FAILED TO LOAD SYSTEM DATA"));
  }, [router]);

  // STEP 4 Auto-Redirect
  useEffect(() => {
    if (step === 4) {
      const timer = setTimeout(() => {
        router.push("/login");
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [step, router]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const maskedEmail = useMemo(() => (email ? maskEmail(email) : ""), [email]);

  // --- realtime password status ---
  const checks = useMemo(() => passwordChecks(password), [password]);
  const passwordsMatch = useMemo(
    () => confirmPassword.length > 0 && password === confirmPassword,
    [password, confirmPassword]
  );

  const showPwFeedback = step === 2 && (touchedPw || touchedConfirm);

  const pwErrorText = useMemo(() => {
    if (!showPwFeedback) return "";
    if (password.length === 0) return "";

    if (!checks.onlyAllowed) return "ONLY THESE SYMBOLS ARE ALLOWED: ! @ ? _ -";
    if (!checks.lengthOk) return "PASSWORD MUST BE 15–20 CHARACTERS.";
    if (!checks.upperOk) return "ADD AT LEAST 1 UPPERCASE LETTER.";
    if (!checks.lowerOk) return "ADD AT LEAST 1 LOWERCASE LETTER.";
    if (!checks.numberOk) return "ADD AT LEAST 1 NUMBER.";
    if (!checks.symbolOk) return "ADD AT LEAST 1 SYMBOL: ! @ ? _ -";
    return "";
  }, [checks, showPwFeedback, password.length]);

  const confirmErrorText = useMemo(() => {
    if (!showPwFeedback) return "";
    if (!touchedConfirm) return "";
    if (confirmPassword.length === 0) return "";
    if (password !== confirmPassword) return "PASSWORDS DO NOT MATCH.";
    return "";
  }, [showPwFeedback, touchedConfirm, password, confirmPassword]);

  // --- OTP handlers ---
  const handleOtpChange = (index: number, value: string) => {
    const clean = stripEmojis(value).replace(/\D/g, "");

    if (clean.length > 1) {
      const pasteData = clean.slice(0, 6).split("");
      const newOtp = [...otp];
      pasteData.forEach((char, i) => {
        if (index + i < 6) newOtp[index + i] = char;
      });
      setOtp(newOtp);
      const nextIndex = Math.min(index + pasteData.length, 5);
      otpRefs.current[nextIndex]?.focus();
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = clean.slice(-1);
    setOtp(newOtp);

    if (clean && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (!otp[index] && index > 0) {
        const newOtp = [...otp];
        newOtp[index - 1] = "";
        setOtp(newOtp);
        otpRefs.current[index - 1]?.focus();
      } else {
        const newOtp = [...otp];
        newOtp[index] = "";
        setOtp(newOtp);
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      // Ensure all 6 digits are filled before auto-submitting
      if (otp.join("").length === 6) {
        handleVerifyOtp();
      }
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasteData = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6)
      .split("");
    const newOtp = [...otp];
    pasteData.forEach((char, i) => {
      if (i < 6) newOtp[i] = char;
    });
    setOtp(newOtp);
    const nextIndex = Math.min(pasteData.length, 5);
    otpRefs.current[nextIndex]?.focus();
  };

  // --- API ---
  const handleSendOtp = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setLoading(true);
    setLoading(true);
    setError("");
    setSuccess("");
    setMessage("");

    try {
      const res = await fetch("/api/auth/otp/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        setOtpSent(true);
        setCountdown(90);
        setMessage("VERIFICATION CODE SENT");
        setOtp(["", "", "", "", "", ""]);
        otpRefs.current[0]?.focus();
      } else {
        setError("REQUEST FAILED");
      }
    } catch {
      setError("CONNECTION ERROR");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    const code = otp.join("");
    if (code.length < 6) return;

    setLoading(true);
    setLoading(true);
    setError("");
    setSuccess("");
    setMessage("");

    try {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: code }),
      });

      const data = await res.json();

      if (res.ok) {
        if (data.userId && data.userId !== userId) {
          setError("SECURITY MISMATCH");
          setOtp(["", "", "", "", "", ""]);
          otpRefs.current[0]?.focus();
          return;
        }

        setSuccess("VERIFICATION SUCCESSFUL");
        setTimeout(() => {
          setStep(2);
          setOtp(["", "", "", "", "", ""]);
          setSuccess("");
        }, 1500);
      } else {
        setError("INVALID CODE");
        setOtp(["", "", "", "", "", ""]);
        otpRefs.current[0]?.focus();
      }
    } catch {
      setError("VERIFICATION FAILED");
      setOtp(["", "", "", "", "", ""]);
      otpRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordNext = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    setTouchedPw(true);
    setTouchedConfirm(true);

    if (password !== confirmPassword) {
      setError("PASSWORDS DO NOT MATCH");
      return;
    }

    if (!STRONG_PASS_REGEX.test(password)) {
      setError("PASSWORD MUST BE 15–20 CHARS WITH UPPER, LOWER, NUMBER, AND ! @ ? _ -");
      return;
    }

    setStep(3);
  };

  const triggerShake = () => {
    setShakeError(true);
    setTimeout(() => setShakeError(false), 400);
  };

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!q1 || !q2 || !q3) {
      setError("SELECT 3 QUESTIONS");
      triggerShake();
      return;
    }
    if (q1 === q2 || q1 === q3 || q2 === q3) {
      setError("SELECT UNIQUE QUESTIONS");
      triggerShake();
      return;
    }

    const A1 = a1.trim();
    const A2 = a2.trim();
    const A3 = a3.trim();
    const C1 = a1Confirm.trim();
    const C2 = a2Confirm.trim();
    const C3 = a3Confirm.trim();

    if (!A1 || !A2 || !A3 || !C1 || !C2 || !C3) {
      setError("ANSWER AND CONFIRM ALL");
      triggerShake();
      return;
    }
    if (A1 !== C1 || A2 !== C2 || A3 !== C3) {
      setError("ANSWERS DO NOT MATCH");
      triggerShake();
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/first-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          newPassword: password,
          securityAnswers: [
            { question_id: Number(q1), answer: A1 },
            { question_id: Number(q2), answer: A2 },
            { question_id: Number(q3), answer: A3 },
          ],
        }),
      });

      if (res.ok) {
        localStorage.removeItem("temp_user_id");
        localStorage.removeItem("temp_user_email");
        // Show confirmation screen instead of immediate redirect
        setStep(4);
      } else {
        const data = await res.json();
        setError(data.message || "SETUP FAILED");
        setStep(2);
        setLoading(false);
      }
    } catch {
      setError("CONNECTION ERROR");
      setLoading(false);
    }
  };

  const headerTitle =
    step === 1
      ? otpSent
        ? "VERIFICATION"
        : "VERIFY IDENTITY"
      : step === 2
        ? "NEW PASSWORD"
        : step === 4
          ? "COMPLETE"
          : "SECURITY SETUP";

  const headerSubtitle =
    step === 1
      ? otpSent
        ? "ENTER THE 6-DIGIT CODE SENT TO YOUR REGISTERED CONTACT."
        : "SEND A VERIFICATION CODE."
      : step === 2
        ? "CREATE A STRONG PASSWORD."
        : step === 4
          ? "SECURITY SETUP COMPLETE."
          : "SELECT 3 QUESTIONS FOR RECOVERY.";

  const canProceedPasswordStep = checks.strongOk && password === confirmPassword && confirmPassword.length > 0;

  // Caps lock helpers
  const syncCaps = (e: React.KeyboardEvent<HTMLInputElement>, which: 1 | 2) => {
    const on = e.getModifierState?.("CapsLock") ?? false;
    if (which === 1) setCapsOn1(on);
    else setCapsOn2(on);
  };

  const syncCapsFromNative = (ev: KeyboardEvent, which: 1 | 2) => {
    const on = (ev as any).getModifierState?.("CapsLock") ?? false;
    if (which === 1) setCapsOn1(on);
    else setCapsOn2(on);
  };

  const onPwFocus = (which: 1 | 2) => {
    const handler = (ev: KeyboardEvent) => syncCapsFromNative(ev, which);
    window.addEventListener("keydown", handler);
    window.addEventListener("keyup", handler);

    // best-effort re-check on focus (no keypress required)
    // some browsers don't expose caps state without key events, but this helps when they do
    try {
      const ev = new KeyboardEvent("keydown");
      syncCapsFromNative(ev, which);
    } catch {
      // ignore
    }

    return () => {
      window.removeEventListener("keydown", handler);
      window.removeEventListener("keyup", handler);
    };
  };

  // keep per-input listeners tidy
  const pwCleanupRef = useRef<null | (() => void)>(null);
  const cpwCleanupRef = useRef<null | (() => void)>(null);

  return (
    <AuthShell headerTag="FIRST TIME SETUP" title={headerTitle} subtitle={headerSubtitle} expandedMode={step === 3 && !isExiting}>
      {error && <div className="text-red-500 text-sm font-bold mb-4 text-center uppercase">{error}</div>}
      {message && !error && <div className="text-green-500 text-sm font-bold mb-4 text-center uppercase">{message}</div>}

      {/* STEP 1 */}
      {step === 1 && (
        <div className={`${styles.formContainer} ${styles.visibleForm}`}>
          {!otpSent ? (
            <form onSubmit={handleSendOtp}>
              <div className={styles.inputGroup}>
                <label className={styles.label}>REGISTERED EMAIL</label>
                <input
                  type="text"
                  className={styles.input}
                  value={maskedEmail || "—"}
                  readOnly
                  style={{ opacity: 0.85, cursor: "not-allowed" }}
                />
              </div>

              <button type="submit" className={styles.submitBtn} disabled={loading}>
                {loading ? "SENDING..." : "SEND VERIFICATION CODE"}
              </button>
            </form>
          ) : (
            <div>
              {success && (
                <div className="text-green-500 text-sm font-bold mb-4 text-center uppercase">
                  {success}
                </div>
              )}
              <div className={styles.otpGrid}>
                {otp.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => {
                      otpRefs.current[idx] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    className={styles.otpBox}
                    value={digit}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    onPaste={handleOtpPaste}
                    onFocus={(e) => e.currentTarget.select()}
                  />
                ))}
              </div>

              <div className={styles.resendWrapper}>
                <span>{countdown > 0 ? `RESEND IN ${countdown}s` : "CODE EXPIRED?"}</span>
                <span
                  className={`${styles.resendBtn} ${countdown === 0 ? styles.active : ""}`}
                  onClick={() => countdown === 0 && handleSendOtp()}
                >
                  RESEND OTP
                </span>
              </div>

              <button type="button" className={styles.submitBtn} onClick={handleVerifyOtp} disabled={loading}>
                {loading ? "VERIFYING..." : "VERIFY CODE"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* STEP 2: PASSWORD (realtime) */}
      {step === 2 && (
        <div className={`${styles.formContainer} ${styles.visibleForm}`}>
          <form onSubmit={handlePasswordNext}>
            <div className={styles.inputGroup}>
              <label className={styles.label}>NEW PASSWORD</label>

              <div className={styles.passwordWrapper}>
                <input
                  type={showPass1 ? "text" : "password"}
                  placeholder="15–20 CHARS"
                  className={styles.input}
                  value={password}
                  onChange={(e) => {
                    setTouchedPw(true);
                    setPassword(clampPasswordInput(e.target.value));
                  }}
                  onBlur={() => setTouchedPw(true)}
                  required
                  maxLength={20}

                  // ✅ DISABLE COPY/PASTE/CUT
                  onPaste={(e) => e.preventDefault()}
                  onCopy={(e) => e.preventDefault()}
                  onCut={(e) => e.preventDefault()}
                  onContextMenu={(e) => e.preventDefault()}

                  // Caps lock detection
                  onKeyDown={(e) => syncCaps(e, 1)}
                  onKeyUp={(e) => syncCaps(e, 1)}
                  onFocus={() => {
                    pwCleanupRef.current?.();
                    pwCleanupRef.current = onPwFocus(1);
                  }}
                  onBlurCapture={() => {
                    pwCleanupRef.current?.();
                    pwCleanupRef.current = null;
                  }}

                  autoComplete="new-password"
                  spellCheck={false}
                  autoCorrect="off"
                  autoCapitalize="off"
                />

                <button
                  type="button"
                  className={styles.eyeIcon}
                  onClick={() => setShowPass1((v) => !v)}
                  aria-label={showPass1 ? "Hide password" : "Show password"}
                >
                  {showPass1 ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {/* Caps Lock indicator (match the simple inline style used on your login page approach) */}
              {capsOn1 && (
                <div style={{ marginTop: 8, color: "var(--accent-orange)", fontSize: "0.82rem", fontWeight: 700 }}>
                  CAPS LOCK IS ON
                </div>
              )}

              {pwErrorText ? (
                <div style={{ marginTop: 8, color: "#ff5b5b", fontSize: "0.82rem", lineHeight: 1.35 }}>
                  {pwErrorText}
                </div>
              ) : (
                <div style={{ marginTop: 8, color: "var(--text-grey)", fontSize: "0.82rem", lineHeight: 1.35 }}>
                  15–20 chars only. Must include: uppercase, lowercase, number, and one symbol from: <b>! @ ? _ -</b>
                </div>
              )}

              {showPwFeedback && password.length > 0 && (
                <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div style={{ fontSize: "0.78rem", color: checks.lengthOk ? "#52ff9b" : "var(--text-grey)" }}>
                    • 15–20 chars
                  </div>
                  <div style={{ fontSize: "0.78rem", color: checks.upperOk ? "#52ff9b" : "var(--text-grey)" }}>
                    • Uppercase
                  </div>
                  <div style={{ fontSize: "0.78rem", color: checks.lowerOk ? "#52ff9b" : "var(--text-grey)" }}>
                    • Lowercase
                  </div>
                  <div style={{ fontSize: "0.78rem", color: checks.numberOk ? "#52ff9b" : "var(--text-grey)" }}>
                    • Number
                  </div>
                  <div style={{ fontSize: "0.78rem", color: checks.symbolOk ? "#52ff9b" : "var(--text-grey)" }}>
                    • Symbol (! @ ? _ -)
                  </div>
                  <div style={{ fontSize: "0.78rem", color: checks.onlyAllowed ? "#52ff9b" : "#ff5b5b" }}>
                    • Only allowed chars
                  </div>
                </div>
              )}
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.label}>CONFIRM PASSWORD</label>

              <div className={styles.passwordWrapper}>
                <input
                  type={showPass2 ? "text" : "password"}
                  placeholder="RETYPE PASSWORD"
                  className={styles.input}
                  value={confirmPassword}
                  onChange={(e) => {
                    setTouchedConfirm(true);
                    setConfirmPassword(clampPasswordInput(e.target.value));
                  }}
                  onBlur={() => setTouchedConfirm(true)}
                  required
                  maxLength={20}

                  // ✅ DISABLE COPY/PASTE/CUT
                  onPaste={(e) => e.preventDefault()}
                  onCopy={(e) => e.preventDefault()}
                  onCut={(e) => e.preventDefault()}
                  onContextMenu={(e) => e.preventDefault()}

                  // Caps lock detection
                  onKeyDown={(e) => syncCaps(e, 2)}
                  onKeyUp={(e) => syncCaps(e, 2)}
                  onFocus={() => {
                    cpwCleanupRef.current?.();
                    cpwCleanupRef.current = onPwFocus(2);
                  }}
                  onBlurCapture={() => {
                    cpwCleanupRef.current?.();
                    cpwCleanupRef.current = null;
                  }}

                  autoComplete="new-password"
                  spellCheck={false}
                  autoCorrect="off"
                  autoCapitalize="off"
                />

                <button
                  type="button"
                  className={styles.eyeIcon}
                  onClick={() => setShowPass2((v) => !v)}
                  aria-label={showPass2 ? "Hide password" : "Show password"}
                >
                  {showPass2 ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {capsOn2 && (
                <div style={{ marginTop: 8, color: "var(--accent-orange)", fontSize: "0.82rem", fontWeight: 700 }}>
                  CAPS LOCK IS ON
                </div>
              )}

              {confirmErrorText ? (
                <div style={{ marginTop: 8, color: "#ff5b5b", fontSize: "0.82rem" }}>{confirmErrorText}</div>
              ) : touchedConfirm && confirmPassword.length > 0 && passwordsMatch ? (
                <div style={{ marginTop: 8, color: "#52ff9b", fontSize: "0.82rem" }}>PASSWORDS MATCH</div>
              ) : null}
            </div>

            <button type="submit" className={styles.submitBtn} disabled={!canProceedPasswordStep}>
              NEXT &rarr;
            </button>
          </form>
        </div>
      )}

      {/* STEP 3 */}
      {step === 3 && (
        <div className={`${styles.formContainer} ${styles.visibleForm}`}>
          <form onSubmit={handleFinalSubmit}>
            <div className={styles.securityGrid}>
              <div className={styles.inputGroup}>
                <label className={styles.label}>QUESTION 1</label>
                <select className={`${styles.selectField} ${shakeError && (!q1 || q1 === q2 || q1 === q3) ? styles.shakeError : ""}`} value={q1} onChange={(e) => setQ1(e.target.value)}>
                  <option value="" disabled>
                    Select Question...
                  </option>
                  {questions.map((q) => (
                    <option key={q.question_id} value={q.question_id}>
                      {q.question_text}
                    </option>
                  ))}
                </select>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "10px" }}>
                  <input
                    type="text"
                    placeholder="Answer"
                    className={`${styles.input} ${shakeError && (!a1 || a1 !== a1Confirm) ? styles.shakeError : ""}`}
                    value={a1}
                    onChange={(e) => setA1(stripEmojis(e.target.value))}
                    style={{ borderColor: a1 && a1Confirm ? (a1 === a1Confirm ? "#10b981" : "#ef4444") : undefined }}
                    required
                  />
                  <input
                    type="text"
                    placeholder="Confirm"
                    className={`${styles.input} ${shakeError && (!a1Confirm || a1 !== a1Confirm) ? styles.shakeError : ""}`}
                    value={a1Confirm}
                    onChange={(e) => setA1Confirm(stripEmojis(e.target.value))}
                    style={{ borderColor: a1 && a1Confirm ? (a1 === a1Confirm ? "#10b981" : "#ef4444") : undefined }}
                    required
                  />
                </div>
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.label}>QUESTION 2</label>
                <select className={`${styles.selectField} ${shakeError && (!q2 || q2 === q1 || q2 === q3) ? styles.shakeError : ""}`} value={q2} onChange={(e) => setQ2(e.target.value)}>
                  <option value="" disabled>
                    Select Question...
                  </option>
                  {questions
                    .filter((q) => q.question_id !== Number(q1))
                    .map((q) => (
                      <option key={q.question_id} value={q.question_id}>
                        {q.question_text}
                      </option>
                    ))}
                </select>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "10px" }}>
                  <input
                    type="text"
                    placeholder="Answer"
                    className={`${styles.input} ${shakeError && (!a2 || a2 !== a2Confirm) ? styles.shakeError : ""}`}
                    value={a2}
                    onChange={(e) => setA2(stripEmojis(e.target.value))}
                    style={{ borderColor: a2 && a2Confirm ? (a2 === a2Confirm ? "#10b981" : "#ef4444") : undefined }}
                    required
                  />
                  <input
                    type="text"
                    placeholder="Confirm"
                    className={`${styles.input} ${shakeError && (!a2Confirm || a2 !== a2Confirm) ? styles.shakeError : ""}`}
                    value={a2Confirm}
                    onChange={(e) => setA2Confirm(stripEmojis(e.target.value))}
                    style={{ borderColor: a2 && a2Confirm ? (a2 === a2Confirm ? "#10b981" : "#ef4444") : undefined }}
                    required
                  />
                </div>
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.label}>QUESTION 3</label>
                <select className={`${styles.selectField} ${shakeError && (!q3 || q3 === q1 || q3 === q2) ? styles.shakeError : ""}`} value={q3} onChange={(e) => setQ3(e.target.value)}>
                  <option value="" disabled>
                    Select Question...
                  </option>
                  {questions
                    .filter((q) => q.question_id !== Number(q1) && q.question_id !== Number(q2))
                    .map((q) => (
                      <option key={q.question_id} value={q.question_id}>
                        {q.question_text}
                      </option>
                    ))}
                </select>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "10px" }}>
                  <input
                    type="text"
                    placeholder="Answer"
                    className={`${styles.input} ${shakeError && (!a3 || a3 !== a3Confirm) ? styles.shakeError : ""}`}
                    value={a3}
                    onChange={(e) => setA3(stripEmojis(e.target.value))}
                    style={{ borderColor: a3 && a3Confirm ? (a3 === a3Confirm ? "#10b981" : "#ef4444") : undefined }}
                    required
                  />
                  <input
                    type="text"
                    placeholder="Confirm"
                    className={`${styles.input} ${shakeError && (!a3Confirm || a3 !== a3Confirm) ? styles.shakeError : ""}`}
                    value={a3Confirm}
                    onChange={(e) => setA3Confirm(stripEmojis(e.target.value))}
                    style={{ borderColor: a3 && a3Confirm ? (a3 === a3Confirm ? "#10b981" : "#ef4444") : undefined }}
                    required
                  />
                </div>
              </div>

              <div className={styles.securityFooter}>
                <button type="submit" className={styles.submitBtn} disabled={loading}>
                  {loading ? "SAVING..." : "SAVE & CONTINUE"}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* STEP 4: SUCCESS */}
      {step === 4 && (
        <div className={`${styles.formContainer} ${styles.visibleForm}`}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              padding: "20px 0",
            }}
          >
            <CheckCircle size={64} color="var(--accent-orange)" style={{ marginBottom: 20 }} />
            <div style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: 10 }}>
              SECURITY SETUP HAS BEEN SET!
            </div>
            <div style={{ fontSize: "0.9rem", color: "var(--text-grey)" }}>
              REDIRECTING TO LOGIN...
            </div>


          </div>
        </div>
      )}
    </AuthShell>
  );
}
