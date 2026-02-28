"use client";

import { ReactNode, useEffect, useState } from "react";
import styles from "../login/Login.module.css";
import { Moon, Sun } from "lucide-react";

type AuthShellProps = {
  headerTag: string;
  title?: ReactNode;
  subtitle?: ReactNode;
  expandedMode?: boolean;
  error?: string | null;
  message?: string | null;
  errorOffset?: string;
  errorPosition?: "top" | "bottom";
  children: ReactNode;
};

const THEME_KEY = "orasync_theme"; // "light" | "dark"

let globalHasMounted = false;
let globalIsLightMode = false;
let globalClock = "";

export default function AuthShell({
  headerTag,
  title,
  subtitle,
  expandedMode = false,
  error,
  message,
  errorOffset,
  errorPosition = "top",
  children,
}: AuthShellProps) {
  const [clock, setClock] = useState(() => {
    if (globalHasMounted && typeof window !== "undefined") {
      return new Date().toLocaleTimeString();
    }
    return globalClock;
  });
  const [isLightMode, setIsLightMode] = useState(() => {
    if (globalHasMounted && typeof window !== "undefined") {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved) return saved === "light";
      return window.matchMedia?.("(prefers-color-scheme: light)")?.matches ?? false;
    }
    return globalIsLightMode;
  });
  /* Anti-spam toggle state */
  const [isToggling, setIsToggling] = useState(false);

  // Debounced toggle handler
  const handleThemeToggle = () => {
    if (isToggling) return;
    setIsToggling(true);
    setIsLightMode((prev) => {
      const next = !prev;
      globalIsLightMode = next;
      try {
        localStorage.setItem(THEME_KEY, next ? "light" : "dark");
      } catch { }
      return next;
    });
    // Cooldown matches the CSS transition (approx 600ms)
    setTimeout(() => setIsToggling(false), 600);
  };

  const [mounted, setMounted] = useState(globalHasMounted);

  // Clock
  useEffect(() => {
    const updateTime = () => {
      const t = new Date().toLocaleTimeString();
      setClock(t);
      globalClock = t;
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Load theme once on mount
  useEffect(() => {
    if (globalHasMounted) return;
    try {
      const saved = localStorage.getItem(THEME_KEY);

      if (saved === "light") {
        setIsLightMode(true);
        globalIsLightMode = true;
      } else if (saved === "dark") {
        setIsLightMode(false);
        globalIsLightMode = false;
      } else {
        // fallback to system preference
        const prefersLight =
          window.matchMedia?.("(prefers-color-scheme: light)")?.matches ?? false;
        setIsLightMode(prefersLight);
        globalIsLightMode = prefersLight;
      }
    } catch {
      // ignore
    } finally {
      globalHasMounted = true;
      setMounted(true);
    }
  }, []);

  // Optional: sync across tabs
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== THEME_KEY) return;
      const isLight = e.newValue === "light";
      setIsLightMode(isLight);
      globalIsLightMode = isLight;
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Prevent hydration flash / wrong theme for a split second
  if (!mounted) return null;

  return (
    <div
      className={`${styles.loginPage} ${isLightMode ? styles.lightMode : ""} ${expandedMode ? styles.layoutExpanded : ""
        }`}
    >
      {/* Global Animated Background for Dark Mode */}
      <div className={styles.animatedBackground} />

      {/* LEFT PANEL */}
      <div className={styles.leftPanel}>
        {/* Decorations ported from alogin.html */}
        <div className={`${styles.bgDecor} ${styles.bgSqOutline} ${styles.sqTlBig}`} />
        <div className={`${styles.bgDecor} ${styles.bgSqOutline} ${styles.sqLmMed}`} />
        <div className={`${styles.bgDecor} ${styles.bgSqSolid} ${styles.sqBlSmall}`} />

        <div className={`${styles.bgDecor} ${styles.bgSqSolid} ${styles.sqLcMedSolid}`} />
        <div className={`${styles.bgDecor} ${styles.bgSqOutline} ${styles.sqTlMedOutline}`} />
        <div className={`${styles.bgDecor} ${styles.bgSqSolid} ${styles.sqBlLargeSolid}`} />

        <div className={`${styles.bgDecor} ${styles.sqBlMedOrange}`} />

        <div className={styles.versionTag}>CS-OS v1.1</div>

        <div className={styles.contentWrapper}>
          <div className={styles.brandTitle}>ORASYNC</div>

          <div className={styles.clockWrapper}>
            <div className={styles.liveClock}>
              IT'S CURRENTLY <span style={{ color: "white" }}>{clock}</span>
            </div>
          </div>
        </div>

        {/* Bottom Left Status */}
        <div className={styles.bottomStatus}>
          <div className={styles.dataGridBox}>
            <div className={styles.dataPixel} />
            <div className={styles.dataPixel} />
            <div className={styles.dataPixel} />
            <div className={styles.dataPixel} />
            <div className={styles.dataPixel} />
            <div className={styles.dataPixel} />
            <div className={styles.dataPixel} />
            <div className={styles.dataPixel} />
          </div>
          <div className={styles.copyright}>ALL RIGHTS RESERVED</div>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className={styles.rightPanel}>
        {/* White Overlay for Light Mode */}
        <div className={styles.rightPanelOverlay} />

        <button
          type="button"
          className={styles.themeToggle}
          onClick={handleThemeToggle}
          disabled={isToggling}
          style={{ opacity: isToggling ? 0.5 : 1, cursor: isToggling ? "not-allowed" : "pointer" }}
          aria-label="Toggle theme"
        >
          <span>{isLightMode ? <Moon size={20} /> : <Sun size={20} />}</span>
        </button>

        <div
          className={`${styles.loginCard} ${expandedMode ? styles.expandedMode : ""} ${styles.morphEntrance}`}
        >
          <div className={styles.cornerTopLeft} />
          <div className={styles.cornerBottomRight} />

          <div className={styles.secureHeader}>
            <div className={styles.orangeDot} />
            {headerTag}
          </div>

          {title ? <div className={styles.cardTitle}>{title}</div> : null}
          {subtitle && <div className={styles.cardSubtitle}>{subtitle}</div>}

          {errorPosition === "top" && (
            <div style={{ position: "relative", width: "100%", height: 0, zIndex: 10 }}>
              {(error || message) && (
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: errorOffset ? errorOffset : (subtitle ? "-20px" : "-8px"),
                    textAlign: "center"
                  }}
                >
                  <span
                    key={error || message}
                    className={`inline-block text-[0.85rem] font-bold uppercase ${error ? "text-red-500 " + styles.shakeText : "text-green-500"
                      }`}
                    style={{ lineHeight: 1 }}
                  >
                    {error || message}
                  </span>
                </div>
              )}
            </div>
          )}

          {children}

          {errorPosition === "bottom" && (
            <div style={{ position: "relative", width: "100%", height: 0, zIndex: 10 }}>
              {(error || message) && (
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    bottom: errorOffset ? errorOffset : "90px",
                    textAlign: "center"
                  }}
                >
                  <span
                    key={error || message}
                    className={`inline-block text-[0.85rem] font-bold uppercase ${error ? "text-red-500 " + styles.shakeText : "text-green-500"
                      }`}
                    style={{ lineHeight: 1 }}
                  >
                    {error || message}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
