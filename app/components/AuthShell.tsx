"use client";

import { ReactNode, useEffect, useState } from "react";
import styles from "../login/Login.module.css";
import { Moon, Sun } from "lucide-react";

type AuthShellProps = {
  headerTag: string;
  title?: ReactNode;
  subtitle?: ReactNode;
  expandedMode?: boolean;
  children: ReactNode;
};

const THEME_KEY = "orasync_theme"; // "light" | "dark"

export default function AuthShell({
  headerTag,
  title,
  subtitle,
  expandedMode = false,
  children,
}: AuthShellProps) {
  const [clock, setClock] = useState("");
  const [isLightMode, setIsLightMode] = useState(false);
  /* Anti-spam toggle state */
  const [isToggling, setIsToggling] = useState(false);

  // Debounced toggle handler
  const handleThemeToggle = () => {
    if (isToggling) return;
    setIsToggling(true);
    setIsLightMode((prev) => !prev);
    // Cooldown matches the CSS transition (approx 600ms)
    setTimeout(() => setIsToggling(false), 600);
  };

  const [mounted, setMounted] = useState(false);

  // Clock
  useEffect(() => {
    const updateTime = () =>
      setClock(`IT'S CURRENTLY ${new Date().toLocaleTimeString()}`);

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Load theme once on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY);

      if (saved === "light") {
        setIsLightMode(true);
      } else if (saved === "dark") {
        setIsLightMode(false);
      } else {
        // fallback to system preference
        const prefersLight =
          window.matchMedia?.("(prefers-color-scheme: light)")?.matches ?? false;
        setIsLightMode(prefersLight);
      }
    } catch {
      // ignore
    } finally {
      setMounted(true);
    }
  }, []);

  // Save theme whenever it changes (after mounted)
  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(THEME_KEY, isLightMode ? "light" : "dark");
    } catch {
      // ignore
    }
  }, [isLightMode, mounted]);

  // Optional: sync across tabs
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== THEME_KEY) return;
      if (e.newValue === "light") setIsLightMode(true);
      if (e.newValue === "dark") setIsLightMode(false);
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
          <div className={styles.brandSubtitle}>AI-POWERED PRODUCTIVITY</div>
          <div className={styles.clockWrapper}>
            <div className={styles.liveClock}>
              {clock}
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
          className={`${styles.loginCard} ${expandedMode ? styles.expandedMode : ""
            }`}
        >
          <div className={styles.cornerTopLeft} />
          <div className={styles.cornerBottomRight} />

          <div className={styles.secureHeader}>
            <div className={styles.orangeDot} />
            {headerTag}
          </div>

          {title ? <div className={styles.cardTitle}>{title}</div> : null}
          {subtitle ? (
            <div className={styles.cardSubtitle}>{subtitle}</div>
          ) : null}

          {children}
        </div>
      </div>
    </div>
  );
}
