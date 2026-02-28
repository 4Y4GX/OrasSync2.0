"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../../login/Login.module.css";
import AuthShell from "../../components/AuthShell";
import { ArrowLeft } from "lucide-react";
import { isPlausibleEmail, normalizeIdentifier, removeEmojis } from "@/lib/zeroTrustValidation";

export default function ForgotPasswordPage() {
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [username, setUsername] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showSuccessSubtitle, setShowSuccessSubtitle] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [verified, setVerified] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendSent, setResendSent] = useState(false);

  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // ✅ If recovery session exists, don't allow returning to OTP screen
  useEffect(() => {
    let cancelled = false;

    const checkSession = async () => {
      try {
        const res = await fetch("/api/auth/recovery/session", { method: "GET" });
        if (!cancelled && res.ok) {
          router.replace("/auth/reset-password");
        }
      } catch {
        // ignore (zero trust)
      }
    };

    checkSession();
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const emailOk = useMemo(() => isPlausibleEmail(username), [username]);

  // ✅ Zero-trust field errors (no format hints)
  const identifierError = useMemo(() => {
    return "";
  }, []);

  const canSendOtp = emailOk && !loading;

  const handleSendOtp = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError("");
    setMessage("");

    // ✅ Only set REQUEST FAILED on submit, not on click/focus
    if (!emailOk) {
      setError("REQUEST FAILED");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/otp/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizeIdentifier(username) }),
      });

      if (res.ok) {
        setCountdown(90);
        setShowSuccessSubtitle(true);
        setTimeout(() => setShowSuccessSubtitle(false), 4000);
        setSentSuccess(true);
        setOtp(["", "", "", "", "", ""]);
        setTimeout(() => {
          setSentSuccess(false);
          setStep(2);
          setTimeout(() => otpRefs.current[0]?.focus(), 100);
        }, 1500);
      } else {
        setError("REQUEST FAILED");
      }
    } catch {
      setError("REQUEST FAILED");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    const code = otp.join("");
    if (code.length < 6) return;

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: normalizeIdentifier(username),
          otp: code,
          flow: "recovery",
        }),
      });

      if (res.ok) {
        setVerified(true); // Lock inputs
        setMessage("VERIFICATION SUCCESSFUL");
        // setOtp(["", "", "", "", "", ""]); // Keep OTP visible for "success" feel? Or clear? User likely prefers seeing it.
        // setUsername(""); // Keep username for context if needed, or clear. safely clearing might be better for sec, but user exp wise keeping it is fine.

        setTimeout(() => {
          router.push("/auth/reset-password");
        }, 1500);
        return;
      }

      // keep it generic
      setOtp(["", "", "", "", "", ""]);
      setError("VERIFICATION FAILED");
      otpRefs.current[0]?.focus();
    } catch {
      setOtp(["", "", "", "", "", ""]);
      setError("VERIFICATION FAILED");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (countdown > 0 || resending) return;
    setError("");
    setResending(true);
    try {
      const res = await fetch("/api/auth/otp/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizeIdentifier(username) }),
      });
      if (res.ok) {
        setCountdown(90);
        setOtp(["", "", "", "", "", ""]);
        setResendSent(true);
        setTimeout(() => {
          setResendSent(false);
          otpRefs.current[0]?.focus();
        }, 1500);
      } else {
        setError("RESEND FAILED");
      }
    } catch {
      setError("RESEND FAILED");
    } finally {
      setResending(false);
    }
  };

  const handleOtpChange = (index: number, rawValue: string) => {
    if (error) setError("");
    const clean = removeEmojis(rawValue).replace(/\D/g, "");

    if (clean.length > 1) {
      const paste = clean.slice(0, 6).split("");
      const newOtp = [...otp];
      paste.forEach((char, i) => {
        if (index + i < 6) newOtp[index + i] = char;
      });
      setOtp(newOtp);
      otpRefs.current[Math.min(index + paste.length, 5)]?.focus();
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = clean.slice(-1);
    setOtp(newOtp);

    if (clean && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (error) setError("");
    if (e.key === "Backspace") {
      e.preventDefault();
      const newOtp = [...otp];

      if (newOtp[index]) {
        newOtp[index] = "";
        setOtp(newOtp);
        return;
      }

      if (index > 0) {
        newOtp[index - 1] = "";
        setOtp(newOtp);
        otpRefs.current[index - 1]?.focus();
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (otp.join("").length === 6) {
        handleVerifyOtp();
      }
    }

    if (e.key === "ArrowLeft" && index > 0) otpRefs.current[index - 1]?.focus();
    if (e.key === "ArrowRight" && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (error) setError("");
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!text) return;

    const chars = text.split("");
    const newOtp = ["", "", "", "", "", ""];
    chars.forEach((c, i) => {
      if (i < 6) newOtp[i] = c;
    });
    setOtp(newOtp);
    otpRefs.current[Math.min(chars.length, 5)]?.focus();
  };

  return (
    <AuthShell
      headerTag="SECURE RECOVERY"
      title={step === 1 ? "RECOVERY" : "VERIFICATION"}
      subtitle={
        step === 1 ? (
          "REQUEST A VERIFICATION CODE."
        ) : (
          "ENTER THE 6-DIGIT CODE SENT TO YOUR REGISTERED CONTACT."
        )
      }
      error={step === 1 ? error : null}
      message={step === 1 ? message : null}
      errorOffset={step === 2 ? "-34px" : undefined}
    >

      {step === 1 && (
        <div className={`${styles.formContainer} ${styles.visibleForm}`}>
          <form onSubmit={handleSendOtp}>
            <div className={styles.inputGroup}>
              <label className={styles.label}>USERNAME</label>
              <input
                type="text"
                className={styles.input}
                placeholder="ENTER USERNAME"
                value={username}
                onChange={(e) => {
                  setError("");
                  setMessage("");
                  setUsername(removeEmojis(e.target.value));
                }}
                onFocus={() => {
                  // ✅ clicking the input should NOT throw REQUEST FAILED
                  if (error) setError("");
                }}
                required
                autoFocus
              />
              {identifierError && (
                <div style={{ marginTop: 8, color: "#ff5b5b", fontSize: "0.82rem" }}>{identifierError}</div>
              )}
            </div>

            <button
              type="submit"
              className={styles.submitBtn}
              disabled={!canSendOtp}
              style={sentSuccess ? {
                background: "#16a34a",
                borderColor: "#15803d",
                boxShadow: "0 0 18px rgba(34,197,94,0.4)",
                color: "#fff",
                transition: "all 0.3s ease"
              } : {}}
            >
              {sentSuccess ? "✓ VERIFICATION SENT" : loading ? "SENDING..." : "SEND VERIFICATION CODE"}
            </button>

            <div
              className={styles.forgotPass}
              style={{
                textAlign: "center",
                marginTop: "15px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
              }}
              onClick={() => router.push("/login")}
            >
              <ArrowLeft size={16} /> BACK TO LOGIN
            </div>
          </form>
        </div>
      )}

      {step === 2 && (
        <div className={`${styles.formContainer} ${styles.visibleForm}`}>
          <div className={styles.otpGrid}>
            {otp.map((digit, idx) => (
              <input
                key={idx}
                ref={(el) => {
                  otpRefs.current[idx] = el;
                }}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={1}
                className={styles.otpBox}
                value={digit}
                onChange={(e) => handleOtpChange(idx, e.target.value)}
                onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                onPaste={handleOtpPaste}
                disabled={verified}
              />
            ))}
          </div>

          <div className={styles.resendWrapper}>
            <span>{countdown > 0 ? `RESEND IN ${countdown}s` : "CODE EXPIRED?"}</span>
            <span
              className={`${styles.resendBtn} ${countdown === 0 && !resending && !resendSent ? styles.active : ""}`}
              onClick={handleResendOtp}
              style={resendSent ? { color: "#52ff9b", opacity: 1, pointerEvents: "none" } : resending ? { opacity: 0.6, pointerEvents: "none" } : {}}
            >
              {resending ? "RESENDING OTP..." : resendSent ? "✓ CODE SENT" : "RESEND OTP"}
            </span>
          </div>

          <button
            type="button"
            className={`${styles.submitBtn} ${error && step === 2 ? styles.errorBtn : verified ? styles.successBtn : ""}`}
            onClick={handleVerifyOtp}
            disabled={loading || verified || (!!error && step === 2)}
          >
            {error && step === 2 ? error : verified ? "✓ SUCCESS!" : loading ? "VERIFYING..." : "VERIFY CODE"}
          </button>

          <div
            className={styles.forgotPass}
            style={{ textAlign: "center", marginTop: "15px" }}
            onClick={() => {
              setStep(1);
              setMessage("");
              setError("");
            }}
          >
            CHANGE USERNAME
          </div>
        </div>
      )}
    </AuthShell>
  );
}
