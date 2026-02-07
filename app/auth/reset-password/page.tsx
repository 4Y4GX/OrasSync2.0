"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../../login/Login.module.css";
import AuthShell from "../../components/AuthShell";
import { Eye, EyeOff, CheckCircle } from "lucide-react";
import { passwordChecks, removeEmojis, STRONG_PASS_REGEX } from "@/lib/zeroTrustValidation";

function clampPasswordInput(raw: string) {
  return removeEmojis(raw).slice(0, 20);
}

export default function ResetPasswordPage() {
  const router = useRouter();

  // ✅ start unknown so it won't render the wrong step first
  const [step, setStep] = useState<1 | 2 | 3 | null>(null);

  const [sessionLoading, setSessionLoading] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [question, setQuestion] = useState("");
  const [questionId, setQuestionId] = useState<number | null>(null);
  const [answer, setAnswer] = useState("");

  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  const [touchedPw, setTouchedPw] = useState(false);
  const [touchedConfirm, setTouchedConfirm] = useState(false);

  const [capsOn1, setCapsOn1] = useState(false);
  const [capsOn2, setCapsOn2] = useState(false);

  const didFetch = useRef(false);

  useEffect(() => {
    if (didFetch.current) return;
    didFetch.current = true;

    const loadSession = async () => {
      try {
        setSessionLoading(true);

        const res = await fetch("/api/auth/recovery/session", { method: "GET" });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          router.replace("/auth/forgot-password");
          return;
        }

        setQuestion(String(data.question_text ?? "SECURITY CHECK"));
        setQuestionId(Number(data.question_id));

        // ✅ set correct step before first render of the forms
        if (data?.stage === "QUESTION_VERIFIED") setStep(2);
        else setStep(1);
      } catch {
        router.replace("/auth/forgot-password");
      } finally {
        setSessionLoading(false);
      }
    };

    loadSession();
    loadSession();
  }, [router]);

  // ✅ Auto-Redirect for Step 3 (Success)
  useEffect(() => {
    if (step === 3) {
      const timer = setTimeout(() => {
        router.push("/login");
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [step, router]);

  // ✅ Auto-Redirect removed (Step 3 removed)

  const checks = useMemo(() => passwordChecks(newPass), [newPass]);
  const passwordsMatch = useMemo(
    () => confirmPass.length > 0 && newPass === confirmPass,
    [newPass, confirmPass]
  );

  const showPwFeedback = step === 2 && (touchedPw || touchedConfirm);

  const pwErrorText = useMemo(() => {
    if (!showPwFeedback) return "";
    if (newPass.length === 0) return "";

    if (!checks.onlyAllowed) return "ONLY THESE SYMBOLS ARE ALLOWED: ! @ ? _ -";
    if (!checks.lengthOk) return "PASSWORD MUST BE 15–20 CHARACTERS.";
    if (!checks.upperOk) return "ADD AT LEAST 1 UPPERCASE LETTER.";
    if (!checks.lowerOk) return "ADD AT LEAST 1 LOWERCASE LETTER.";
    if (!checks.numberOk) return "ADD AT LEAST 1 NUMBER.";
    if (!checks.symbolOk) return "ADD AT LEAST 1 SYMBOL: ! @ ? _ -";
    return "";
  }, [checks, showPwFeedback, newPass.length]);

  const confirmErrorText = useMemo(() => {
    if (!showPwFeedback) return "";
    if (!touchedConfirm) return "";
    if (confirmPass.length === 0) return "";
    if (newPass !== confirmPass) return "PASSWORDS DO NOT MATCH.";
    return "";
  }, [showPwFeedback, touchedConfirm, newPass, confirmPass]);

  const canSubmitNewPassword = checks.strongOk && passwordsMatch && !loading;

  const handleVerifyAnswer = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    // setSuccess("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/security-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId,
          answer: removeEmojis(answer),
        }),
      });

      if (res.ok) {
        setStep(2);
        setAnswer("");
      } else {
        setAnswer("");
        setError("VERIFICATION FAILED");
      }
    } catch {
      setAnswer("");
      setError("VERIFICATION FAILED");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    // setSuccess("");

    setTouchedPw(true);
    setTouchedConfirm(true);

    if (!STRONG_PASS_REGEX.test(removeEmojis(newPass)) || !passwordsMatch) {
      setError("REQUEST FAILED");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newPassword: removeEmojis(newPass),
        }),
      });

      if (res.ok) {
        // setSuccess("PASSWORD UPDATED"); // Removed
        setNewPass("");
        setConfirmPass("");
        setStep(3); // Show success screen
        // setTimeout(() => router.push("/login"), 1200); // Handled by useEffect now
      } else {
        setError("REQUEST FAILED");
      }
    } catch {
      setError("REQUEST FAILED");
    } finally {
      setLoading(false);
    }
  };

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

    try {
      const ev = new KeyboardEvent("keydown");
      syncCapsFromNative(ev, which);
    } catch { }

    return () => {
      window.removeEventListener("keydown", handler);
      window.removeEventListener("keyup", handler);
    };
  };

  const pwCleanupRef = useRef<null | (() => void)>(null);
  const cpwCleanupRef = useRef<null | (() => void)>(null);

  return (
    <AuthShell
      headerTag="SECURE RESET"
      title={step === 1 ? "SECURITY CHECK" : step === 2 ? "NEW PASSWORD" : "COMPLETE"}
      subtitle={
        step === 1
          ? "ANSWER THE SECURITY QUESTION."
          : step === 2
            ? "SET A NEW PASSWORD."
            : "PASSWORD RESET SUCCESSFUL."
      }
    >
      {/* ✅ Prevent the 1-second flash by not rendering forms until session is loaded */}
      {sessionLoading || step === null ? (
        <div className={`${styles.formContainer} ${styles.visibleForm}`}>
          <div style={{ textAlign: "center", opacity: 0.85, fontWeight: 700 }}>
            LOADING...
          </div>
        </div>
      ) : (
        <>
          {error && <div className="text-red-500 text-sm font-bold mb-4 text-center uppercase">{error}</div>}
          {success && <div className="text-green-500 text-sm font-bold mb-4 text-center uppercase">{success}</div>}

          {step === 1 && (
            <div className={`${styles.formContainer} ${styles.visibleForm}`}>
              <form onSubmit={handleVerifyAnswer}>
                <div className={styles.inputGroup}>
                  <label style={{ color: "var(--accent-orange)" }}>
                    {(question ? String(question) : "SECURITY CHECK").toUpperCase()}
                  </label>

                  <input
                    type="text"
                    className={styles.input}
                    placeholder="YOUR ANSWER"
                    value={answer}
                    onChange={(e) => setAnswer(removeEmojis(e.target.value))}
                    onBlur={() => {
                      if (answer.trim().length === 0) setError("REQUEST FAILED");
                    }}
                    onFocus={() => setError("")}
                    required
                  />
                </div>

                <button type="submit" className={styles.submitBtn} disabled={loading || !questionId}>
                  {loading ? "VERIFYING..." : "VERIFY ANSWER"}
                </button>
              </form>
            </div>
          )}

          {step === 2 && (
            <div className={`${styles.formContainer} ${styles.visibleForm}`}>
              <form onSubmit={handleResetPassword}>
                <div className={styles.inputGroup}>
                  <label className={styles.label}>NEW PASSWORD</label>

                  <div className={styles.passwordWrapper}>
                    <input
                      type={showPass ? "text" : "password"}
                      placeholder="15–20 CHARS"
                      className={styles.input}
                      value={newPass}
                      onChange={(e) => {
                        setTouchedPw(true);
                        setNewPass(clampPasswordInput(e.target.value));
                      }}
                      onBlur={() => setTouchedPw(true)}
                      required
                      maxLength={20}
                      onPaste={(e) => e.preventDefault()}
                      onCopy={(e) => e.preventDefault()}
                      onCut={(e) => e.preventDefault()}
                      onContextMenu={(e) => e.preventDefault()}
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
                      onClick={() => setShowPass((v) => !v)}
                      aria-label={showPass ? "Hide password" : "Show password"}
                    >
                      {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>

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

                  {showPwFeedback && newPass.length > 0 && (
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
                      type={showConfirmPass ? "text" : "password"}
                      placeholder="RETYPE PASSWORD"
                      className={styles.input}
                      value={confirmPass}
                      onChange={(e) => {
                        setTouchedConfirm(true);
                        setConfirmPass(clampPasswordInput(e.target.value));
                      }}
                      onBlur={() => setTouchedConfirm(true)}
                      required
                      maxLength={20}
                      onPaste={(e) => e.preventDefault()}
                      onCopy={(e) => e.preventDefault()}
                      onCut={(e) => e.preventDefault()}
                      onContextMenu={(e) => e.preventDefault()}
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
                      onClick={() => setShowConfirmPass((v) => !v)}
                      aria-label={showConfirmPass ? "Hide password" : "Show password"}
                    >
                      {showConfirmPass ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>

                  {capsOn2 && (
                    <div style={{ marginTop: 8, color: "var(--accent-orange)", fontSize: "0.82rem", fontWeight: 700 }}>
                      CAPS LOCK IS ON
                    </div>
                  )}

                  {confirmErrorText ? (
                    <div style={{ marginTop: 8, color: "#ff5b5b", fontSize: "0.82rem" }}>{confirmErrorText}</div>
                  ) : touchedConfirm && confirmPass.length > 0 && passwordsMatch ? (
                    <div style={{ marginTop: 8, color: "#52ff9b", fontSize: "0.82rem" }}>PASSWORDS MATCH</div>
                  ) : null}
                </div>

                <button type="submit" className={styles.submitBtn} disabled={!canSubmitNewPassword}>
                  {loading ? "UPDATING..." : "UPDATE PASSWORD"}
                </button>
              </form>
            </div>
          )}


        </>
      )}

      {step === 3 && (
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
              PASSWORD RESET COMPLETE
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
