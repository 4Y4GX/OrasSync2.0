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

  const [error, setError] = useState("");
  const [lockedNotice, setLockedNotice] = useState(false);
  const [loading, setLoading] = useState(false);
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

  // ✅ Zero-trust field errors (no format hints)
  const idError = useMemo(() => {
    if (!touchedId) return "";
    if (identifier.trim().length === 0) return "INVALID CREDENTIALS";
    if (!emailOk) return "INVALID CREDENTIALS";
    return "";
  }, [touchedId, identifier, emailOk]);

  const pwError = useMemo(() => {
    if (!touchedPw) return "";
    if (password.length === 0) return "INVALID CREDENTIALS";
    return "";
  }, [touchedPw, password]);

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

    setLoading(true);

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

      if (res.status === 403 && data?.locked) {
        setLockedNotice(true);
        setPassword("");
        return;
      }

      if (!res.ok) {
        setError("INVALID CREDENTIALS");
        setPassword("");
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
      router.push(data.redirect);
    } catch {
      setError("CONNECTION ERROR");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell headerTag="SECURE LOGIN" title="LOGIN" subtitle="ENTER YOUR CREDENTIALS.">
      {error && <div className="text-red-500 text-sm font-bold mb-3 text-center uppercase">{error}</div>}

      {lockedNotice && (
        <div className="text-orange-400 text-sm font-bold mb-4 text-center uppercase">
          ACCOUNT LOCKED. PLEASE CONTACT YOUR ADMINISTRATOR, SUPERVISOR, OR MANAGER.
        </div>
      )}

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

          <button type="submit" className={styles.submitBtn} disabled={!canSubmit}>
            {loading ? "SIGNING IN..." : "LOGIN"}
          </button>
        </form>
      </div>
    </AuthShell >
  );
}
