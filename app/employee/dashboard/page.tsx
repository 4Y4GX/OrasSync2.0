"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import ActivityTracker from "@/app/components/ActivityTracker";
import AnalyticsDashboard from "@/app/components/AnalyticsDashboard";
import Calendar from "@/app/components/calendar";
import "./dashboard.css";

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
  email?: string | null;
};

const EMOJI_LIKE = /[\p{Extended_Pictographic}\uFE0F\u200D]/gu;
const ALLOWED_REASON_CHARS = /^[A-Za-z .,]*$/;

const TIMEZONE = "Asia/Manila";

function sanitizeReasonInput(raw: string) {
  let s = raw ?? "";
  s = s.replace(EMOJI_LIKE, "");
  s = s.replace(/[^A-Za-z .,]/g, "");
  s = s.replace(/\s+/g, " ");
  if (s.length > 180) s = s.slice(0, 180);
  return s;
}

function formatShiftTime(isoString: string) {
  if (!isoString) return "";
  if (!isoString.includes("T")) return isoString;
  const date = new Date(isoString);
  return date.toLocaleTimeString("en-US", {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

function formatDateLine(d: Date) {
  return d.toLocaleDateString("en-US", {
    timeZone: TIMEZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).toUpperCase();
}

function formatScheduleRange(startISO?: string, endISO?: string) {
  if (!startISO || !endISO) return "NO SCHEDULE TODAY";
  return `${formatShiftTime(startISO)} — ${formatShiftTime(endISO)}`.toUpperCase();
}

function formatDuration(ms: number) {
  if (ms < 0) ms = 0;
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

function formatHoursMinutes(decimalHours: number | null | undefined): string {
  if (decimalHours == null || isNaN(decimalHours)) return "-";
  const totalMinutes = Math.round(decimalHours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
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

  const timeOffsetRef = useRef<number>(Date.now() - performance.now());
  const [now, setNow] = useState(() => new Date());

  const [loading, setLoading] = useState(true);
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [ledgerData, setLedgerData] = useState<any[]>([]);

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
  const [reasonShake, setReasonShake] = useState(false);

  const [showLogoutPrompt, setShowLogoutPrompt] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [activeSessionNotice, setActiveSessionNotice] = useState(false);
  const [isClosingActiveSession, setIsClosingActiveSession] = useState(false);

  const closeActiveSessionModal = useCallback(() => {
    setIsClosingActiveSession(true);
    setTimeout(() => {
      setActiveSessionNotice(false);
      setIsClosingActiveSession(false);
    }, 300); // Wait for animation to finish
  }, []);

  // 🚨 MULTI-STEP SETTINGS MODAL STATES
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsStep, setSettingsStep] = useState<"menu" | "otp" | "question" | "password" | "success" | "locked">("menu");
  const [otpCode, setOtpCode] = useState("");
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [otpDailyCount, setOtpDailyCount] = useState(0);
  const [otpAttempts, setOtpAttempts] = useState(0);
  const otpTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [secQuestionId, setSecQuestionId] = useState<number | null>(null);
  const [secQuestion, setSecQuestion] = useState("");
  const [secAnswer, setSecAnswer] = useState("");
  const [sqAttempts, setSqAttempts] = useState(0);
  const [pwdNew, setPwdNew] = useState("");
  const [pwdConfirm, setPwdConfirm] = useState("");
  const [showPwdNew, setShowPwdNew] = useState(false);
  const [showPwdConfirm, setShowPwdConfirm] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState<{ text: string, type: "success" | "error" | "info" | "" }>({ text: "", type: "" });
  const [settingsLoading, setSettingsLoading] = useState(false);

  const [clockInTime, setClockInTime] = useState<number | null>(null);
  const [accumulatedMs, setAccumulatedMs] = useState<number>(0);
  const [activeActivityStart, setActiveActivityStart] = useState<number | null>(null);

  const [lightMode, setLightMode] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);

  const INACTIVITY_LIMIT_MS = 30 * 60 * 1000;
  const inactivityTimerRef = useRef<number | null>(null);

  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuWrapRef = useRef<HTMLDivElement | null>(null);

  const [activeSection, setActiveSection] = useState<"dashboard" | "calendar" | "timesheet" | "analytics">("dashboard");

  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsWeekOffset, setAnalyticsWeekOffset] = useState(0);

  const [timesheetDays, setTimesheetDays] = useState<any[]>([]);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitMsg, setSubmitMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [selectedTimelineDate, setSelectedTimelineDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [ganttTip, setGanttTip] = useState<{ x: number; y: number; text: string; sub?: string } | null>(null);

  const [detailLogTab, setDetailLogTab] = useState<"NOT_SUBMITTED" | "PENDING" | "REJECTED" | "APPROVED">("NOT_SUBMITTED");

  const detailLogTabCounts = useMemo(() => {
    const counts = { NOT_SUBMITTED: 0, PENDING: 0, REJECTED: 0, APPROVED: 0 };
    for (const day of timesheetDays) {
      for (const act of day.activities || []) {
        if (act.approval_status === "NOT_SUBMITTED") counts.NOT_SUBMITTED++;
        else if (act.approval_status === "PENDING") counts.PENDING++;
        else if (act.approval_status === "REJECTED") counts.REJECTED++;
        else if (act.approval_status === "SUPERVISOR_APPROVED") counts.APPROVED++;
      }
    }
    return counts;
  }, [timesheetDays]);

  const filteredTimesheetLogs = useMemo(() => {
    const statusMatch = detailLogTab === "APPROVED" ? "SUPERVISOR_APPROVED" : detailLogTab;
    return timesheetDays
      .map(day => ({
        ...day,
        activities: (day.activities || []).filter((act: any) => act.approval_status === statusMatch),
      }))
      .filter(day => day.activities.length > 0);
  }, [timesheetDays, detailLogTab]);

  const [calView, setCalView] = useState<"week" | "month">("week");
  const [calDate, setCalDate] = useState(() => new Date());
  const [calendar, setCalendar] = useState<Record<string, any>>({});

  const [futureSchedules, setFutureSchedules] = useState<Record<string, any[]>>({});
  const [activityList, setActivityList] = useState<any[]>([]);
  const [showFutureModal, setShowFutureModal] = useState(false);
  const [futureModalDate, setFutureModalDate] = useState("");
  const [futureModalActivity, setFutureModalActivity] = useState("");
  const [futureModalStartTime, setFutureModalStartTime] = useState("");
  const [futureModalEndTime, setFutureModalEndTime] = useState("");
  const [futureModalError, setFutureModalError] = useState("");
  const [futureModalSaving, setFutureModalSaving] = useState(false);
  const [futureModalShiftTimes, setFutureModalShiftTimes] = useState<{ start: string; end: string } | null>(null);

  useEffect(() => {
    const t = window.setInterval(() => {
      setNow(new Date(performance.now() + timeOffsetRef.current));
    }, 1000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    const fetchCalendar = async () => {
      if (!userProfile?.user_id) return;
      try {
        const year = calDate.getFullYear();
        const month = calDate.getMonth();
        const res = await fetch(`/api/calendar?userId=${userProfile.user_id}&year=${year}&month=${month}`);

        if (!res.ok) return;

        const data = await res.json();
        const map: Record<string, any> = {};
        if (Array.isArray(data)) {
          data.forEach((item: any) => { map[item.date] = item; });
        }
        setCalendar(map);
      } catch (err) {
        console.error("Failed to fetch calendar", err);
      }
    };
    fetchCalendar();
  }, [userProfile?.user_id, calDate]);

  const calNavigate = (dir: number) => {
    const next = new Date(calDate);
    if (calView === 'week') next.setDate(next.getDate() + (dir * 7));
    else next.setMonth(next.getMonth() + dir);
    setCalDate(next);
  };

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const getCalendarTitle = () => {
    if (calView === 'week') {
      const start = new Date(calDate);
      const day = start.getDay();
      const diff = day === 0 ? 6 : day - 1;
      start.setDate(start.getDate() - diff);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return `${monthNames[start.getMonth()].substring(0, 3)} ${start.getDate()} — ${monthNames[end.getMonth()].substring(0, 3)} ${end.getDate()}, ${end.getFullYear()}`;
    }
    return `${monthNames[calDate.getMonth()]} ${calDate.getFullYear()}`;
  };

  const navigateTimelineDate = (dir: number) => {
    const d = new Date(selectedTimelineDate);
    d.setDate(d.getDate() + dir);
    setSelectedTimelineDate(d.toISOString().slice(0, 10));
  };

  const formatTimelineDate = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    const today = new Date(performance.now() + timeOffsetRef.current);
    today.setHours(0, 0, 0, 0);
    const target = new Date(d);
    target.setHours(0, 0, 0, 0);

    const isToday = target.getTime() === today.getTime();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = target.getTime() === yesterday.getTime();

    const dayName = d.toLocaleDateString("en-US", { weekday: "short", timeZone: TIMEZONE });
    const monthDay = d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: TIMEZONE });

    if (isToday) return `Today, ${monthDay}`;
    if (isYesterday) return `Yesterday, ${monthDay}`;
    return `${dayName}, ${monthDay}`;
  };

  const selectedDayActivities = useMemo(() => {
    const dayData = timesheetDays.find(d => d.date === selectedTimelineDate);
    return dayData?.activities || [];
  }, [timesheetDays, selectedTimelineDate]);

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const res = await fetch("/api/employee/activity/list");
        if (res.ok) {
          const data = await res.json();
          setActivityList(data.activities || []);
        }
      } catch (err) {
        console.error("Failed to fetch activities", err);
      }
    };
    fetchActivities();
  }, []);

  useEffect(() => {
    const fetchFutureSchedules = async () => {
      if (!userProfile?.user_id) return;
      try {
        const year = calDate.getFullYear();
        const month = calDate.getMonth();
        const res = await fetch(`/api/employee/schedule/future?userId=${userProfile.user_id}&year=${year}&month=${month}`);
        if (res.ok) {
          const data = await res.json();
          const map: Record<string, any[]> = {};
          if (data.schedules && Array.isArray(data.schedules)) {
            data.schedules.forEach((schedule: any) => {
              const dateKey = schedule.shift_date;
              if (!map[dateKey]) map[dateKey] = [];
              map[dateKey].push(schedule);
            });
          }
          setFutureSchedules(map);
        }
      } catch (err) {
        console.error("Failed to fetch future schedules", err);
      }
    };
    fetchFutureSchedules();
  }, [userProfile?.user_id, calDate]);

  const openFutureModal = (dateKey?: string) => {
    setFutureModalError("");
    setFutureModalActivity("");
    setFutureModalStartTime("");
    setFutureModalEndTime("");

    if (dateKey) {
      setFutureModalDate(dateKey);
      const dayData = calendar[dateKey];
      if (dayData && !dayData.off) {
        setFutureModalShiftTimes({ start: dayData.start_time, end: dayData.end_time });
        setFutureModalStartTime(dayData.start_time);
        setFutureModalEndTime(dayData.end_time);
      }
    } else {
      setFutureModalDate("");
      setFutureModalShiftTimes(null);
    }

    setShowFutureModal(true);
  };

  const closeFutureModal = () => {
    setShowFutureModal(false);
    setFutureModalError("");
    setFutureModalDate("");
    setFutureModalActivity("");
    setFutureModalStartTime("");
    setFutureModalEndTime("");
    setFutureModalShiftTimes(null);
  };

  const closeSettingsModal = () => {
    setShowSettingsModal(false);
    setSettingsStep("menu");
    setOtpCode("");
    setOtpCountdown(0);
    setOtpAttempts(0);
    if (otpTimerRef.current) { clearInterval(otpTimerRef.current); otpTimerRef.current = null; }
    setSecQuestionId(null);
    setSecQuestion("");
    setSecAnswer("");
    setSqAttempts(0);
    setPwdNew("");
    setPwdConfirm("");
    setShowPwdNew(false);
    setShowPwdConfirm(false);
    setSettingsMsg({ text: "", type: "" });
  };

  // Close Modals on Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeFutureModal();
        closeSettingsModal();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  const handleFutureDateChange = (newDate: string) => {
    setFutureModalDate(newDate);
    setFutureModalError("");

    if (calendar[newDate]) {
      const dayData = calendar[newDate];
      if (!dayData.off && dayData.start_time && dayData.end_time) {
        setFutureModalShiftTimes({ start: dayData.start_time, end: dayData.end_time });
        setFutureModalStartTime(dayData.start_time);
        setFutureModalEndTime(dayData.end_time);
      } else {
        setFutureModalShiftTimes(null);
        setFutureModalStartTime("");
        setFutureModalEndTime("");
        setFutureModalError("No shift scheduled for this day");
      }
    } else {
      setFutureModalShiftTimes(null);
      setFutureModalStartTime("");
      setFutureModalEndTime("");
    }
  };

  const submitFutureActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    setFutureModalError("");

    if (!futureModalDate || !futureModalActivity || !futureModalStartTime || !futureModalEndTime) {
      setFutureModalError("Please fill in all fields");
      return;
    }

    setFutureModalSaving(true);
    try {
      const res = await fetch("/api/employee/schedule/future", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activity_id: futureModalActivity,
          shift_date: futureModalDate,
          start_time: futureModalStartTime,
          end_time: futureModalEndTime,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setFutureModalError(data.message || "Failed to save activity");
        return;
      }

      const year = calDate.getFullYear();
      const month = calDate.getMonth();
      const refreshRes = await fetch(`/api/employee/schedule/future?userId=${userProfile?.user_id}&year=${year}&month=${month}`);
      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        const map: Record<string, any[]> = {};
        if (refreshData.schedules && Array.isArray(refreshData.schedules)) {
          refreshData.schedules.forEach((schedule: any) => {
            const dateKey = schedule.shift_date;
            if (!map[dateKey]) map[dateKey] = [];
            map[dateKey].push(schedule);
          });
        }
        setFutureSchedules(map);
      }
      closeFutureModal();
    } catch (err) {
      setFutureModalError("An error occurred while saving");
    } finally {
      setFutureModalSaving(false);
    }
  };

  const deleteFutureActivity = async (ftsId: number) => {
    if (!confirm("Are you sure you want to delete this scheduled activity?")) return;

    try {
      const res = await fetch(`/api/employee/schedule/future?fts_id=${ftsId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        const year = calDate.getFullYear();
        const month = calDate.getMonth();
        const refreshRes = await fetch(`/api/employee/schedule/future?userId=${userProfile?.user_id}&year=${year}&month=${month}`);
        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          const map: Record<string, any[]> = {};
          if (refreshData.schedules && Array.isArray(refreshData.schedules)) {
            refreshData.schedules.forEach((schedule: any) => {
              const dateKey = schedule.shift_date;
              if (!map[dateKey]) map[dateKey] = [];
              map[dateKey].push(schedule);
            });
          }
          setFutureSchedules(map);
        }
      }
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem("orasync-theme");
      const isLight = saved === "light";
      setLightMode(isLight);
      document.body.classList.toggle("light-mode", isLight);
    } catch { }
  }, []);

  const toggleTheme = () => {
    const next = !lightMode;
    setLightMode(next);
    document.body.classList.toggle("light-mode", next);
    try {
      localStorage.setItem("orasync-theme", next ? "light" : "dark");
    } catch { }
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
    } finally {
      setActionBusy(false);
      window.location.href = "/login";
    }
  }, [isClockedIn]);

  // 🚨 MULTI-STEP SECURITY FLOW HANDLERS

  const startOtpCountdown = () => {
    setOtpCountdown(90);
    if (otpTimerRef.current) clearInterval(otpTimerRef.current);
    otpTimerRef.current = setInterval(() => {
      setOtpCountdown((prev) => {
        if (prev <= 1) {
          if (otpTimerRef.current) clearInterval(otpTimerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Step 1: Request OTP
  const handleRequestOTP = async () => {
    setSettingsMsg({ text: "", type: "" });
    setSettingsLoading(true);
    try {
      const res = await fetch("/api/employee/change-password/otp", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setOtpDailyCount(data.dailyCount ?? 0);
        setOtpAttempts(0);
        setOtpCode("");
        setSettingsMsg({ text: "A verification code has been sent to your registered email.", type: "success" });
        setSettingsStep("otp");
        startOtpCountdown();
      } else if (res.status === 429) {
        setSettingsMsg({ text: "YOU'VE REACHED THE DAILY OTP LIMIT.", type: "error" });
      } else {
        setSettingsMsg({ text: data.message || "Failed to send OTP.", type: "error" });
      }
    } catch {
      setSettingsMsg({ text: "Network error. Please try again.", type: "error" });
    } finally {
      setSettingsLoading(false);
    }
  };

  // Step 1b: Resend OTP
  const handleResendOTP = async () => {
    if (otpCountdown > 0 || otpDailyCount >= 5) return;
    setSettingsMsg({ text: "", type: "" });
    setSettingsLoading(true);
    try {
      const res = await fetch("/api/employee/change-password/otp", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setOtpDailyCount(data.dailyCount ?? 0);
        setOtpAttempts(0);
        setOtpCode("");
        setSettingsMsg({ text: "A new OTP has been sent.", type: "success" });
        startOtpCountdown();
      } else if (res.status === 429) {
        setSettingsMsg({ text: "YOU'VE REACHED THE DAILY OTP LIMIT.", type: "error" });
      } else {
        setSettingsMsg({ text: data.message || "Failed to resend OTP.", type: "error" });
      }
    } catch {
      setSettingsMsg({ text: "Network error.", type: "error" });
    } finally {
      setSettingsLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode) return setSettingsMsg({ text: "Please enter the OTP.", type: "error" });

    setSettingsMsg({ text: "", type: "" });
    setSettingsLoading(true);
    try {
      const res = await fetch("/api/employee/change-password/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp: otpCode }),
      });
      const data = await res.json();

      if (res.ok) {
        if (otpTimerRef.current) { clearInterval(otpTimerRef.current); otpTimerRef.current = null; }
        setSettingsMsg({ text: "OTP verified. Loading security question...", type: "success" });
        await fetchSecurityQuestion();
      } else {
        const attempts = data.attempts ?? otpAttempts + 1;
        setOtpAttempts(attempts);
        if (data.message === "OTP_EXPIRED") {
          setSettingsMsg({ text: "OTP has expired. Please request a new one.", type: "error" });
        } else if (data.message === "MAX_ATTEMPTS_REACHED") {
          setSettingsMsg({ text: "Maximum attempts reached. Please request a new OTP.", type: "error" });
        } else {
          setSettingsMsg({ text: `Incorrect OTP. ${3 - attempts} attempt(s) remaining.`, type: "error" });
        }
      }
    } catch {
      setSettingsMsg({ text: "Network error. Please try again.", type: "error" });
    } finally {
      setSettingsLoading(false);
    }
  };

  // Step 2.5: Fetch Security Question after successful OTP
  const fetchSecurityQuestion = async () => {
    try {
      const res = await fetch("/api/employee/change-password/question", { cache: "no-store" });
      const data = await res.json();

      if (res.ok && data.question) {
        setSecQuestionId(data.questionId);
        setSecQuestion(data.question);
        setSqAttempts(0);
        setSecAnswer("");
        setSettingsStep("question");
        setSettingsMsg({ text: "", type: "" });
      } else {
        setSettingsMsg({ text: data.message || "Could not load security question.", type: "error" });
      }
    } catch {
      setSettingsMsg({ text: "Error loading security question.", type: "error" });
    }
  };

  // Sanitize security answer input
  const sanitizeSecAnswer = (raw: string) => {
    let s = raw ?? "";
    s = s.replace(EMOJI_LIKE, "");
    if (s.length > 50) s = s.slice(0, 50);
    return s;
  };

  // Step 3: Verify Security Question Answer
  const handleVerifyAnswer = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = secAnswer.trim();
    if (!trimmed) return setSettingsMsg({ text: "Please provide an answer.", type: "error" });
    if (EMOJI_LIKE.test(trimmed)) return setSettingsMsg({ text: "Emojis are not allowed.", type: "error" });

    setSettingsMsg({ text: "", type: "" });
    setSettingsLoading(true);
    try {
      const res = await fetch("/api/employee/change-password/question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: secQuestionId, answer: trimmed }),
      });
      const data = await res.json();

      if (res.ok) {
        setSettingsMsg({ text: "Identity confirmed.", type: "success" });
        setSettingsStep("password");
      } else if (data.message === "ACCOUNT_DISABLED") {
        setSettingsStep("locked");
        setSettingsMsg({ text: "Your account has been disabled due to too many failed attempts. Please contact an admin.", type: "error" });
        setTimeout(() => { window.location.href = "/login"; }, 4000);
      } else {
        const att = data.attempts ?? sqAttempts + 1;
        setSqAttempts(att);
        setSettingsMsg({ text: `Incorrect answer. ${3 - att} attempt(s) remaining.`, type: "error" });
      }
    } catch {
      setSettingsMsg({ text: "Network error. Please try again.", type: "error" });
    } finally {
      setSettingsLoading(false);
    }
  };

  // Password strength helper
  const getPasswordStrength = (pw: string): { level: number; label: string; color: string } => {
    if (!pw) return { level: 0, label: "", color: "transparent" };
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[a-z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (pw.length >= 12) score++;
    if (score <= 2) return { level: 1, label: "Weak", color: "#f8312f" };
    if (score <= 3) return { level: 2, label: "Medium", color: "#f59e0b" };
    return { level: 3, label: "Strong", color: "#4ade80" };
  };

  // Step 4: Submit New Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsMsg({ text: "", type: "" });

    if (!pwdNew || !pwdConfirm) return setSettingsMsg({ text: "Please fill out all fields.", type: "error" });
    if (EMOJI_LIKE.test(pwdNew)) return setSettingsMsg({ text: "Password must not contain emojis.", type: "error" });
    if (pwdNew.length < 8) return setSettingsMsg({ text: "Password must be at least 8 characters.", type: "error" });
    if (pwdNew.length > 30) return setSettingsMsg({ text: "Password must be at most 30 characters.", type: "error" });
    if (!/[A-Z]/.test(pwdNew)) return setSettingsMsg({ text: "Must contain at least one uppercase letter.", type: "error" });
    if (!/[a-z]/.test(pwdNew)) return setSettingsMsg({ text: "Must contain at least one lowercase letter.", type: "error" });
    if (!/[0-9]/.test(pwdNew)) return setSettingsMsg({ text: "Must contain at least one number.", type: "error" });
    if (pwdNew !== pwdConfirm) return setSettingsMsg({ text: "Passwords do not match.", type: "error" });

    setSettingsLoading(true);
    try {
      const res = await fetch("/api/employee/change-password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: pwdNew }),
      });
      const data = await res.json();

      if (res.ok) {
        setSettingsStep("success");
        setSettingsMsg({ text: "Password updated successfully!", type: "success" });
        setTimeout(() => closeSettingsModal(), 3000);
      } else {
        setSettingsMsg({ text: data.message || "Failed to update password.", type: "error" });
      }
    } catch {
      setSettingsMsg({ text: "Network error. Please try again.", type: "error" });
    } finally {
      setSettingsLoading(false);
    }
  };


  const fetchLogs = useCallback(async () => {
    try {
      const ts = new Date().getTime();
      const res = await fetch(`/api/employee/timesheet?t=${ts}`, { cache: "no-store" });
      const data = await res.json();
      if (res.ok && data.days) {
        setTimesheetDays(data.days);
      }
    } catch (e) {
      console.error("Failed to fetch timesheet", e);
    }
  }, []);

  const fetchLedger = useCallback(async () => {
    if (!isClockedIn) return;
    try {
      const ts = new Date().getTime();
      const res = await fetch(`/api/employee/activity/ledger?t=${ts}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setLedgerData(data.ledger || []);
    } catch (error) {
      console.error("Failed to fetch ledger:", error);
    }
  }, [isClockedIn]);

  const handleActivityChange = useCallback(() => {
    fetchLogs();
    fetchLedger();
  }, [fetchLogs, fetchLedger]);

  useEffect(() => {
    if (!isClockedIn) {
      setLedgerData([]);
      return;
    }
    fetchLedger();
    const interval = setInterval(fetchLedger, 5000);
    return () => clearInterval(interval);
  }, [isClockedIn, fetchLedger]);

  const submitTimesheet = useCallback(async () => {
    const allTlogIds: number[] = [];
    for (const day of timesheetDays) {
      for (const act of day.activities || []) {
        if (act.approval_status === "NOT_SUBMITTED" && act.tlog_id) {
          allTlogIds.push(act.tlog_id);
        }
      }
    }

    if (allTlogIds.length === 0) {
      setSubmitMsg({ type: "error", text: "No un-submitted time logs found." });
      return;
    }

    setSubmitLoading(true);
    setSubmitMsg(null);

    try {
      const res = await fetch("/api/employee/timesheet/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tlog_ids: allTlogIds }),
      });

      const data = await res.json();

      if (res.ok) {
        setSubmitMsg({
          type: "success",
          text: "Time logs submitted for review",
        });
        await fetchLogs();
      } else {
        setSubmitMsg({ type: "error", text: data.message || "Submission failed" });
      }
    } catch (e) {
      console.error("Submit timesheet error:", e);
      setSubmitMsg({ type: "error", text: "Failed to submit timesheet" });
    } finally {
      setSubmitLoading(false);
    }
  }, [timesheetDays, fetchLogs]);

  useEffect(() => {
    (async () => {
      try {
        const timeRes = await fetch("/api/system/time", { cache: "no-store" });
        if (timeRes.ok) {
          const timeData = await timeRes.json();
          if (timeData.serverTime) {
            timeOffsetRef.current = timeData.serverTime - performance.now();
            setNow(new Date(performance.now() + timeOffsetRef.current));
          }
        }

        const res = await fetch("/api/employee/clock/status", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));

        const clocked = !!data?.isClockedIn;
        setIsClockedIn(clocked);

        const cin = data?.activeShift?.clock_in_time
          ? new Date(data.activeShift.clock_in_time).getTime()
          : null;
        setClockInTime(cin);

        setAccumulatedMs(data?.accumulatedMs ?? 0);

        setScheduleToday({
          hasSchedule: !!data?.scheduleToday?.hasSchedule,
          shift: data?.scheduleToday?.shift ?? null,
        });

        setUserProfile(data?.userProfile ?? null);
      } finally {
        setLoading(false);
      }
    })();
    fetchLogs();
  }, [fetchLogs]);

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
      } catch { }
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
    if (isClockedIn && clockInTime) {
      const currentSessionMs = now.getTime() - clockInTime;
      return formatDuration(accumulatedMs + currentSessionMs);
    }
    if (accumulatedMs > 0) {
      return formatDuration(accumulatedMs);
    }
    return "00:00";
  }, [isClockedIn, clockInTime, accumulatedMs, now]);

  const currentActivityDuration = useMemo(() => {
    if (isClockedIn && activeActivityStart) {
      return formatDuration(now.getTime() - activeActivityStart);
    }
    return "00:00";
  }, [isClockedIn, activeActivityStart, now]);

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
    return "09:00";
  }, [scheduleToday]);

  const isEarlyClockOut = useMemo(() => {
    if (!scheduleToday.hasSchedule || !scheduleToday.shift?.end_time) return false;
    const end = new Date(scheduleToday.shift.end_time).getTime();
    return now.getTime() < end;
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
      setClockInTime(clockIn ? new Date(clockIn).getTime() : now.getTime());
    } finally {
      setActionBusy(false);
    }
  }, [actionBusy, now]);

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

        if (clockInTime) {
          const currentSessionMs = now.getTime() - clockInTime;
          setAccumulatedMs(prev => prev + currentSessionMs);
        }

        setIsClockedIn(false);
        setClockInTime(null);
        setActiveActivityStart(null);

        setReason("");
        setReasonErr("");
        setShowEarlyModal(false);

        setShowLogoutPrompt(true);
      } finally {
        setActionBusy(false);
      }
    },
    [actionBusy, clockInTime, now]
  );

  const confirmClockOutFlow = () => {
    if (actionBusy) return;

    setModalConfirm(null);

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

  useEffect(() => {
    if (!showEarlyModal) return;
    const err = validateReasonClient(reason);
    setReasonErr(err ?? "");
  }, [reason, showEarlyModal]);

  const submitEarlyReason = () => {
    const err = validateReasonClient(reason);
    if (err) {
      setReasonErr(err);
      setReasonShake(true);
      setTimeout(() => setReasonShake(false), 500);
      return;
    }
    void doClockOut(reason.trim());
  };

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

  useEffect(() => {
    if (activeSection !== "analytics") return;

    const fetchAnalytics = async () => {
      if (!analyticsData) setAnalyticsLoading(true);
      try {
        const today = new Date();
        const dayOfWeek = today.getDay();
        const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const currentMonday = new Date(today);
        currentMonday.setDate(today.getDate() - diff + (analyticsWeekOffset * 7));
        const startDate = currentMonday.toISOString().split('T')[0];

        const res = await fetch(`/api/analytics/dashboard?period=week&startDate=${startDate}`);
        if (res.ok) {
          const data = await res.json();
          setAnalyticsData(data);
        }
      } catch (err) {
        console.error("Failed to fetch analytics", err);
      } finally {
        setAnalyticsLoading(false);
      }
    };

    void fetchAnalytics();
  }, [activeSection, analyticsWeekOffset]);

  const ledgerRows = useMemo(() => {
    if (!isClockedIn || !ledgerData || ledgerData.length === 0) {
      return [];
    }

    return ledgerData.map((log: any) => ({
      code: log.activity_code || "ACT",
      activity: log.activity_name || "Unknown",
      start: log.start_time ? formatShiftTime(log.start_time) : "",
      end: log.end_time ? formatShiftTime(log.end_time) : "...",
      endAccent: !!log.is_active,
    }));
  }, [isClockedIn, ledgerData]);

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
    <>
      <div className="tech-mesh" />

      <div className="split-layout">
        <aside className="info-panel">
          <div className="bg-decor bg-sq-outline sq-top-left" />
          <div className="bg-decor bg-sq-outline sq-mid-left" />
          <div className="bg-decor bg-sq-solid sq-bot-left" />

          <div className="brand-logo">ORASync</div>

          <ul className="nav-links">
            <li className={`nav-item ${activeSection === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveSection('dashboard')}>Dashboard</li>
            <li className={`nav-item ${activeSection === 'calendar' ? 'active' : ''}`} onClick={() => setActiveSection('calendar')}>Calendar</li>
            <li className={`nav-item ${activeSection === 'timesheet' ? 'active' : ''}`} onClick={() => setActiveSection('timesheet')}>Timesheet</li>
            <li className={`nav-item ${activeSection === 'analytics' ? 'active' : ''}`} onClick={() => setActiveSection('analytics')}>Analytics</li>
          </ul>

          <div className="widget-box">
            <div className="label-sm">TODAY&apos;S SCHEDULE</div>
            <div style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--text-main)" }}>
              {scheduleText}
            </div>
            <div className="status-badge go">
              <span className={`dot ${scheduleToday.hasSchedule ? "go" : "warn"}`} />
              <span style={{ marginLeft: 8 }}>{sidebarScheduleStatus}</span>
            </div>
          </div>

          <div ref={profileMenuWrapRef} style={{ position: "relative" }}>
            {profileMenuOpen && (
              <div className="profile-menu active">
                <div
                  className="menu-item"
                  onClick={() => {
                    setProfileMenuOpen(false);
                    setShowSettingsModal(true);
                  }}
                >
                  <span className="menu-icon">⚙</span> Settings
                </div>
                <div className="menu-divider" />
                <div
                  className="menu-item danger"
                  onClick={() => {
                    setProfileMenuOpen(false);
                    if (isClockedIn) {
                      setActiveSessionNotice(true);
                    } else {
                      void doLogout();
                    }
                  }}
                >
                  <span className="menu-icon">⎋</span> Log Out
                </div>
              </div>
            )}

            <div
              className="profile-card"
              onClick={() => setProfileMenuOpen(!profileMenuOpen)}
              title="Click for menu"
            >
              <div className="streak-badge">🔥 {userProfile?.streak_count ?? 12} Day Streak</div>
              <div className="avatar">{avatarText}</div>
              <div className="profile-info">
                <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--text-main)" }}>
                  {profileNameText || "User"}
                </div>
                <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                  {profileMetaText}
                </div>
              </div>
            </div>
          </div>

          {serverMsg && <div style={{ color: "var(--color-warn)", marginTop: 10, fontSize: "0.8rem", padding: "0 10px" }}>{serverMsg}</div>}
        </aside>

        <main className="workspace-panel">


          <div className="content-area" style={{ paddingTop: 25 }}>
            {!isClockedIn ? (
              <div id="layout-initial" className="fade-in" style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div className="landing-card">
                  <div className="hero-clock-label">Current Time</div>
                  <div className="hero-clock-row">
                    {now.toLocaleTimeString("en-US", { timeZone: TIMEZONE, hour12: true, hour: "2-digit", minute: "2-digit" }).split(" ")[0]}
                    <span className="clock-ampm">
                      {now.toLocaleTimeString("en-US", { timeZone: TIMEZONE, hour12: true }).split(" ")[1]}
                    </span>
                  </div>
                  <div className="hero-date-display">
                    {formatDateLine(now)}
                  </div>

                  <button className="btn-clock-in-large" onClick={() => doClockIn()} disabled={actionBusy}>
                    {actionBusy ? "CLOCKING IN..." : "CLOCK IN"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="section-view fade-in" key={activeSection}>
                <div className="section-animate">
                  {activeSection === 'dashboard' && (
                    <>
                      <div className="hud-row">
                        <div className="hud-card">
                          <div className="hud-bg-icon">⏱</div>
                          <div className="hud-label">CURRENT TIME</div>
                          <div className="hud-val accent-cyan">
                            {now.toLocaleTimeString("en-US", { timeZone: TIMEZONE, hour12: true, hour: "2-digit", minute: "2-digit" })}
                          </div>
                          <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: 5, textTransform: "uppercase", letterSpacing: 2 }}>
                            {formatDateLine(now)}
                          </div>
                        </div>
                        <div className="hud-card">
                          <div className="hud-bg-icon">⚡</div>
                          <div className="hud-label">SESSION DURATION</div>
                          <div className="hud-val">
                            {sessionDuration}
                          </div>
                          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: 5, fontFamily: "var(--font-mono)" }}>
                            Target: {targetHours}
                          </div>
                        </div>
                        <div className="hud-card" style={{ borderColor: "var(--accent-blue)" }}>
                          <div className="hud-bg-icon">🔥</div>
                          <div className="hud-label">ACTIVITY DURATION</div>
                          <div className="hud-val warn">
                            {currentActivityDuration}
                          </div>
                          <div className="status-badge warn" style={{ marginTop: 5, alignSelf: "flex-start", fontSize: "0.7rem" }}>
                            Active Task
                          </div>
                        </div>
                      </div>

                      <div className="workspace-grid">
                        <div className="logs-panel">
                          <div className="section-title">
                            <span>Activity Ledger</span>
                            <span className="live-updates-badge">LIVE UPDATES</span>
                          </div>
                          <div className="table-container">
                            <table className="data-table">
                              <thead>
                                <tr>
                                  <th>Code</th>
                                  <th>Activity</th>
                                  <th>Start Time</th>
                                  <th>End Time</th>
                                </tr>
                              </thead>
                              <tbody>
                                {ledgerRows.map((r, i) => (
                                  <tr key={i}>
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

                        <div className="controls-panel">
                          <div className="glass-card" style={{ flex: 1 }}>
                            <div className="section-title">Action Panel</div>
                            <p style={{ color: "var(--text-muted)", marginBottom: 20, fontSize: "0.9rem" }}>
                              Switch tasks below. Time is logged automatically.
                            </p>

                            <ActivityTracker
                              isClockedIn={isClockedIn}
                              onActivityChange={handleActivityChange}
                              onActivityTimeChange={setActiveActivityStart}
                            />

                            <div className="ap-divider" />

                            <div style={{ marginTop: "auto" }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                <div className="label-sm" style={{ margin: 0 }}>SESSION STATUS</div>
                                {clockInTime && (
                                  <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                                    Since {new Date(clockInTime).toLocaleTimeString("en-US", { timeZone: TIMEZONE, hour: '2-digit', minute: '2-digit', hour12: true })}
                                  </div>
                                )}
                              </div>
                              <div className="session-status-box" style={{ marginBottom: 10 }}>
                                CLOCKED IN
                              </div>

                              <button
                                className="btn-ap-danger"
                                onClick={() => setModalConfirm("out")}
                              >
                                CLOCK OUT
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {activeSection === 'timesheet' && (
                    <div className="ts-split">
                      <div className="ts-left">
                        <div className="glass-card" style={{ padding: 20, height: "100%", display: "flex", flexDirection: "column" }}>
                          <div className="section-title"
                            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 15 }}>
                            <span>Timeline Visualization</span>
                            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                              <div style={{ display: "flex", gap: 15, marginRight: 15, borderRight: "1px solid var(--border-subtle)", paddingRight: 15 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  <div style={{ width: 10, height: 10, background: "var(--accent-blue)", borderRadius: 2, boxShadow: "0 0 5px var(--accent-blue)" }} />
                                  <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 600 }}>BILLABLE</span>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  <div style={{ width: 10, height: 10, background: "var(--color-warn)", borderRadius: 2, boxShadow: "0 0 5px var(--color-warn)" }} />
                                  <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 600 }}>NON-BILLABLE</span>
                                </div>
                              </div>
                              <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>24 HOUR SCALE</span>
                            </div>
                          </div>

                          <div className="timeline-date-nav">
                            <button
                              className="timeline-nav-btn"
                              onClick={() => navigateTimelineDate(-1)}
                              title="Previous Day"
                            >
                              ❮
                            </button>
                            <div className="timeline-date-display">
                              <span className="timeline-date-text">{formatTimelineDate(selectedTimelineDate)}</span>
                              <input
                                type="date"
                                className="timeline-date-picker"
                                value={selectedTimelineDate}
                                onChange={(e) => setSelectedTimelineDate(e.target.value)}
                                max={new Date().toISOString().slice(0, 10)}
                              />
                            </div>
                            <button
                              className="timeline-nav-btn"
                              onClick={() => navigateTimelineDate(1)}
                              title="Next Day"
                              disabled={selectedTimelineDate >= new Date().toISOString().slice(0, 10)}
                              style={{ opacity: selectedTimelineDate >= new Date().toISOString().slice(0, 10) ? 0.4 : 1 }}
                            >
                              ❯
                            </button>
                            <button
                              className="timeline-today-btn"
                              onClick={() => setSelectedTimelineDate(new Date().toISOString().slice(0, 10))}
                              disabled={selectedTimelineDate === new Date().toISOString().slice(0, 10)}
                            >
                              Today
                            </button>
                          </div>

                          <div className="gantt-chart-container">
                            <div className="grid-lines" style={selectedDayActivities.length === 0 ? { left: 20 } : undefined}>
                              {[0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24].map(h => (
                                <div key={h} className="grid-line" style={{ left: `${(h / 24) * 100}%` }} />
                              ))}
                            </div>
                            <div className="timeline-header" style={selectedDayActivities.length === 0 ? { marginLeft: 0 } : undefined}>
                              {[0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24].map(h => {
                                const lab = h === 0 || h === 24 ? "12 AM" : h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`;
                                return (
                                  <div key={h} className="time-marker" style={{ left: `${(h / 24) * 100}%`, transform: "translateX(-50%)" }}>{lab}</div>
                                );
                              })}
                            </div>

                            <div id="gantt-body" key={selectedTimelineDate}>
                              {selectedDayActivities.map((act: any, idx: number) => {
                                if (!act.start_time || !act.end_time) return null;

                                const parseTime = (t: string) => {
                                  const [hh, mm] = t.split(':').map(Number);
                                  return hh * 60 + mm;
                                };

                                const startMin = parseTime(act.start_time);
                                let endMin = parseTime(act.end_time);

                                if (endMin < startMin) endMin += 1440;

                                const totalMin = 1440;
                                const left = (startMin / totalMin) * 100;
                                const width = ((endMin - startMin) / totalMin) * 100;

                                const barClass = act.is_billable ? 'bar-B' : 'bar-NB';

                                return (
                                  <div key={`${selectedTimelineDate}-${idx}`} className="gantt-row">
                                    <div className="gantt-label" title={act.activity_name}>{act.activity_name}</div>
                                    <div className="gantt-track">
                                      <div
                                        className={`gantt-bar ${barClass}`}
                                        style={{ left: `${left}%`, width: `${Math.max(0.5, width)}%` }}
                                        onMouseEnter={(e) => {
                                          const r = e.currentTarget.getBoundingClientRect();
                                          setGanttTip({
                                            x: r.left + r.width / 2,
                                            y: r.top - 8,
                                            text: `${act.start_time} - ${act.end_time}`,
                                            sub: act.total_hours ? formatHoursMinutes(Number(act.total_hours)) : undefined,
                                          });
                                        }}
                                        onMouseLeave={() => setGanttTip(null)}
                                      />
                                    </div>
                                  </div>
                                )
                              })}
                              {selectedDayActivities.length === 0 && (
                                <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)", position: "absolute", top: "50%", left: 0, width: "100%", transform: "translateY(-50%)" }}>
                                  <div style={{ marginBottom: 10, fontSize: "1.5rem", opacity: 0.5 }}>📊</div>
                                  No activity data for {formatTimelineDate(selectedTimelineDate)}.
                                  {selectedTimelineDate === new Date().toISOString().slice(0, 10) && (
                                    <div style={{ marginTop: 10, fontSize: "0.8rem" }}>(Clock in to start tracking)</div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="ts-right">
                        <div className="glass-card" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", padding: 0 }}>
                          <div className="detail-log-header">
                            <div className="section-title" style={{ padding: "20px 20px 0 20px", marginBottom: 0, borderBottom: "none" }}>Detailed Logs</div>
                            <div className="detail-log-tabs">
                              {([
                                { key: "NOT_SUBMITTED" as const, label: "Not Submitted", color: "#9ca3af" },
                                { key: "PENDING" as const, label: "Pending", color: "#eab308" },
                                { key: "REJECTED" as const, label: "Rejected", color: "#ef4444" },
                                { key: "APPROVED" as const, label: "Approved", color: "#22c55e" },
                              ]).map(tab => (
                                <button
                                  key={tab.key}
                                  className={`detail-log-tab ${detailLogTab === tab.key ? "active" : ""}`}
                                  onClick={() => setDetailLogTab(tab.key)}
                                  style={detailLogTab === tab.key ? { "--tab-color": tab.color } as React.CSSProperties : undefined}
                                >
                                  {tab.label}
                                  <span className="detail-log-tab-count" style={detailLogTab === tab.key ? { background: tab.color, color: "#000" } : undefined}>
                                    {detailLogTabCounts[tab.key]}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="table-container" style={{ flex: 1, overflowY: "auto" }}>
                            <table className="data-table">
                              <thead>
                                <tr>
                                  <th style={{ minWidth: 130 }}>Date</th>
                                  <th>Activity Name</th>
                                  <th>Start</th>
                                  <th>End</th>
                                  <th>Duration</th>
                                  <th>Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {filteredTimesheetLogs.map(day => (
                                  day.activities.map((act: any, idx: number) => (
                                    <tr key={`${day.date}-${idx}-tr`}>
                                      <td>{day.date}</td>
                                      <td style={{ fontWeight: 600 }}>{act.activity_name}</td>
                                      <td>{act.start_time || "-"}</td>
                                      <td>{act.end_time || "..."}</td>
                                      <td>{act.total_hours ? formatHoursMinutes(Number(act.total_hours)) : "-"}</td>
                                      <td>
                                        <span style={{
                                          padding: "2px 8px",
                                          borderRadius: 4,
                                          fontSize: "0.75rem",
                                          fontWeight: 600,
                                          backgroundColor: act.approval_status === "NOT_SUBMITTED" ? "rgba(156, 163, 175, 0.2)" :
                                            act.approval_status === "PENDING" ? "rgba(234, 179, 8, 0.2)" :
                                              act.approval_status === "SUPERVISOR_APPROVED" ? "rgba(34, 197, 94, 0.2)" :
                                                act.approval_status === "REJECTED" ? "rgba(239, 68, 68, 0.2)" : "rgba(100, 100, 100, 0.2)",
                                          color: act.approval_status === "NOT_SUBMITTED" ? "#9ca3af" :
                                            act.approval_status === "PENDING" ? "#eab308" :
                                              act.approval_status === "SUPERVISOR_APPROVED" ? "#22c55e" :
                                                act.approval_status === "REJECTED" ? "#ef4444" : "#888",
                                        }}>
                                          {act.approval_status ? act.approval_status.replace('_', ' ') : "—"}
                                        </span>
                                      </td>
                                    </tr>
                                  ))
                                ))}
                                {filteredTimesheetLogs.length === 0 && (
                                  <tr><td colSpan={6} style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
                                    <div style={{ fontSize: "1.3rem", marginBottom: 6, opacity: 0.4 }}>
                                      {detailLogTab === "NOT_SUBMITTED" ? "📝" : detailLogTab === "PENDING" ? "⏳" : detailLogTab === "REJECTED" ? "❌" : "✅"}
                                    </div>
                                    No {detailLogTab === "NOT_SUBMITTED" ? "unsubmitted" : detailLogTab.toLowerCase()} logs found.
                                  </td></tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        <div className="ts-status-bar">
                          <div className="ts-status-info">
                            <div className="label-sm" style={{ marginBottom: 4 }}>TIMESHEET STATUS</div>
                            <div className="status-badge warn"><span className="dot" /> DRAFT</div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            {submitMsg && (
                              <div style={{
                                padding: "6px 12px",
                                borderRadius: 6,
                                fontSize: "0.85rem",
                                backgroundColor: submitMsg.type === "success" ? "rgba(34, 197, 94, 0.2)" : "rgba(239, 68, 68, 0.2)",
                                color: submitMsg.type === "success" ? "#22c55e" : "#ef4444",
                              }}>
                                {submitMsg.text}
                              </div>
                            )}
                            <button
                              className="ts-submit-btn"
                              onClick={() => setShowSubmitConfirm(true)}
                              disabled={submitLoading}
                              style={{ opacity: submitLoading ? 0.6 : 1 }}
                            >
                              <span style={{ marginRight: 8 }}>{submitLoading ? "⏳" : ""}</span>
                              {submitLoading ? "Submitting..." : "Submit for Review"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeSection === 'calendar' && (
                    <div className="glass-card" style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden", padding: 25 }}>
                      <div className="calendar-header-bar">
                        <div className="cal-controls">
                          <button className="cal-nav-btn" onClick={() => calNavigate(-1)}>❮</button>
                          <span style={{ minWidth: 180, textAlign: "center", fontFamily: "var(--font-main)", fontWeight: 700, fontSize: "1.1rem", textTransform: "uppercase", letterSpacing: 1 }}>
                            {getCalendarTitle()}
                          </span>
                          <button className="cal-nav-btn" onClick={() => calNavigate(1)}>❯</button>
                        </div>

                        <div style={{ display: "flex", gap: 15, alignItems: "center" }}>
                          <button className="calendar-add-btn" onClick={() => openFutureModal()}>
                            + Add Future Activity
                          </button>
                          <div className="cal-toggles">
                            <button className={`cal-view-btn ${calView === 'week' ? 'active' : ''}`} onClick={() => setCalView('week')}>Week</button>
                            <button className={`cal-view-btn ${calView === 'month' ? 'active' : ''}`} onClick={() => setCalView('month')}>Month</button>
                          </div>
                        </div>
                      </div>

                      <div className={`calendar-grid view-${calView}`}>
                        {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map(d => (
                          <div key={d} className="cal-day-header">{d}</div>
                        ))}

                        {(() => {
                          const days = [];
                          const currMonth = calDate.getMonth();
                          const start = new Date(calDate);
                          let loopCount = 0;
                          const today = new Date(performance.now() + timeOffsetRef.current);
                          today.setHours(0, 0, 0, 0);

                          if (calView === 'week') {
                            const day = start.getDay();
                            const diff = day === 0 ? 6 : day - 1;
                            start.setDate(start.getDate() - diff);
                            loopCount = 7;
                          } else {
                            start.setDate(1);
                            const firstDay = start.getDay();
                            const diff = firstDay === 0 ? 6 : firstDay - 1;
                            start.setDate(start.getDate() - diff);
                            loopCount = 42;
                          }

                          const runner = new Date(start);

                          for (let i = 0; i < loopCount; i++) {
                            const dateNum = runner.getDate();
                            const isToday = runner.toDateString() === new Date().toDateString();
                            const isDiffMonth = runner.getMonth() !== currMonth && calView === 'month';

                            const year = runner.getFullYear();
                            const monthStr = String(runner.getMonth() + 1).padStart(2, "0");
                            const dayStr = String(dateNum).padStart(2, "0");
                            const dateKey = `${year}-${monthStr}-${dayStr}`;

                            const dayData = calendar[dateKey];
                            const dayFutureActivities = futureSchedules[dateKey] || [];
                            const cellDate = new Date(runner);
                            cellDate.setHours(0, 0, 0, 0);
                            const isFutureDate = cellDate >= today;
                            const hasShift = dayData && !dayData.off;
                            const canAddActivity = isFutureDate && hasShift && !isDiffMonth;

                            days.push(
                              <div
                                key={i}
                                className={`cal-day ${isDiffMonth ? 'diff-month' : ''} ${hasShift ? 'is-scheduled' : ''} ${isToday ? 'today' : ''} ${dayFutureActivities.length > 0 ? 'has-future-activity' : ''}`}
                                onClick={() => canAddActivity && openFutureModal(dateKey)}
                                style={{ cursor: canAddActivity ? 'pointer' : 'default' }}
                              >
                                <div className="cal-date-num">{dateNum}</div>

                                {!isDiffMonth && dayData && (
                                  dayData.off ? (
                                    <div className="cal-chip" style={{ opacity: 0.5, background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}>
                                      Off
                                    </div>
                                  ) : (
                                    <>
                                      <div className="cal-chip chip-shift">
                                        {dayData.shift_name}
                                      </div>
                                      {calView === 'week' ? (
                                        <>
                                          <div className="cal-chip" style={{ background: 'rgba(0, 242, 255, 0.1)', color: 'var(--accent-cyan)' }}>
                                            {formatShiftTime(dayData.start_time)} - {formatShiftTime(dayData.end_time)}
                                          </div>
                                          {dayData.activity && (
                                            <div className="cal-chip" style={{ background: 'rgba(15, 52, 166, 0.2)', color: 'var(--accent-blue)' }}>
                                              {dayData.activity}
                                            </div>
                                          )}
                                        </>
                                      ) : (
                                        <div className="cal-chip" style={{ fontSize: '0.65rem', opacity: 0.8 }}>
                                          {formatShiftTime(dayData.start_time)}
                                        </div>
                                      )}
                                    </>
                                  )
                                )}

                                {!isDiffMonth && dayFutureActivities.length > 0 && (
                                  <div className="future-activities-list">
                                    {dayFutureActivities.map((fs: any) => (
                                      <div
                                        key={fs.fts_id}
                                        className="future-activity-item"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <span className="future-activity-name">{fs.activity_name}</span>
                                        <span className="future-activity-time">{fs.start_time}-{fs.end_time}</span>
                                        <button
                                          className="future-activity-delete"
                                          onClick={(e) => { e.stopPropagation(); deleteFutureActivity(fs.fts_id); }}
                                          title="Delete"
                                        >
                                          ×
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                            runner.setDate(runner.getDate() + 1);
                          }
                          return days;
                        })()}
                      </div>

                      {showFutureModal && (
                        <div className="calendar-modal-overlay">
                          <div className="calendar-modal">
                            <div className="calendar-modal-header">
                              <h3>Add Future Activity</h3>
                              <button className="calendar-modal-close" onClick={closeFutureModal}>×</button>
                            </div>
                            <form onSubmit={submitFutureActivity} className="calendar-modal-form">
                              <div className="calendar-modal-field">
                                <label htmlFor="modal-date">Date</label>
                                <input
                                  type="date"
                                  id="modal-date"
                                  value={futureModalDate}
                                  onChange={(e) => handleFutureDateChange(e.target.value)}
                                  min={new Date().toISOString().split("T")[0]}
                                  required
                                />
                                {futureModalShiftTimes && (
                                  <span className="shift-time-hint">
                                    Shift: {futureModalShiftTimes.start} - {futureModalShiftTimes.end}
                                  </span>
                                )}
                              </div>

                              <div className="calendar-modal-field">
                                <label htmlFor="modal-activity">Activity</label>
                                <select
                                  id="modal-activity"
                                  value={futureModalActivity}
                                  onChange={(e) => setFutureModalActivity(e.target.value)}
                                  required
                                >
                                  <option value="">Select an activity</option>
                                  {activityList.map((act: any) => (
                                    <option key={act.activity_id} value={act.activity_id}>
                                      {act.activity_name} ({act.activity_code})
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div className="calendar-modal-time-row">
                                <div className="calendar-modal-field">
                                  <label htmlFor="modal-start-time">Start Time</label>
                                  <input
                                    type="time"
                                    id="modal-start-time"
                                    value={futureModalStartTime}
                                    onChange={(e) => setFutureModalStartTime(e.target.value)}
                                    required
                                  />
                                </div>
                                <div className="calendar-modal-field">
                                  <label htmlFor="modal-end-time">End Time</label>
                                  <input
                                    type="time"
                                    id="modal-end-time"
                                    value={futureModalEndTime}
                                    onChange={(e) => setFutureModalEndTime(e.target.value)}
                                    required
                                  />
                                </div>
                              </div>

                              {futureModalError && <div className="calendar-modal-error">{futureModalError}</div>}

                              <div className="calendar-modal-actions">
                                <button type="button" className="calendar-modal-cancel" onClick={closeFutureModal}>
                                  Cancel
                                </button>
                                <button type="submit" className="calendar-modal-submit" disabled={futureModalSaving}>
                                  {futureModalSaving ? "Saving..." : "Save Activity"}
                                </button>
                              </div>
                            </form>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {activeSection === 'analytics' && (
                    <div className="section-view fade-in">
                      {analyticsLoading ? (
                        <div className="analytics-loading">
                          <div className="spinner"></div>
                          <span style={{ fontSize: "0.9rem", letterSpacing: 1, opacity: 0.7 }}>FETCHING DATA...</span>
                        </div>
                      ) : (
                        <div className="analytics-content-enter" style={{ height: "100%", display: "flex", flexDirection: "column", gap: 20 }}>
                          <div className="stats-row">
                            <div className="stat-box">
                              <div className="label-sm" style={{ marginBottom: 5 }}>
                                HOURS THIS WEEK
                              </div>
                              <div className="stat-big">
                                {formatHoursMinutes(analyticsData?.summary?.totalHours)}
                              </div>
                            </div>
                            <div className="stat-box">
                              <div className="label-sm" style={{ marginBottom: 5 }}>
                                BILLABLE HOURS
                              </div>
                              <div className="stat-big" style={{ color: "var(--color-go)" }}>
                                {formatHoursMinutes(analyticsData?.summary?.billableHours)}
                              </div>
                            </div>
                            <div className="stat-box" style={{ borderColor: "var(--accent-cyan)" }}>
                              <div className="label-sm" style={{ marginBottom: 5 }}>
                                WEEKLY ACTIVITY %
                              </div>
                              <div className="stat-big">
                                {(() => {
                                  const total = analyticsData?.summary?.totalHours || 0;
                                  const target = 40;
                                  const pct = total > 0 ? (total / target) * 100 : 0;
                                  return pct.toFixed(1);
                                })()} <span style={{ fontSize: "1rem", color: "var(--text-main)" }}>%</span>
                              </div>
                            </div>
                          </div>

                          <div className="glass-card" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", padding: 25 }}>
                            <div className="section-title">
                              Hours Worked vs Target
                              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                <button
                                  className="cal-nav-btn"
                                  onClick={() => setAnalyticsWeekOffset(prev => prev - 1)}
                                  style={{ padding: "6px 12px" }}
                                >
                                  ◀
                                </button>
                                <span style={{ minWidth: 140, textAlign: "center", fontSize: "0.85rem", fontWeight: 600 }}>
                                  {(() => {
                                    const today = new Date();
                                    const dayOfWeek = today.getDay();
                                    const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
                                    const monday = new Date(today);
                                    monday.setDate(today.getDate() - diff + (analyticsWeekOffset * 7));
                                    const sunday = new Date(monday);
                                    sunday.setDate(monday.getDate() + 6);
                                    const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                                    return `${fmt(monday)} - ${fmt(sunday)}`;
                                  })()}
                                </span>
                                <button
                                  className="cal-nav-btn"
                                  onClick={() => setAnalyticsWeekOffset(prev => Math.min(prev + 1, 0))}
                                  disabled={analyticsWeekOffset >= 0}
                                  style={{ padding: "6px 12px", opacity: analyticsWeekOffset >= 0 ? 0.4 : 1 }}
                                >
                                  ▶
                                </button>
                                {analyticsWeekOffset !== 0 && (
                                  <button
                                    onClick={() => setAnalyticsWeekOffset(0)}
                                    style={{ fontSize: "0.75rem", padding: "4px 10px", borderRadius: 4, background: "var(--accent)", color: "#fff", border: "none", cursor: "pointer" }}
                                  >
                                    Today
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className="graph-container" key={analyticsWeekOffset}>
                              {(() => {
                                const days = [];
                                const today = new Date();
                                const TARGET_HOURS = 9;
                                const MAX_SCALE = 12;

                                const currentDay = today.getDay();
                                const diff = currentDay === 0 ? 6 : currentDay - 1;
                                const monday = new Date(today);
                                monday.setDate(today.getDate() - diff + (analyticsWeekOffset * 7));

                                for (let i = 0; i < 7; i++) {
                                  const d = new Date(monday);
                                  d.setDate(monday.getDate() + i);
                                  const dateKey = d.toISOString().split('T')[0];
                                  const dayName = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
                                  const hours = analyticsData?.dailyHours?.[dateKey] || 0;

                                  const actualHeight = Math.min((hours / MAX_SCALE) * 100, 100);
                                  const targetHeight = (TARGET_HOURS / MAX_SCALE) * 100;

                                  let barColor = "var(--bg-card)";
                                  if (hours > 0) {
                                    if (hours > TARGET_HOURS) barColor = "var(--accent-cyan)";
                                    else if (hours >= TARGET_HOURS - 0.5) barColor = "var(--color-go)";
                                    else if (hours > 5) barColor = "var(--color-warn)";
                                    else barColor = "var(--color-urgent)";
                                  }

                                  days.push(
                                    <div key={dateKey} className="bar-group">
                                      <div className="bar-target" style={{ height: `${targetHeight}%` }} />

                                      <div className="bar" style={{ height: `${actualHeight}%`, background: barColor, zIndex: 2, opacity: 0.9 }} />

                                      <div className="bar-label">{dayName}</div>

                                      {hours > 0 && (
                                        <div style={{ position: "absolute", bottom: `${actualHeight + 2}%`, color: "var(--text-main)", fontSize: "0.7rem", fontWeight: 700, zIndex: 3 }}>
                                          {formatHoursMinutes(hours)}
                                        </div>
                                      )}
                                    </div>
                                  );
                                }
                                return days;
                              })()}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                </div>
              </div>
            )}
          </div>
        </main >
      </div >

      {/* 🚨 MULTI-STEP SETTINGS MODAL */}
      {showSettingsModal && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ width: 600, position: 'relative' }}>
            <button className="calendar-modal-close" onClick={closeSettingsModal} style={{ position: 'absolute', top: 16, right: 16, zIndex: 2 }}>×</button>
            <div className="modal-header header-normal">
              <span style={{ fontSize: "1.5rem" }}>⚙️</span>
              <span className="modal-title">ACCOUNT SETTINGS</span>
            </div>

            <div className="modal-body" style={{ textAlign: "left", display: "flex", flexDirection: "column", gap: 20 }}>

              {/* Step indicator dots */}
              {settingsStep !== "menu" && settingsStep !== "success" && settingsStep !== "locked" && (
                <div className="cpw-step-indicator">
                  <div className={`cpw-step-dot ${settingsStep === "otp" ? "active" : "done"}`}>1</div>
                  <div className="cpw-step-line" />
                  <div className={`cpw-step-dot ${settingsStep === "question" ? "active" : settingsStep === "password" ? "done" : ""}`}>2</div>
                  <div className="cpw-step-line" />
                  <div className={`cpw-step-dot ${settingsStep === "password" ? "active" : ""}`}>3</div>
                </div>
              )}

              {settingsStep === "menu" && (
                <>
                  <div style={{ paddingBottom: 20, borderBottom: '1px solid var(--border-subtle)' }}>
                    <h4 style={{ marginBottom: 12, color: "var(--text-muted)", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: 2, fontWeight: 600 }}>Appearance</h4>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: "0.9rem", color: "var(--text-main)" }}>Dashboard Theme</span>
                      <button className="btn-standard" onClick={toggleTheme} style={{ padding: "6px 16px", fontSize: "0.8rem", flexShrink: 0 }}>
                        {lightMode ? "Switch to Dark Mode 🌙" : "Switch to Light Mode ☀️"}
                      </button>
                    </div>
                  </div>

                  <div style={{ paddingBottom: 10 }}>
                    <h4 style={{ marginBottom: 12, color: "var(--text-muted)", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: 2, fontWeight: 600 }}>Password</h4>
                    <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: 15 }}>
                      Change your password through a secure multi-step verification process. An OTP will be sent to your registered email.
                    </p>

                    <button className="btn-standard" onClick={handleRequestOTP} disabled={settingsLoading} style={{ width: "100%" }}>
                      {settingsLoading ? "SENDING OTP..." : "🔒 CHANGE PASSWORD"}
                    </button>

                    {settingsMsg.text && (
                      <div style={{ color: settingsMsg.type === "error" ? "var(--color-warn)" : "var(--color-go)", fontSize: "0.8rem", marginTop: 10, textAlign: "center" }}>
                        {settingsMsg.text}
                      </div>
                    )}
                  </div>
                </>
              )}

              {settingsStep === "otp" && (
                <div className="fade-in" style={{ background: "rgba(255,255,255,0.03)", padding: 15, borderRadius: 8, border: "1px solid var(--border-subtle)" }}>
                  <h4 style={{ marginBottom: 6, color: "var(--text-main)", fontSize: "0.9rem", textTransform: "uppercase", letterSpacing: 1 }}>Step 1: OTP Verification</h4>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 15 }}>
                    Enter the 6-digit code sent to your registered email.
                  </p>

                  <form onSubmit={handleVerifyOTP} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div>
                      <label className="label-sm">6-DIGIT OTP CODE</label>
                      <input
                        type="text"
                        className="input-rounded cpw-otp-input"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder="000000"
                        maxLength={6}
                        autoComplete="one-time-code"
                      />
                    </div>

                    {/* Status info row */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.75rem" }}>
                      <div style={{ color: "var(--text-muted)" }}>
                        Attempts: <span style={{ color: otpAttempts >= 2 ? "var(--color-warn)" : "var(--text-main)", fontWeight: 700 }}>{otpAttempts}/3</span>
                      </div>
                      <div style={{ color: "var(--text-muted)" }}>
                        OTP Requests Today: <span style={{ color: otpDailyCount >= 4 ? "var(--color-warn)" : "var(--text-main)", fontWeight: 700 }}>{otpDailyCount}/5</span>
                      </div>
                    </div>

                    {/* Countdown + Resend */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      {otpCountdown > 0 ? (
                        <div className="cpw-countdown">
                          <span className="cpw-countdown-icon">⏱</span>
                          <span>Code expires in <strong>{Math.floor(otpCountdown / 60)}:{(otpCountdown % 60).toString().padStart(2, "0")}</strong></span>
                        </div>
                      ) : (
                        <div style={{ fontSize: "0.8rem", color: "var(--color-warn)" }}>OTP expired</div>
                      )}
                      <button
                        type="button"
                        className="cpw-resend-btn"
                        onClick={handleResendOTP}
                        disabled={otpCountdown > 0 || otpDailyCount >= 5 || settingsLoading}
                      >
                        {otpCountdown > 0 ? `Resend in ${otpCountdown}s` : "Resend OTP"}
                      </button>
                    </div>

                    {settingsMsg.text && (
                      <div style={{ color: settingsMsg.type === "error" ? "var(--color-warn)" : "var(--color-go)", fontSize: "0.8rem", fontWeight: 600, textAlign: "center" }}>
                        {settingsMsg.text}
                      </div>
                    )}

                    <div style={{ display: "flex", gap: 10, marginTop: 5 }}>
                      <button type="button" className="btn-cancel" onClick={() => { closeSettingsModal(); }} style={{ flex: 1 }}>CANCEL</button>
                      <button type="submit" className="btn-standard" disabled={settingsLoading || otpAttempts >= 3} style={{ flex: 1 }}>
                        {settingsLoading ? "VERIFYING..." : "VERIFY OTP"}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {settingsStep === "question" && (
                <div className="fade-in" style={{ background: "rgba(255,255,255,0.03)", padding: 15, borderRadius: 8, border: "1px solid var(--border-subtle)" }}>
                  <h4 style={{ marginBottom: 6, color: "var(--text-main)", fontSize: "0.9rem", textTransform: "uppercase", letterSpacing: 1 }}>Step 2: Security Question</h4>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 15 }}>
                    Answer the security question below to verify your identity.
                  </p>

                  <form onSubmit={handleVerifyAnswer} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div>
                      <label className="label-sm">YOUR QUESTION</label>
                      <div style={{ background: "rgba(0,0,0,0.25)", padding: "12px 14px", borderRadius: 8, fontSize: "0.9rem", color: "var(--text-main)", marginBottom: 10, fontStyle: "italic", borderLeft: "3px solid var(--accent-cyan, #4ade80)" }}>
                        {secQuestion}
                      </div>
                      <label className="label-sm">YOUR ANSWER</label>
                      <input
                        type="text"
                        className="input-rounded"
                        value={secAnswer}
                        onChange={(e) => setSecAnswer(sanitizeSecAnswer(e.target.value))}
                        placeholder="Type your answer..."
                        maxLength={50}
                      />
                      <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: 4 }}>
                        {secAnswer.length}/50 characters • No emojis allowed
                      </div>
                    </div>

                    {/* Attempt counter */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.75rem" }}>
                      <div style={{ color: "var(--text-muted)" }}>
                        Attempts: <span style={{ color: sqAttempts >= 2 ? "#f8312f" : "var(--text-main)", fontWeight: 700 }}>{sqAttempts}/3</span>
                      </div>
                      {sqAttempts >= 2 && (
                        <div style={{ color: "#f8312f", fontWeight: 700, fontSize: "0.75rem" }}>
                          ⚠ Last attempt — account will be locked
                        </div>
                      )}
                    </div>

                    {settingsMsg.text && (
                      <div style={{ color: settingsMsg.type === "error" ? "var(--color-warn)" : "var(--color-go)", fontSize: "0.8rem", fontWeight: 600, textAlign: "center" }}>
                        {settingsMsg.text}
                      </div>
                    )}

                    <div style={{ display: "flex", gap: 10, marginTop: 5 }}>
                      <button type="button" className="btn-cancel" onClick={() => closeSettingsModal()} style={{ flex: 1 }}>CANCEL</button>
                      <button type="submit" className="btn-standard" disabled={settingsLoading} style={{ flex: 1 }}>
                        {settingsLoading ? "VERIFYING..." : "CONFIRM IDENTITY"}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {settingsStep === "password" && (
                <div className="fade-in" style={{ background: "rgba(255,255,255,0.03)", padding: 15, borderRadius: 8, border: "1px solid var(--border-subtle)" }}>
                  <h4 style={{ marginBottom: 6, color: "var(--text-main)", fontSize: "0.9rem", textTransform: "uppercase", letterSpacing: 1 }}>Step 3: New Password</h4>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 15 }}>
                    Must contain uppercase, lowercase, and numbers. 8-30 characters. No emojis.
                  </p>

                  <form onSubmit={handleResetPassword} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div>
                      <label className="label-sm">NEW PASSWORD</label>
                      <div style={{ position: "relative" }}>
                        <input
                          type={showPwdNew ? "text" : "password"}
                          className="input-rounded"
                          value={pwdNew}
                          onChange={(e) => setPwdNew(e.target.value)}
                          placeholder="At least 8 characters"
                          maxLength={30}
                          style={{ paddingRight: 40 }}
                        />
                        <button type="button" onClick={() => setShowPwdNew(!showPwdNew)} className="cpw-eye-btn">
                          {showPwdNew ? "🙈" : "👁"}
                        </button>
                      </div>
                    </div>

                    {/* Password strength bar */}
                    {pwdNew && (() => {
                      const s = getPasswordStrength(pwdNew);
                      return (
                        <div>
                          <div className="cpw-strength-bar">
                            <div className="cpw-strength-fill" style={{ width: `${(s.level / 3) * 100}%`, background: s.color }} />
                          </div>
                          <div style={{ fontSize: "0.7rem", color: s.color, fontWeight: 600, marginTop: 3 }}>{s.label}</div>
                        </div>
                      );
                    })()}

                    <div>
                      <label className="label-sm">CONFIRM NEW PASSWORD</label>
                      <div style={{ position: "relative" }}>
                        <input
                          type={showPwdConfirm ? "text" : "password"}
                          className="input-rounded"
                          value={pwdConfirm}
                          onChange={(e) => setPwdConfirm(e.target.value)}
                          placeholder="Re-enter new password"
                          maxLength={30}
                          style={{ paddingRight: 40 }}
                        />
                        <button type="button" onClick={() => setShowPwdConfirm(!showPwdConfirm)} className="cpw-eye-btn">
                          {showPwdConfirm ? "🙈" : "👁"}
                        </button>
                      </div>
                      {pwdConfirm && pwdNew !== pwdConfirm && (
                        <div style={{ fontSize: "0.75rem", color: "var(--color-warn)", marginTop: 4 }}>Passwords do not match</div>
                      )}
                    </div>

                    {settingsMsg.text && (
                      <div style={{ color: settingsMsg.type === "success" ? "var(--color-go)" : "var(--color-warn)", fontSize: "0.8rem", marginTop: 5, fontWeight: 600, textAlign: "center" }}>
                        {settingsMsg.text}
                      </div>
                    )}

                    <div style={{ display: "flex", gap: 10, marginTop: 5 }}>
                      <button type="button" className="btn-cancel" onClick={() => closeSettingsModal()} style={{ flex: 1 }}>CANCEL</button>
                      <button type="submit" className="btn-standard" disabled={settingsLoading} style={{ flex: 1 }}>
                        {settingsLoading ? "SAVING..." : "SAVE PASSWORD"}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {settingsStep === "success" && (
                <div className="fade-in" style={{ textAlign: "center", padding: "30px 20px" }}>
                  <div style={{ fontSize: "3rem", marginBottom: 15 }}>✅</div>
                  <h3 style={{ color: "var(--color-go)", marginBottom: 10, textTransform: "uppercase", letterSpacing: 2, fontSize: "1rem" }}>Password Updated</h3>
                  <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
                    Your password has been changed successfully. This dialog will close automatically.
                  </p>
                </div>
              )}

              {settingsStep === "locked" && (
                <div className="fade-in" style={{ textAlign: "center", padding: "30px 20px" }}>
                  <div style={{ fontSize: "3rem", marginBottom: 15 }}>🔒</div>
                  <h3 style={{ color: "#f8312f", marginBottom: 10, textTransform: "uppercase", letterSpacing: 2, fontSize: "1rem" }}>Account Locked</h3>
                  <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: 10 }}>
                    Your account has been disabled due to too many failed security question attempts. You will be redirected to the login page.
                  </p>
                  <p style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>
                    Please contact an administrator to re-enable your account.
                  </p>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* MODALS */}
      {
        modalConfirm === "out" && (
          <div className="modal-overlay">
            <div className="modal-card">
              <div className="modal-header header-normal">
                <span style={{ fontSize: "1.5rem" }}>🕒</span>
                <span className="modal-title">CONFIRM CLOCK OUT</span>
              </div>
              <div className="modal-body">
                <p className="modal-desc">
                  Are you sure you want to end your shift?
                </p>
              </div>
              <div className="modal-footer">
                <button className="btn-cancel" onClick={() => setModalConfirm(null)}>CANCEL</button>
                <button className="btn-standard" onClick={confirmClockOutFlow}>CLOCK OUT</button>
              </div>
            </div>
          </div>
        )
      }

      {
        showEarlyModal && (
          <div className="modal-overlay">
            <div className="modal-card">
              <div className="modal-header header-urgent">
                <span style={{ fontSize: "1.5rem" }}>⚠️</span>
                <span className="modal-title" style={{ color: "var(--color-urgent)" }}>COMPLIANCE ALERT</span>
              </div>

              <div className="modal-body">
                <p className="modal-desc">
                  You are attempting to clock out before meeting the daily 9-hour requirement. This action will be logged.
                </p>

                <div className="modal-stats">
                  <div className="stat-item">
                    <span className="stat-label">CURRENT SESSION</span>
                    <span className="stat-val val-urgent">{sessionDuration}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">TARGET DURATION</span>
                    <span className="stat-val">09:00</span>
                  </div>
                </div>

                <div>
                  <label className="label-sm" style={{ color: "var(--color-urgent)", marginBottom: 8, display: "block" }}>
                    COMPLIANCE JUSTIFICATION LOG
                  </label>
                  <input
                    className={`input-rounded ${reasonShake ? "shake" : ""}`}
                    placeholder="Enter reason for early log out..."
                    value={reason}
                    onChange={onReasonChange}
                    onPaste={onReasonPaste}
                    onBeforeInput={(e: any) => onReasonBeforeInput(e)}
                    style={{ borderColor: "var(--color-urgent)", background: "rgba(248, 49, 47, 0.05)" }}
                  />
                  {reasonErr && <div style={{ color: "var(--color-urgent)", marginTop: 5, fontSize: "0.8rem" }}>{reasonErr}</div>}
                </div>
              </div>

              <div className="modal-footer">
                <button className="btn-cancel" onClick={() => setShowEarlyModal(false)}>CANCEL</button>
                <button className="btn-urgent" onClick={submitEarlyReason}>CONFIRM EARLY EXIT</button>
              </div>
            </div>
          </div>
        )
      }

      {
        showLogoutPrompt && (
          <div className="modal-overlay">
            <div className="modal-card">
              <div className="modal-header header-normal">
                <span style={{ fontSize: "1.5rem" }}>👋</span>
                <span className="modal-title">SHIFT ENDED</span>
              </div>
              <div className="modal-body">
                <p className="modal-desc">
                  Do you want to log out now?
                </p>
              </div>
              <div className="modal-footer">
                <button className="btn-cancel" onClick={() => setShowLogoutPrompt(false)}>
                  STAY HERE
                </button>
                <button className="btn-standard" onClick={() => void doLogout()}>
                  LOG OUT
                </button>
              </div>
            </div>
          </div>
        )
      }

      {
        showSubmitConfirm && (
          <div className="modal-overlay">
            <div className="modal-card">
              <div className="modal-header header-normal">
                <span style={{ fontSize: "1.5rem" }}></span>
                <span className="modal-title">SUBMIT TIMESHEET</span>
              </div>
              <div className="modal-body">
                <p className="modal-desc">
                  Are you sure you want to submit your timesheet for review?
                </p>
              </div>
              <div className="modal-footer">
                <button className="btn-cancel" onClick={() => setShowSubmitConfirm(false)}>
                  CANCEL
                </button>
                <button
                  className="btn-standard"
                  onClick={() => {
                    setShowSubmitConfirm(false);
                    submitTimesheet();
                  }}
                >
                  CONFIRM SUBMIT
                </button>
              </div>
            </div>
          </div>
        )
      }

      {
        (activeSessionNotice || isClosingActiveSession) && (
          <div className={`modal-overlay ${isClosingActiveSession ? "fade-out" : "fade-in"}`}>
            <style>{`
              @keyframes modalShake {
                0%, 100% { transform: translateX(0); }
                10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
                20%, 40%, 60%, 80% { transform: translateX(4px); }
              }
              @keyframes modalSlideOut {
                0% { transform: translateY(0); opacity: 1; }
                100% { transform: translateY(20px); opacity: 0; }
              }
              .fade-out {
                animation: fadeOut 0.3s ease forwards;
              }
              @keyframes fadeOut {
                0% { opacity: 1; }
                100% { opacity: 0; }
              }
            `}</style>
            <div
              className="modal-card"
              style={{
                maxWidth: '420px',
                padding: '0',
                overflow: 'hidden',
                position: 'relative',
                animation: isClosingActiveSession ? 'modalSlideOut 0.3s cubic-bezier(.36,.07,.19,.97) both' : 'modalShake 0.4s cubic-bezier(.36,.07,.19,.97) both',
                border: '1px solid rgba(251, 191, 36, 0.3)',
                boxShadow: '0 10px 40px rgba(0, 0, 0, 0.6), 0 0 20px rgba(251, 191, 36, 0.15)'
              }}
            >
              <div style={{ position: 'absolute', top: '0', left: '0', transform: 'translate(-30%, -30%)', width: '250px', height: '150px', background: 'var(--color-warn)', filter: 'blur(70px)', opacity: 0.15, pointerEvents: 'none' }} />

              <div className="modal-header" style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-start',
                gap: '12px',
                padding: '24px 25px 20px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                background: 'rgba(251, 191, 36, 0.03)',
                position: 'relative',
                zIndex: 1
              }}>
                <span style={{ fontSize: '1.5rem', filter: 'drop-shadow(0 0 8px rgba(251, 191, 36, 0.6))', transform: 'translateY(-2px)' }}>⚠️</span>
                <h3 style={{
                  color: 'var(--color-warn)',
                  margin: 0,
                  fontSize: '1.2rem',
                  fontWeight: 700,
                  letterSpacing: '0.5px'
                }}>ACTIVE SESSION DETECTED</h3>
              </div>

              <div className="modal-body" style={{ padding: '30px 25px', textAlign: 'left', zIndex: 1, position: 'relative' }}>
                <p style={{
                  color: 'var(--text-muted)',
                  fontSize: '0.95rem',
                  lineHeight: '1.6',
                  margin: '0',
                  maxWidth: '360px'
                }}>
                  You are currently clocked in. Please <strong style={{ color: 'var(--color-warn)' }}>clock out</strong> before logging out to ensure your time is recorded correctly.
                </p>
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', borderTop: 'none', padding: '0 25px 25px', zIndex: 1, position: 'relative' }}>
                <button
                  className="btn-standard"
                  style={{
                    padding: '10px 32px',
                    fontSize: '0.95rem',
                    fontWeight: 600,
                    letterSpacing: '0.5px',
                    borderRadius: '8px',
                    boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)',
                    background: 'linear-gradient(135deg, var(--accent-blue), #4f46e5)',
                    border: 'none',
                    color: 'white'
                  }}
                  onClick={closeActiveSessionModal}
                >
                  Understood
                </button>
              </div>
            </div>
          </div>
        )
      }
      {ganttTip && createPortal(
        <div style={{
          position: 'fixed',
          left: ganttTip.x,
          top: ganttTip.y,
          transform: 'translate(-50%, -100%)',
          background: 'var(--bg-deep)',
          border: '1px solid var(--accent-cyan)',
          padding: '8px 12px',
          borderRadius: 6,
          fontSize: '0.75rem',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          boxShadow: '0 5px 15px rgba(0,0,0,0.5)',
          zIndex: 9999,
          color: 'var(--accent-cyan)',
        }}>
          <strong>{ganttTip.text}</strong>
          {ganttTip.sub && <div style={{ marginTop: 4, opacity: 0.8 }}>{ganttTip.sub}</div>}
        </div>,
        document.body
      )}
    </>
  );
}