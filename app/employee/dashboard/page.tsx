"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ActivityTracker from "@/app/components/ActivityTracker";
import AnalyticsDashboard from "@/app/components/AnalyticsDashboard";

type ScheduleToday = {
  hasSchedule: boolean;
  shift: {
    start_time: string;
    end_time: string;
    shift_name?: string | null;
  } | null;
};

type UserProfile = {
  user_id: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  dept_name: string | null;
  team_name: string | null;
  pos_name: string | null;
  streak_count: number | null;
};

/**
 * ✅ Strong emoji blocking:
 * - \p{Extended_Pictographic} catches most emoji pictographs
 * - Variation Selector-16 and ZWJ are used in emoji sequences
 */
const EMOJI_LIKE = /[\p{Extended_Pictographic}\uFE0F\u200D]/gu;

/**
 * ✅ Allowed characters ONLY:
 * letters (A-Z a-z), space, period, comma
 */
const ALLOWED_REASON_CHARS = /^[A-Za-z .,]*$/;

function sanitizeReasonInput(raw: string) {
  let s = raw ?? "";
  s = s.replace(EMOJI_LIKE, "");
  s = s.replace(/[^A-Za-z .,]/g, "");
  s = s.replace(/\s+/g, " ");
  if (s.length > 180) s = s.slice(0, 180);
  return s;
}

function formatClockDigits(d: Date) {
  return d
    .toLocaleTimeString([], {
      hour12: true,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
    .split(" ")[0];
}

function formatPeriod(d: Date) {
  return d.toLocaleTimeString([], { hour12: true, hour: "2-digit" }).slice(-2);
}

function formatDateLine(d: Date) {
  return d
    .toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    })
    .toUpperCase();
}

function formatScheduleRange(startISO?: string, endISO?: string) {
  if (!startISO || !endISO) return "NO SCHEDULE TODAY";
  const s = new Date(startISO).toLocaleTimeString([], {
    hour12: true,
    hour: "2-digit",
    minute: "2-digit",
  });
  const e = new Date(endISO).toLocaleTimeString([], {
    hour12: true,
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${s} — ${e}`.toUpperCase();
}

function formatDuration(ms: number) {
  if (ms < 0) ms = 0;
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h.toString().padStart(2, "0")}:${m
    .toString()
    .padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function validateReasonClient(reason: string) {
  const r = (reason ?? "").trim();
  if (!r) return "Reason required";
  if (EMOJI_LIKE.test(r)) return "No emojis allowed";
  if (r.length > 180) return "Reason too long (max 180 chars)";
  if (!ALLOWED_REASON_CHARS.test(r)) return "Only letters, spaces, . and , are allowed";
  return null;
}

function initialsFrom(profile: UserProfile | null) {
  if (!profile) return "??";

  const a = (profile.first_name ?? "").trim();
  const b = (profile.last_name ?? "").trim();
  if (a || b) return `${a[0] ?? ""}${b[0] ?? ""}`.toUpperCase() || "??";

  const n = (profile.name ?? "").trim();
  if (!n) return "??";
  const parts = n.split(/\s+/).filter(Boolean);
  const i1 = parts[0]?.[0] ?? "?";
  const i2 = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return `${i1}${i2}`.toUpperCase();
}

export default function DashboardPage() {
  const router = useRouter();

  const [now, setNow] = useState(() => new Date());

  const [loading, setLoading] = useState(true);
  const [isClockedIn, setIsClockedIn] = useState(false);

  const [scheduleToday, setScheduleToday] = useState<ScheduleToday>({
    hasSchedule: false,
    shift: null,
  });

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [serverMsg, setServerMsg] = useState("");

  const [modalConfirm, setModalConfirm] = useState<"in" | "out" | null>(null);

  const [showEarlyModal, setShowEarlyModal] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonErr, setReasonErr] = useState("");

  // ✅ Logout prompt modal after clock-out
  const [showLogoutPrompt, setShowLogoutPrompt] = useState(false);

  // for timers
  const clockInTimeRef = useRef<number | null>(null);

  // theme
  const [lightMode, setLightMode] = useState(false);

  // prevent double submit
  const [actionBusy, setActionBusy] = useState(false);

  // Auto-logout inactivity while clocked out
  const INACTIVITY_LIMIT_MS = 30 * 60 * 1000;
  const inactivityTimerRef = useRef<number | null>(null);

  // ✅ Profile dropdown menu
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuWrapRef = useRef<HTMLDivElement | null>(null);

  // Active section for navigation
  const [activeSection, setActiveSection] = useState<"dashboard" | "analytics">("dashboard");

  // tick clock (UI)
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);

  // restore theme
  useEffect(() => {
    try {
      const saved = localStorage.getItem("orasync-theme");
      const isLight = saved === "light";
      setLightMode(isLight);
      document.body.classList.toggle("light-mode", isLight);
    } catch {}
  }, []);

  const toggleTheme = () => {
    const next = !lightMode;
    setLightMode(next);
    document.body.classList.toggle("light-mode", next);
    try {
      localStorage.setItem("orasync-theme", next ? "light" : "dark");
    } catch {}
  };

  const doLogout = useCallback(async () => {
    if (isClockedIn) {
      setServerMsg("Please clock out first before logging out.");
      return;
    }

    try {
      setActionBusy(true);
      setServerMsg("");
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore
    } finally {
      setActionBusy(false);
      window.location.href = "/login";
    }
  }, [isClockedIn]);

  // Load status on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/employee/clock/status", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));

        const clocked = !!data?.isClockedIn;
        setIsClockedIn(clocked);

        const cin = data?.activeShift?.clock_in_time
          ? new Date(data.activeShift.clock_in_time).getTime()
          : null;
        clockInTimeRef.current = cin;

        setScheduleToday({
          hasSchedule: !!data?.scheduleToday?.hasSchedule,
          shift: data?.scheduleToday?.shift ?? null,
        });

        setUserProfile(data?.userProfile ?? null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ✅ DAILY SENTIMENT GATE (safety net even if user navigates directly)
  useEffect(() => {
    if (loading) return;

    (async () => {
      try {
        const res = await fetch("/api/employee/sentiment/status", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json().catch(() => ({}));
        if (data?.doneToday === false) {
          router.replace("/employee/sentiment");
        }
      } catch {}
    })();
  }, [loading, router]);

  const scheduleText = useMemo(() => {
    if (!scheduleToday.hasSchedule || !scheduleToday.shift) return "NO SCHEDULE TODAY";
    return formatScheduleRange(scheduleToday.shift.start_time, scheduleToday.shift.end_time);
  }, [scheduleToday]);

  const sidebarScheduleStatus = useMemo(
    () => (scheduleToday.hasSchedule ? "SCHEDULED" : "NO SCHEDULE"),
    [scheduleToday.hasSchedule]
  );

  const canClockIn = scheduleToday.hasSchedule && !loading && !actionBusy;

  const sessionDuration = useMemo(() => {
    if (!isClockedIn || !clockInTimeRef.current) return "00:00:00";
    return formatDuration(Date.now() - clockInTimeRef.current);
  }, [isClockedIn, now]);

  const targetHours = useMemo(() => {
    if (
      scheduleToday.hasSchedule &&
      scheduleToday.shift?.start_time &&
      scheduleToday.shift?.end_time
    ) {
      const s = new Date(scheduleToday.shift.start_time).getTime();
      const e = new Date(scheduleToday.shift.end_time).getTime();
      return formatDuration(Math.max(0, e - s));
    }
    return "09:00:00";
  }, [scheduleToday]);

const isEarlyClockOut = useMemo(() => {
    if (!scheduleToday.hasSchedule || !scheduleToday.shift?.end_time) return false;

    if (clockInTimeRef.current) {
      const clockInDate = new Date(clockInTimeRef.current).toDateString();
      const todayDate = now.toDateString();
      if (clockInDate !== todayDate) {
        return false;
      }
    }

    const end = new Date(scheduleToday.shift.end_time).getTime();
    return Date.now() < end;
  }, [scheduleToday, now]);
  
  const doClockIn = useCallback(async () => {
    if (actionBusy) return;
    setActionBusy(true);
    setServerMsg("");

    try {
      const res = await fetch("/api/employee/clock/in", { method: "POST" });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setServerMsg(data?.message ?? "Clock in failed");
        return;
      }

      const clockIn = data?.activeShift?.clock_in_time;
      setIsClockedIn(true);
      clockInTimeRef.current = clockIn ? new Date(clockIn).getTime() : Date.now();
    } finally {
      setActionBusy(false);
    }
  }, [actionBusy]);

  const doClockOut = useCallback(
    async (earlyReason?: string) => {
      if (actionBusy) return;
      setActionBusy(true);
      setServerMsg("");

      try {
        const res = await fetch("/api/employee/clock/out", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: earlyReason ?? "" }),
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          setServerMsg(data?.message ?? "Clock out failed");
          return;
        }

        setIsClockedIn(false);
        clockInTimeRef.current = null;

        setReason("");
        setReasonErr("");
        setShowEarlyModal(false);

        // ✅ After clock out, ask if they want to logout
        setShowLogoutPrompt(true);
      } finally {
        setActionBusy(false);
      }
    },
    [actionBusy]
  );

  const confirmClockOutFlow = () => {
    if (actionBusy) return;

    if (!scheduleToday.hasSchedule || !scheduleToday.shift?.end_time) {
      void doClockOut("");
      return;
    }

    if (isEarlyClockOut) {
      setReason("");
      setReasonErr("");
      setShowEarlyModal(true);
      return;
    }

    void doClockOut("");
  };

  // ✅ realtime reason validation
  useEffect(() => {
    if (!showEarlyModal) return;
    const err = validateReasonClient(reason);
    setReasonErr(err ?? "");
  }, [reason, showEarlyModal]);

  const submitEarlyReason = () => {
    const err = validateReasonClient(reason);
    if (err) {
      setReasonErr(err);
      return;
    }
    void doClockOut(reason.trim());
  };

  // ✅ Auto logout after 30 minutes inactivity while clocked out
  useEffect(() => {
    if (inactivityTimerRef.current) {
      window.clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }

    if (loading) return;
    if (isClockedIn) return;

    const reset = () => {
      if (inactivityTimerRef.current) window.clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = window.setTimeout(() => {
        void doLogout();
      }, INACTIVITY_LIMIT_MS);
    };

    reset();

    const events: Array<keyof WindowEventMap> = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
      "click",
    ];
    const handler = () => reset();
    events.forEach((e) => window.addEventListener(e, handler, { passive: true }));

    return () => {
      events.forEach((e) => window.removeEventListener(e, handler));
      if (inactivityTimerRef.current) window.clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    };
  }, [isClockedIn, loading, doLogout]);

  // ✅ Close profile menu on outside click + ESC
  useEffect(() => {
    if (!profileMenuOpen) return;

    const onDown = (e: MouseEvent) => {
      const wrap = profileMenuWrapRef.current;
      if (!wrap) return;
      if (!wrap.contains(e.target as Node)) setProfileMenuOpen(false);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setProfileMenuOpen(false);
    };

    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [profileMenuOpen]);

  const ledgerRows = useMemo(() => {
    const t = now.toLocaleTimeString([], {
      hour12: true,
      hour: "2-digit",
      minute: "2-digit",
    });

    if (!isClockedIn) return [];

    return [
      { code: "B", activity: "Work/Email", start: t, end: "…", endAccent: false },
      { code: "SYS", activity: "CLOCK IN", start: t, end: t, endAccent: true },
    ];
  }, [isClockedIn, now]);

  const profileNameText = useMemo(() => {
    const n =
      (userProfile?.name ?? "").trim() ||
      `${(userProfile?.first_name ?? "").trim()} ${(userProfile?.last_name ?? "")
        .trim()}`.trim();
    return n || "—";
  }, [userProfile]);

  const profileMetaText = useMemo(() => {
    const dept = (userProfile?.dept_name ?? "").trim();
    const team = (userProfile?.team_name ?? "").trim();
    const pos = (userProfile?.pos_name ?? "").trim();

    const left = dept || "—";
    const right = team || pos || "—";
    return `${left} | ${right}`;
  }, [userProfile]);

  const avatarText = useMemo(() => initialsFrom(userProfile), [userProfile]);

  // ✅ BLOCKING HANDLERS for reason input
  const onReasonBeforeInput = (e: React.FormEvent<HTMLInputElement>) => {
    const ev = e.nativeEvent as InputEvent;
    const data = ev.data ?? "";
    if (!data) return;

    if (EMOJI_LIKE.test(data) || !ALLOWED_REASON_CHARS.test(data)) {
      e.preventDefault();
      return;
    }

    const current = reason ?? "";
    if ((current + data).length > 180) {
      e.preventDefault();
    }
  };

  const onReasonPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text");
    const sanitized = sanitizeReasonInput((reason ?? "") + text);
    setReason(sanitized);
  };

  const onReasonChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = sanitizeReasonInput(e.target.value);
    setReason(next);
  };

  return (
    <div className="split-layout">
      <aside className="info-panel">
        <div className="brand-logo">ORASYNC</div>

        <nav className="nav-links">
          <div className="nav-item active">DASHBOARD</div>
          <div className="nav-item">CALENDAR</div>
          <a className="nav-item" href="/employee/timesheet">
            TIMESHEET
          </a>
          <div className="nav-item">ANALYTICS</div>
        </nav>

        <div className="sidebar-bottom">
          <div className="widget-card">
            <div className="widget-title">TODAY&apos;S SCHEDULE</div>

            <div className="widget-time" id="sidebar-schedule">
              {scheduleText}
            </div>

            <div className="widget-status">
              <span className={`dot ${scheduleToday.hasSchedule ? "green" : "gray"}`} />
              <span id="sidebar-schedule-status">{sidebarScheduleStatus}</span>
            </div>
          </div>

          <div className="profile-menu-wrap" ref={profileMenuWrapRef}>
            {profileMenuOpen && (
              <div className="profile-menu-card" role="menu" aria-label="Profile menu">
                <button
                  className="profile-menu-item"
                  onClick={() => {
                    setProfileMenuOpen(false);
                    setServerMsg("Settings is UI-only for now.");
                  }}
                  type="button"
                >
                  <span className="menu-icon">⚙</span>
                  <span>Settings</span>
                </button>

                <button
                  className="profile-menu-item danger"
                  onClick={() => {
                    setProfileMenuOpen(false);
                    void doLogout();
                  }}
                  type="button"
                  disabled={actionBusy}
                  title={isClockedIn ? "Clock out first" : "Log out"}
                >
                  <span className="menu-icon">⎋</span>
                  <span>Log Out</span>
                </button>
              </div>
            )}

            <button
              className="profile-trigger"
              type="button"
              onClick={() => setProfileMenuOpen((v) => !v)}
              aria-expanded={profileMenuOpen}
              aria-haspopup="menu"
            >
              <div className="profile-card">
                <div className="streak-pill">
                  <span className="fire">🔥</span>
                  <span id="streak-days">{userProfile?.streak_count ?? 12}</span> DAY STREAK
                </div>

                <div className="profile-row">
                  <div className="avatar">{avatarText}</div>
                  <div>
                    <div className="profile-name" id="profile-name">
                      {profileNameText}
                    </div>
                    <div className="profile-meta" id="profile-meta">
                      {profileMetaText}
                    </div>
                  </div>
                </div>
              </div>
            </button>
          </div>

          {serverMsg && <div className="inline-warn">{serverMsg}</div>}
        </div>
      </aside>

      <main className="workspace-panel">
        <div className="tech-mesh" />

        <div className="top-right-actions">
          <button className="theme-btn" onClick={toggleTheme} aria-label="Toggle theme">
            {lightMode ? "🌙" : "☀"}
          </button>
        </div>

        <div className="system-pill">
          <span className="dot green" />
          <span id="system-state">{isClockedIn ? "CLOCKED IN" : "SYSTEM ONLINE"}</span>
        </div>

        <div className="content-area">
          {activeSection === "dashboard" && (
            <>
              {!isClockedIn && (
            <div className="clock-container" id="layout-initial">
              <div className="clock-panel" role="region" aria-label="Clock In panel">
                <div className="clock-label">CURRENT TIME</div>

                <div className="clock-time-row">
                  <div className="clock-time" id="clock-live">
                    {formatClockDigits(now)}
                  </div>
                  <div className="clock-period" id="clock-period">
                    {formatPeriod(now)}
                  </div>
                </div>

                <div className="clock-date" id="clock-date">
                  {formatDateLine(now)}
                </div>

                <button
                  id="btn-clockin"
                  className="clockin-btn"
                  disabled={!canClockIn}
                  onClick={() => setModalConfirm("in")}
                  title={!scheduleToday.hasSchedule ? "No schedule today" : ""}
                >
                  CLOCK IN
                </button>

                {!scheduleToday.hasSchedule && (
                  <div className="inline-warn">
                    No schedule today. Clock in is disabled until a schedule is uploaded.
                  </div>
                )}
              </div>
            </div>
          )}

          {isClockedIn && (
            <div className="dashboard-view" style={{ display: "block" }}>
              <div className="hud-row">
                <div className="hud-card">
                  <div className="hud-title">CURRENT TIME</div>
                  <div className="hud-big" id="hud-clock">
                    {now.toLocaleTimeString([], {
                      hour12: true,
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                  <div className="hud-sub" id="hud-date">
                    {formatDateLine(now)}
                  </div>
                </div>

                <div className="hud-card">
                  <div className="hud-title">SESSION DURATION</div>
                  <div className="hud-mono" id="hud-session">
                    {sessionDuration}
                  </div>
                  <div className="hud-sub">
                    Target: <span id="hud-target">{targetHours}</span>
                  </div>
                </div>

                <div className="hud-card hud-accent">
                  <div className="hud-title">ACTIVITY DURATION</div>
                  <div className="hud-mono" id="hud-activity">
                    {sessionDuration}
                  </div>
                  <div className="hud-sub" id="hud-activity-label">
                    ACTIVE TASK
                  </div>
                </div>
              </div>

              <div className="workspace-grid">
                <div className="ledger-panel">
                  <div className="panel-header">
                    <div className="panel-title">ACTIVITY LEDGER</div>
                    <div className="panel-right">LIVE UPDATES</div>
                  </div>

                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>CODE</th>
                          <th>ACTIVITY</th>
                          <th>START TIME</th>
                          <th>END TIME</th>
                        </tr>
                      </thead>
                      <tbody id="ledger-body">
                        {ledgerRows.map((r, idx) => (
                          <tr key={idx}>
                            <td>{r.code}</td>
                            <td style={{ fontWeight: 700 }}>{r.activity}</td>
                            <td>{r.start}</td>
                            <td className={r.endAccent ? "td-accent" : ""}>{r.end}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="action-panel">
                  <ActivityTracker isClockedIn={isClockedIn} />

                  <div className="spacer" style={{ margin: '1.5rem 0' }} />

                  <div className="panel-header">
                    <div className="panel-title">SESSION CONTROL</div>
                  </div>

                  <div className="panel-body">
                    <div className="session-box">
                      <div className="label-sm">SESSION STATUS</div>
                      <div className="session-state" id="session-state">
                        CLOCKED IN
                      </div>
                    </div>

                    <button className="danger-btn" id="btn-clockout" onClick={() => setModalConfirm("out")}>
                      CLOCK OUT
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          </>
          )}

          {activeSection === "analytics" && (
            <AnalyticsDashboard />
          )}
        </div>
      </main>

      {/* CONFIRM MODAL */}
      {modalConfirm && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-title">
              {modalConfirm === "in" ? "Confirm Clock In" : "Confirm Clock Out"}
            </div>

            <div className="modal-desc">
              {modalConfirm === "in"
                ? "Start your shift now?"
                : "Are you sure you want to clock out? If you clock out earlier than your scheduled end time, a justification will be required."}
            </div>

            <div className="modal-actions">
              <button className="modal-btn ghost" onClick={() => setModalConfirm(null)}>
                Cancel
              </button>

              <button
                className={`modal-btn ${modalConfirm === "out" ? "danger" : "ok"}`}
                onClick={() => {
                  const t = modalConfirm;
                  setModalConfirm(null);
                  if (t === "in") void doClockIn();
                  if (t === "out") confirmClockOutFlow();
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EARLY CLOCK-OUT MODAL */}
      {showEarlyModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-title">Early Clock-out Detected</div>
            <div className="modal-desc">
              You are clocking out earlier than your scheduled end time. A justification is required.
            </div>

            <div className="modal-field">
              <div className="label-sm">COMPLIANCE JUSTIFICATION LOG</div>

              <input
                className="modal-input"
                type="text"
                value={reason}
                placeholder="Type a quick reason (letters, space, . , only)"
                onBeforeInput={onReasonBeforeInput}
                onPaste={onReasonPaste}
                onChange={onReasonChange}
                inputMode="text"
                autoComplete="off"
              />

              <div className="label-sm hint">
                Rules: required, max 180, no emojis, only letters/spaces and . ,
              </div>

              {reasonErr && <div className="inline-warn">{reasonErr}</div>}
            </div>

            <div className="modal-actions">
              <button
                className="modal-btn ghost"
                onClick={() => {
                  setShowEarlyModal(false);
                  setReasonErr("");
                }}
              >
                Cancel
              </button>
              <button
                className="modal-btn danger"
                onClick={submitEarlyReason}
                disabled={!!validateReasonClient(reason) || actionBusy}
              >
                Submit &amp; Clock Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LOGOUT PROMPT AFTER CLOCK-OUT */}
      {showLogoutPrompt && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-title">Logout?</div>
            <div className="modal-desc">
              You have successfully clocked out. Do you want to logout now?
            </div>

            <div className="modal-actions">
              <button className="modal-btn ghost" onClick={() => setShowLogoutPrompt(false)}>
                Stay Logged In
              </button>
              <button className="modal-btn ok" onClick={doLogout}>
                Logout
              </button>
            </div>

            <div className="label-sm" style={{ marginTop: 10, opacity: 0.75 }}>
              You will be automatically logged out after 30 minutes of inactivity while clocked out.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
