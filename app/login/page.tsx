"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./Login.module.css";
import AuthShell from "../components/AuthShell";
import { Eye, EyeOff } from "lucide-react";
import { isPlausibleEmail, normalizeIdentifier, removeEmojis } from "@/lib/zeroTrustValidation";

export default function LoginPage() {
  const router = useRouter();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  const [step, setStep] = useState(1);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [countdown, setCountdown] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [error, setError] = useState("");
  const [lockedNotice, setLockedNotice] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendSent, setResendSent] = useState(false);
  const [showPass, setShowPass] = useState(false);

  // touched states
  const [touchedId, setTouchedId] = useState(false);
  const [touchedPw, setTouchedPw] = useState(false);

  // ✅ caps lock indicator (persist state) + focus gate
  const [capsOn, setCapsOn] = useState(false);
  const [pwFocused, setPwFocused] = useState(false);
  const pwRef = useRef<HTMLInputElement | null>(null);

  const emailOk = useMemo(() => isPlausibleEmail(identifier), [identifier]);
  const canSubmit = emailOk && password.length > 0 && !loading;

  // ✅ Zero-trust field errors (only show upon form submission error)
  const idError = useMemo(() => {
    // We only show format errors if they tried to submit and the format is bad
    // Otherwise, we rely on the main `error` state from the API response
    return "";
  }, []);

  const pwError = useMemo(() => {
    return "";
  }, []);

  // ✅ Keep caps lock state updated globally.
  // This lets it show immediately when you re-focus the password field.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isOn = e.getModifierState?.("CapsLock") ?? false;
      setCapsOn(isOn);
    };

    window.addEventListener("keydown", handler);
    window.addEventListener("keyup", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      window.removeEventListener("keyup", handler);
    };
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

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
        handleLogin({ preventDefault: () => { } } as React.FormEvent);
      }
    }
    if (e.key === "ArrowLeft" && index > 0) otpRefs.current[index - 1]?.focus();
    if (e.key === "ArrowRight" && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
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

  const handleResendOtp = async () => {
    if (countdown > 0 || loading || resending) return;
    setError("");
    setResending(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: normalizeIdentifier(identifier),
          password: removeEmojis(password),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (data?.requiresOtp) {
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLockedNotice(false);

    // force validation visible
    setTouchedId(true);
    setTouchedPw(true);

    if (!emailOk || !password) {
      setError("INVALID CREDENTIALS");
      return;
    }

    if (step === 2 && otp.join("").length < 6) {
      setError("ENTER 6-DIGIT CODE");
      return;
    }

    setLoading(true);

    try {
      const payload: any = {
        email: normalizeIdentifier(identifier),
        password: removeEmojis(password),
      };
      if (step === 2) {
        payload.otp = otp.join("");
      }

      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 403 && data?.locked) {
        setLockedNotice(true);
        setPassword("");
        if (step === 2) { setOtp(["", "", "", "", "", ""]); setStep(1); }
        return;
      }

      if (!res.ok) {
        if (step === 2 && data?.message !== "OTP Required") {
          setError("INVALID CODE");
          setOtp(["", "", "", "", "", ""]);
          otpRefs.current[0]?.focus();
        } else {
          setError(data?.message?.toUpperCase() || "INVALID CREDENTIALS");
          setPassword("");
        }
        return;
      }

      if (data?.requiresOtp) {
        setStep(2);
        setCountdown(90);
        setTimeout(() => otpRefs.current[0]?.focus(), 50);
        return;
      }

      if (data?.isFirstLogin) {
        localStorage.setItem("temp_user_id", data.user.user_id);
        localStorage.setItem("temp_user_email", data.user.email ?? "");
        router.push("/auth/change-password");
        return;
      }

      localStorage.setItem("user_id", data.user.user_id);
      localStorage.setItem("user_name", data.user.name ?? "");
      console.log("LOGIN CLIENT DEBUG: Redirecting to:", data.redirect, "Role:", data.user.role_id);
      // ✅ Flash green success before redirect
      if (step === 2) {
        setVerified(true);
        setTimeout(() => router.push(data.redirect), 1200);
      } else {
        router.push(data.redirect);
      }
    } catch {
      setError("CONNECTION ERROR");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      headerTag={step === 1 ? "SECURE LOGIN" : "VERIFICATION"}
      title={step === 1 ? "LOGIN" : "VERIFY CODE"}
      subtitle={step === 1 ? "ENTER YOUR CREDENTIALS." : "ENTER THE 6-DIGIT OTP SENT TO YOUR CONTACT."}
      error={null}
      errorPosition="bottom"
      errorOffset={step === 1 ? "75px" : undefined}
    >

      {lockedNotice && (
        <div className="text-orange-400 text-sm font-bold mb-4 text-center uppercase">
          ACCOUNT LOCKED. PLEASE CONTACT YOUR ADMINISTRATOR, SUPERVISOR, OR MANAGER.
        </div>
      )}

      {step === 1 && (
        <div className={`${styles.formContainer} ${styles.visibleForm}`}>
          <form onSubmit={handleLogin}>
            {/* USERNAME */}
            <div className={styles.inputGroup}>
              <label className={styles.label}>USERNAME</label>

              <div className={styles.inputWrapper}>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="ENTER USERNAME"
                  value={identifier}
                  onChange={(e) => {
                    setError("");
                    setLockedNotice(false);
                    setIdentifier(removeEmojis(e.target.value));
                  }}
                  onFocus={() => setTouchedId(true)}
                  onBlur={() => setTouchedId(true)}
                  autoFocus
                  required
                />
              </div>

              {idError && <div style={{ marginTop: 8, color: "#ff5b5b", fontSize: "0.82rem" }}>{idError}</div>}
            </div>

            {/* PASSWORD */}
            <div className={styles.inputGroup}>
              <label className={styles.label}>PASSWORD</label>

              <div className={`${styles.passwordWrapper} ${styles.inputWrapper}`}>
                <input
                  ref={pwRef}
                  type={showPass ? "text" : "password"}
                  className={styles.input}
                  placeholder="........"
                  value={password}
                  onChange={(e) => {
                    setError("");
                    setLockedNotice(false);
                    setPassword(removeEmojis(e.target.value));
                  }}
                  onFocus={() => {
                    setTouchedPw(true);
                    setPwFocused(true);
                  }}
                  onBlur={() => {
                    setTouchedPw(true);
                    setPwFocused(false);
                  }}

                  // ✅ DISABLE PASTE/COPY/CUT + RIGHT CLICK MENU
                  onPaste={(e) => e.preventDefault()}
                  onCopy={(e) => e.preventDefault()}
                  onCut={(e) => e.preventDefault()}
                  onContextMenu={(e) => e.preventDefault()}

                  // ✅ OPTIONAL: also block drag/drop into the field
                  onDrop={(e) => e.preventDefault()}
                  onDragOver={(e) => e.preventDefault()}
                  required
                />

                <span className={styles.eyeIcon} onClick={() => setShowPass(!showPass)}>
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </span>
              </div>

              {/* ✅ Show immediately on refocus if caps is still on */}
              {pwFocused && capsOn && (
                <div style={{ marginTop: 8, color: "#ffb020", fontSize: "0.82rem", fontWeight: 700 }}>
                  CAPS LOCK IS ON
                </div>
              )}

              {pwError && <div style={{ marginTop: 8, color: "#ff5b5b", fontSize: "0.82rem" }}>{pwError}</div>}

              <div className={styles.forgotPass} onClick={() => router.push("/auth/forgot-password")}>
                Forgot Password?
              </div>
            </div>

            <button
              type="submit"
              className={`${styles.submitBtn} ${error && step === 1 ? styles.errorBtn : ""}`}
              disabled={!canSubmit && !error}
            >
              {error && step === 1 ? error : loading ? "SIGNING IN..." : "LOGIN"}
            </button>
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
                disabled={loading}
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
            onClick={handleLogin}
            disabled={loading || verified || (!!error && step === 2)}
          >
            {error && step === 2 ? error : verified ? "✓ SUCCESS!" : loading ? "VERIFYING..." : "VERIFY CODE"}
          </button>

          <div className={styles.forgotPass} style={{ textAlign: "center", marginTop: "15px" }} onClick={() => {
            setStep(1);
            setOtp(["", "", "", "", "", ""]);
          }}>
            BACK TO LOGIN
          </div>
        </div>
      )}
    </AuthShell >
  );
}
