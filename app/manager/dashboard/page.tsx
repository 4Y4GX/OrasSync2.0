'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import '../../employee/dashboard/dashboard.css';
import AutoLogout from '@/app/components/AutoLogout';

// --- PASSWORD VALIDATION LOGIC ---
const STRONG_PASS_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@?_\-])[A-Za-z\d!@?_\-]{15,20}$/;

function passwordChecks(pw: string) {
  const lengthOk = pw.length >= 15 && pw.length <= 20;
  const upperOk = /[A-Z]/.test(pw);
  const lowerOk = /[a-z]/.test(pw);
  const numberOk = /\d/.test(pw);
  const symbolOk = /[!@?_\-]/.test(pw);
  const onlyAllowed = /^[A-Za-z\d!@?_\-]*$/.test(pw);
  return { lengthOk, upperOk, lowerOk, numberOk, symbolOk, onlyAllowed, strongOk: lengthOk && upperOk && lowerOk && numberOk && symbolOk && onlyAllowed };
}

interface TeamData {
  name: string;
  supervisor: string;
  members: any[];
}

export default function ManagerDashboard() {
  const [hasClockedIn, setHasClockedIn] = useState(false);
  const [activeSection, setActiveSection] = useState('department');
  const [lightMode, setLightMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [roster, setRoster] = useState<any[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);

  const [tsSearch, setTsSearch] = useState("");
  const [tsDate, setTsDate] = useState("");
  const [tsStatus, setTsStatus] = useState("ALL");
  const [pendingTimesheets, setPendingTimesheets] = useState<any[]>([]);
  const [awaitingSupervisorTimesheets, setAwaitingSupervisorTimesheets] = useState<any[]>([]);
  const [approvalTab, setApprovalTab] = useState<'pending' | 'awaiting_supervisor'>('pending');
  const [tsLoading, setTsLoading] = useState(true);
  const [detailsModal, setDetailsModal] = useState({ show: false, timesheet: null as any });

  const [rejectModal, setRejectModal] = useState({ show: false, tlogIds: [] as number[], reason: "" });
  const [rejectConfirmModal, setRejectConfirmModal] = useState(false);
  const [approveModal, setApproveModal] = useState({ show: false, tlogIds: [] as number[] });

  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);

  const [editShiftModal, setEditShiftModal] = useState({
    show: false, empId: "", empName: "", day: "", currentShift: "", newShiftId: ""
  });

  const [logoutModal, setLogoutModal] = useState(false);
  const [activeSessionNotice, setActiveSessionNotice] = useState(false);
  const [saveShiftConfirmModal, setSaveShiftConfirmModal] = useState(false);
  const [showClockOutModal, setShowClockOutModal] = useState(false);
  const [clockOutLoading, setClockOutLoading] = useState(false);
  const [showPostClockOutModal, setShowPostClockOutModal] = useState(false);

  // Settings & Auth States
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [managerEmailInput, setManagerEmailInput] = useState('');

  const [pwStep, setPwStep] = useState(0);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [resending, setResending] = useState(false);

  const [secQuestion, setSecQuestion] = useState({ id: null, text: "" });
  const [secAnswer, setSecAnswer] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  const pwValidation = useMemo(() => passwordChecks(newPassword), [newPassword]);
  const passwordsMatch = newPassword === confirmNewPassword && confirmNewPassword.length > 0;

  // OTP Countdown Timer
  useEffect(() => {
    if (otpCountdown <= 0) return;
    const timer = setTimeout(() => setOtpCountdown(otpCountdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [otpCountdown]);

  const [currentTime, setCurrentTime] = useState('');
  const [sessionStart, setSessionStart] = useState<number | null>(null);
  const [sessionDuration, setSessionDuration] = useState('00:00:00');

  const [schedSearch, setSchedSearch] = useState("");
  const [schedResults, setSchedResults] = useState<any[]>([]);
  const [selectedEmp, setSelectedEmp] = useState<any>(null);
  const [schedForm, setSchedForm] = useState({ date: "", start: "", end: "", task: "" });

  const [selectedTimesheet, setSelectedTimesheet] = useState<any>(null);
  const [detailsViewMode, setDetailsViewMode] = useState<'timeline' | 'approve' | 'reject'>('timeline');
  const [isDetailsClosing, setIsDetailsClosing] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const closeDetailsModal = () => {
    setIsDetailsClosing(true);
    setTimeout(() => {
      setDetailsModal({ show: false, timesheet: null });
      setIsDetailsClosing(false);
    }, 280);
  };

  const [calendarView, setCalendarView] = useState<'weekly' | 'monthly'>('weekly');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [scheduleData, setScheduleData] = useState<any[]>([]);
  const [shiftTemplates, setShiftTemplates] = useState<any[]>([]);
  const [schedLoading, setSchedLoading] = useState(false);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  // --- Assign Schedule Feature ---
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignForm, setAssignForm] = useState({
    employee_id: '',
    shift_id: '',
    days: { monday: false, tuesday: false, wednesday: false, thursday: false, friday: false, saturday: false, sunday: false } as Record<string, boolean>,
  });
  const [assignConfirmModal, setAssignConfirmModal] = useState<{ show: boolean; hasConflicts: boolean; conflictDays: string[] }>({
    show: false, hasConflicts: false, conflictDays: [],
  });
  const [assignResultModal, setAssignResultModal] = useState<{ show: boolean; success: boolean; message: string }>({
    show: false, success: false, message: '',
  });
  const [assignSaving, setAssignSaving] = useState(false);

  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [activeProjectTab, setActiveProjectTab] = useState<string>('');
  const [reportTarget, setReportTarget] = useState('ALL');
  const [analyticsDate, setAnalyticsDate] = useState(new Date());

  const [currentUser, setCurrentUser] = useState({ name: 'Loading...', initials: '...', position: '...', email: '', user_id: '' });
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const executeLogout = async () => {
    try { await fetch('/api/auth/logout', { method: 'POST' }); window.location.href = '/login'; } catch (error) { }
  };

  useEffect(() => {
    const initDashboard = async () => {
      try {
        const meRes = await fetch('/api/manager/me');
        if (meRes.ok) {
          const meData = await meRes.json();
          setCurrentUser(meData);
          if (meData.email) {
            setManagerEmailInput(meData.email);
          }
        }

        const statusRes = await fetch('/api/manager/clock/in');
        if (statusRes.ok) {
          const data = await statusRes.json();
          if (data.isClockedIn) {
            setHasClockedIn(true);
            setSessionStart(new Date(data.startTime).getTime());
          }
        }

        setRosterLoading(true);
        const rosterRes = await fetch('/api/manager/roster');
        if (rosterRes.ok) {
          const data = await rosterRes.json();
          setRoster(data.roster || []);
        }
      } catch (e) { console.error("Initialization failed", e); }
      finally { setIsLoading(false); setRosterLoading(false); }
    };
    initDashboard();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour12: true, hour: '2-digit', minute: '2-digit' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

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

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (hasClockedIn && sessionStart) {
      interval = setInterval(() => {
        const diff = Date.now() - sessionStart;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        setSessionDuration(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [hasClockedIn, sessionStart]);

  const teamsMap = roster.reduce((acc, emp) => {
    const teamName = emp.team || 'Unassigned';
    if (!acc[teamName]) acc[teamName] = { name: teamName, supervisor: 'None Assigned', members: [] };
    acc[teamName].members.push(emp);
    if (emp.role_id === 4) acc[teamName].supervisor = emp.name;
    return acc;
  }, {} as Record<string, TeamData>);

  const teamCards: TeamData[] = Object.values(teamsMap);

  const filteredAndSortedRoster = roster
    .filter(emp => {
      const matchesSearch = (emp.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || (emp.user_id || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTeam = selectedTeam ? (emp.team || 'Unassigned') === selectedTeam : true;
      return matchesSearch && matchesTeam;
    })
    .sort((a, b) => {
      const isASup = a.role_id === 4;
      const isBSup = b.role_id === 4;
      if (isASup && !isBSup) return -1;
      if (!isASup && isBSup) return 1;
      return (a.name || '').localeCompare(b.name || '');
    });

  const fetchScheduleData = async () => {
    setSchedLoading(true);
    try {
      const res = await fetch('/api/manager/schedule/list');
      if (res.ok) {
        const data = await res.json();
        setScheduleData(data.schedule || []);
      }
      const templateRes = await fetch('/api/manager/shifts/list');
      if (templateRes.ok) {
        const templates = await templateRes.json();
        setShiftTemplates(templates.shifts || []);
      }
    } catch (e) { console.error(e); }
    finally { setSchedLoading(false); }
  };

  useEffect(() => {
    if (activeSection === 'calendar') fetchScheduleData();
  }, [activeSection, calendarView, currentDate]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (schedSearch.length >= 2) {
        try {
          const res = await fetch(`/api/manager/employees/search?q=${schedSearch}`);
          const data = await res.json();
          setSchedResults(data.employees || []);
        } catch (e) { }
      } else { setSchedResults([]); }
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [schedSearch]);

  const fetchPendingTimesheets = async () => {
    setTsLoading(true);
    try {
      const [pendingRes, awaitingRes] = await Promise.all([
        fetch('/api/manager/timesheets/pending?filter=pending'),
        fetch('/api/manager/timesheets/pending?filter=awaiting_supervisor')
      ]);

      if (pendingRes.ok && awaitingRes.ok) {
        const pendingData = await pendingRes.json();
        const awaitingData = await awaitingRes.json();
        setPendingTimesheets(pendingData.timesheets || []);
        setAwaitingSupervisorTimesheets(awaitingData.timesheets || []);
      }
    } catch (error) {
      console.error("Error fetching manager timesheets:", error);
    } finally {
      setTsLoading(false);
    }
  };

  const handleApproveConfirm = async () => {
    if (!selectedTimesheet) return;
    const tlog_ids = selectedTimesheet.activities.map((a: any) => a.tlog_id);
    setIsLoading(true);
    try {
      const res = await fetch('/api/manager/timesheets/approve', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tlog_ids })
      });
      if (res.ok) {
        setDetailsModal({ show: false, timesheet: null }); // Close details modal
        fetchPendingTimesheets();
      } else {
        const data = await res.json(); alert(`Failed: ${data.message}`);
      }
    } catch (e) { alert("Error approving timesheet."); } finally { setIsLoading(false); }
  };

  const handleRejectSubmit = async () => {
    if (!selectedTimesheet || !rejectionReason.trim()) return;
    const log_ids = selectedTimesheet.activities.map((a: any) => a.tlog_id);
    setIsLoading(true);

    try {
      const payload = {
        action: 'reject',
        log_ids,
        reason: rejectionReason
      };

      const res = await fetch('/api/manager/timesheets/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setDetailsModal({ show: false, timesheet: null });
        setRejectionReason(''); // Clear reason on success
        fetchPendingTimesheets();
      } else {
        alert("Failed to reject timesheet.");
      }
    } catch (error) {
      console.error("Error rejecting:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAnalyticsData = async () => {
    setAnalyticsLoading(true);
    try {
      const dateStr = analyticsDate.toISOString().split('T')[0];
      const res = await fetch(`/api/manager/analytics?date=${dateStr}`);
      if (res.ok) {
        const data = await res.json();
        setAnalyticsData(data);
        if (data.teams && data.teams.length > 0 && !activeProjectTab) {
          setActiveProjectTab(data.teams[0].team_name);
        }
      }
    } catch (e) { } finally { setAnalyticsLoading(false); }
  };

  useEffect(() => {
    if (hasClockedIn) {
      fetchPendingTimesheets();
      if (activeSection === 'analytics') fetchAnalyticsData();

      const interval = setInterval(() => {
        fetchPendingTimesheets();
        if (activeSection === 'analytics') fetchAnalyticsData();
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [hasClockedIn, activeSection, analyticsDate]);

  const executeApproveTimesheet = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/manager/timesheets/approve', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tlog_ids: approveModal.tlogIds })
      });
      if (res.ok) {
        setApproveModal({ show: false, tlogIds: [] });
        setDetailsModal({ show: false, timesheet: null }); // Close details modal
        fetchPendingTimesheets();
      }
      else { const data = await res.json(); alert(`Failed: ${data.message}`); }
    } catch (e) { alert("Error approving timesheet."); } finally { setIsLoading(false); }
  };

  const executeRejectTimesheet = async () => {
    setIsLoading(true);
    try {
      const payload = {
        action: 'reject',
        log_ids: rejectModal.tlogIds,
        reason: rejectModal.reason
      };

      const res = await fetch('/api/manager/timesheets/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setRejectConfirmModal(false);
        setRejectModal({ show: false, tlogIds: [], reason: '' });
        setDetailsModal({ show: false, timesheet: null });
        setRejectionReason(''); // Clear reason on success
        fetchPendingTimesheets();
      } else {
        alert("Failed to reject timesheet.");
      }
    } catch (error) {
      console.error("Error rejecting:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClockIn = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/manager/clock/in', { method: 'POST' });
      const data = await res.json();
      if (res.ok) { setSessionStart(new Date(data.startTime).getTime()); setHasClockedIn(true); }
      else { alert(`Failed: ${data.message}`); }
    } catch (e) { alert("Connection Error."); } finally { setIsLoading(false); }
  };

  const handleClockOut = async () => {
    setClockOutLoading(true);
    try {
      const res = await fetch('/api/manager/clock/out', { method: 'POST' });
      if (res.ok) {
        setHasClockedIn(false);
        setSessionStart(null);
        setSessionDuration('00:00:00');
        setShowClockOutModal(false);
        setShowPostClockOutModal(true);
      } else {
        alert("Failed to end session.");
      }
    } catch (e) { alert("Connection error."); } finally { setClockOutLoading(false); }
  };

  const executeSaveShiftEdit = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/manager/schedule/update', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: editShiftModal.empId, day: editShiftModal.day, newShiftId: editShiftModal.newShiftId })
      });
      if (res.ok) { setSaveShiftConfirmModal(false); setEditShiftModal({ ...editShiftModal, show: false }); fetchScheduleData(); }
      else { const data = await res.json(); alert(`Failed: ${data.message}`); }
    } catch (e) { alert("Connection error."); } finally { setIsLoading(false); }
  };

  const handleAssignSchedule = async () => {
    if (!selectedEmp || !schedForm.date || !schedForm.start || !schedForm.end) { alert("Please fill in all required fields."); return; }
    setIsLoading(true);
    try {
      const res = await fetch('/api/manager/schedule/assign', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: selectedEmp.user_id, date: schedForm.date, startTime: schedForm.start, endTime: schedForm.end, task: schedForm.task })
      });
      if (res.ok) { alert("Schedule Assigned Successfully!"); setShowScheduleModal(false); setSelectedEmp(null); setSchedSearch(""); setSchedForm({ date: "", start: "", end: "", task: "" }); }
      else { alert("Failed to assign schedule."); }
    } catch (e) { alert("Connection error."); } finally { setIsLoading(false); }
  };

  const handleGenerateReport = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/manager/reports/export?empId=${reportTarget}`);
      if (!res.ok) { const data = await res.json(); alert(`Export Failed: ${data.message}`); return; }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `OrasSync_Report_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) { alert("Connection error while generating report."); } finally { setIsLoading(false); }
  };

  const handleNavClick = (section: string) => {
    if (!hasClockedIn) return;
    setActiveSection(section);
    if (section === 'department') { setSelectedTeam(null); searchQuery && setSearchQuery(""); }
  };

  // --- PASSWORD CHANGE HANDLERS ---
  const handleStartPasswordChange = async () => {
    if (!managerEmailInput.trim()) {
      setPwError("Please enter your email address.");
      return;
    }

    setPwLoading(true);
    setPwError("");
    try {
      const res = await fetch('/api/auth/otp/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: managerEmailInput.trim() })
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 429 || data?.message === "OTP_LIMIT_REACHED") {
        setPwError("YOU'VE REACHED THE DAILY OTP LIMIT.");
      } else if (res.ok) {
        setPwStep(1); setOtp(["", "", "", "", "", ""]); setOtpCountdown(90);
      } else {
        setPwError("Failed to send OTP. Check your email address.");
      }
    } catch (e) { setPwError("Connection error."); }
    finally { setPwLoading(false); }
  };

  const handleResendOtp = async () => {
    if (otpCountdown > 0 || resending) return;
    setResending(true);
    setPwError("");
    try {
      const res = await fetch('/api/auth/otp/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: managerEmailInput.trim() })
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 429 || data?.message === "OTP_LIMIT_REACHED") {
        setPwError("YOU'VE REACHED THE DAILY OTP LIMIT.");
      } else if (res.ok) {
        setOtp(["", "", "", "", "", ""]); setOtpCountdown(90);
      } else {
        setPwError("Failed to resend code.");
      }
    } catch (e) { setPwError("Connection error."); }
    finally { setResending(false); }
  };

  const handleVerifyOtp = async () => {
    const code = otp.join("");
    if (code.length < 6) return;
    setPwLoading(true);
    setPwError("");
    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: managerEmailInput.trim(), otp: code, flow: "recovery" })
      });
      if (res.ok) {
        const qRes = await fetch('/api/manager/security-questions');
        if (qRes.ok) {
          const qData = await qRes.json();
          setSecQuestion({ id: qData.questionId, text: qData.questionText });
          setPwStep(2);
        } else {
          const errData = await qRes.json().catch(() => ({}));
          setPwError(errData.message || "Failed to load security question.");
        }
      } else { setPwError("Invalid or expired OTP."); setOtp(["", "", "", "", "", ""]); }
    } catch (e) { setPwError("Verification failed."); }
    finally { setPwLoading(false); }
  };

  const handleAnswerQuestion = async () => {
    if (!secAnswer.trim()) { setPwError("Please provide an answer."); return; }
    setPwLoading(true);
    setPwError("");
    try {
      const res = await fetch('/api/auth/security-question', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: secQuestion.id, answer: secAnswer.trim() })
      });
      if (res.ok) { setPwStep(3); }
      else { setPwError("Incorrect answer."); }
    } catch (e) { setPwError("Verification failed."); }
    finally { setPwLoading(false); }
  };

  const handleResetPassword = async () => {
    if (!pwValidation.strongOk || !passwordsMatch) return;
    setPwLoading(true);
    setPwError("");
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword })
      });
      if (res.ok) { setPwStep(4); }
      else { setPwError("Failed to update password."); }
    } catch (e) { setPwError("Update failed."); }
    finally { setPwLoading(false); }
  };

  const resetSettingsState = () => {
    setShowSettingsModal(false);
    setTimeout(() => {
      setPwStep(0);
      setPwError("");
      setNewPassword("");
      setConfirmNewPassword("");
      setSecAnswer("");
      setShowPw(false);
      setShowConfirmPw(false);
    }, 300);
  };

  const getDateString = () => {
    return new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).toUpperCase();
  };



  // ✅ Close profile menu on outside click + ESC
  const profileMenuWrapRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!showProfileMenu) return;

    const onDown = (e: MouseEvent) => {
      const wrap = profileMenuWrapRef.current;
      if (!wrap) return;
      if (!wrap.contains(e.target as Node)) setShowProfileMenu(false);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowProfileMenu(false);
    };

    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [showProfileMenu]);

  return (
    <>
      <div className="tech-mesh" />

      <div className="split-layout manager-dashboard">
        <AutoLogout />
        <aside className="info-panel">
          <div className="bg-decor bg-sq-outline sq-top-left" />
          <div className="bg-decor bg-sq-outline sq-mid-left" />
          <div className="bg-decor bg-sq-solid sq-bot-left" />

          <div className="brand-logo">
            ORASYNC
          </div>

          <ul className="nav-links">
            <li className={`nav-item ${activeSection === 'department' ? 'active' : ''} ${!hasClockedIn ? 'locked' : ''}`} onClick={() => hasClockedIn && handleNavClick('department')}>Department</li>
            <li className={`nav-item ${activeSection === 'timesheets' ? 'active' : ''} ${!hasClockedIn ? 'locked' : ''}`} onClick={() => hasClockedIn && handleNavClick('timesheets')}>Approvals</li>
            <li className={`nav-item ${activeSection === 'calendar' ? 'active' : ''} ${!hasClockedIn ? 'locked' : ''}`} onClick={() => hasClockedIn && handleNavClick('calendar')}>Schedule</li>
            <li className={`nav-item ${activeSection === 'analytics' ? 'active' : ''} ${!hasClockedIn ? 'locked' : ''}`} onClick={() => hasClockedIn && handleNavClick('analytics')}>Analytics</li>
          </ul>

          <div style={{ marginTop: 'auto' }}></div>

          <div className="widget-box">
            <div className="label-sm">Pending Approvals</div>
            <div className="status-badge warn">
              <span className="dot" />
              <span style={{ marginLeft: 8 }}>{pendingTimesheets.length} PENDING</span>
            </div>
          </div>

          <div ref={profileMenuWrapRef} style={{ position: "relative" }}>
            {showProfileMenu && (
              <div className="profile-menu active">
                <div
                  className="menu-item"
                  onClick={() => {
                    setShowProfileMenu(false);
                    setShowSettingsModal(true);
                  }}
                >
                  <span className="menu-icon">⚙</span> Settings
                </div>
                <div className="menu-divider" />
                <div
                  className="menu-item danger"
                  onClick={() => {
                    setShowProfileMenu(false);
                    if (hasClockedIn) {
                      setActiveSessionNotice(true);
                    } else {
                      setLogoutModal(true);
                    }
                  }}
                >
                  <span className="menu-icon">⎋</span> Log Out
                </div>
              </div>
            )}

            <div
              className="profile-card"
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              title="Click for menu"
            >
              <div className="streak-badge">👑 Manager</div>
              <div className="avatar">{currentUser.initials}</div>
              <div className="profile-info">
                <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--text-main)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {currentUser.name}
                </div>
                <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {currentUser.position}
                </div>
              </div>
            </div>
          </div>
        </aside>

        <main className="workspace-panel">
          <div className="top-bar" style={{ justifyContent: "space-between", padding: "20px 30px" }}>
            <div className="status-badge go" style={{ background: "transparent", border: "none", padding: 0, boxShadow: "none" }}>
              <span className="dot go" />
              <span style={{ marginLeft: 10, fontSize: "0.8rem", letterSpacing: "2px", fontWeight: "bold", color: "#4ade80" }}>SYSTEM SECURE</span>
            </div>
            <button className="theme-btn" onClick={toggleTheme} title="Toggle Theme">
              {lightMode ? "☀" : "🌙"}
            </button>
          </div>

          <div className="content-area">

            {/* LANDING SCREEN */}
            {!hasClockedIn && (
              <div id="layout-initial" className="fade-in" style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div className="landing-card">
                  <div className="hero-clock-label">Manager Control</div>
                  <div className="hero-clock-row">
                    {currentTime.split(" ")[0] || '00:00:00'}
                    <span className="clock-ampm">
                      {currentTime.split(" ")[1] || ''}
                    </span>
                  </div>
                  <div className="hero-date-display">
                    {getDateString()}
                  </div>
                  <p style={{ color: 'var(--text-muted)', marginBottom: '30px', textAlign: 'center' }}>Executive access enabled. Click below to begin session.</p>

                  <button className="btn-clock-in-large" onClick={handleClockIn} disabled={isLoading}>
                    {isLoading ? "STARTING..." : "CLOCK IN"}
                  </button>
                </div>
              </div>
            )}

            {/* ACTIVE DEPARTMENT VIEW */}
            {hasClockedIn && activeSection === 'department' && (
              <div className="fade-in" style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div className="hud-row" style={{ display: 'flex', gap: '20px' }}>
                  <div className="hud-card" style={{ flex: 1 }}>
                    <div className="hud-bg-icon">⏱</div>
                    <div className="hud-label">CURRENT TIME</div>
                    <div className="hud-val" style={{ color: 'var(--accent-cyan)' }}>{currentTime}</div>
                  </div>
                  <div className="hud-card" style={{ flex: 1 }}>
                    <div className="hud-bg-icon">⚡</div>
                    <div className="hud-label">SESSION DURATION</div>
                    <div className="hud-val">{sessionDuration}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '5px' }}>Productivity Target: {sessionDuration.substring(0, 5)} / 8h</div>
                  </div>
                  <div className="hud-card" style={{ borderColor: 'var(--accent-gold)', flex: 1 }}>
                    <div className="hud-bg-icon">🏢</div>
                    <div className="hud-label">DEPT. COVERAGE</div>
                    <div className="hud-val" style={{ color: 'var(--accent-gold)' }}>
                      {roster.filter(r => r.status === 'in').length} / {roster.length || 1}
                    </div>
                    <div className="status-badge go" style={{ marginTop: '5px', fontSize: '0.7rem' }}>
                      {Math.round((roster.filter(r => r.status === 'in').length / (roster.length || 1)) * 100)}% Online
                    </div>
                  </div>
                </div>

                <div className="workspace-grid">
                  <div className="logs-panel">
                    {!selectedTeam ? (
                      <>
                        <div className="section-title" style={{ padding: '20px 25px', margin: 0, border: 'none', background: 'rgba(0,0,0,0.1)' }}>Department Teams</div>
                        <div className="table-container" style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px', alignContent: 'start' }}>
                          {rosterLoading ? (
                            <div style={{ color: 'var(--text-muted)', gridColumn: '1 / -1', textAlign: 'center' }}>Loading Teams...</div>
                          ) : (
                            teamCards.map((team: TeamData) => (
                              <div key={team.name} className="glass-card" style={{ cursor: 'pointer', transition: 'transform 0.2s', padding: '25px' }} onClick={() => setSelectedTeam(team.name)}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px', gap: '10px' }}>
                                  <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.2rem', lineHeight: '1.4' }}>{team.name}</h3>
                                  <span className="status-badge" style={{ background: 'var(--bg-input)', padding: '5px 10px', borderRadius: '12px', color: 'var(--text-main)', flexShrink: 0 }}>👥 {team.members.length}</span>
                                </div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '5px' }}>Supervisor</div>
                                <div style={{ fontWeight: 600, fontSize: '1.05rem', color: 'var(--text-main)' }}>{team.supervisor}</div>
                              </div>
                            ))
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="section-title" style={{ padding: '15px 25px', margin: 0, background: 'rgba(0,0,0,0.1)', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                            <button className="btn-view" style={{ padding: '6px 14px', margin: 0 }} onClick={() => { setSelectedTeam(null); setSearchQuery(""); }}>← Back</button>
                            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-muted)' }}>|</span>
                            <span style={{ fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>{selectedTeam === 'Unassigned' ? 'Unassigned Roster' : `Team ${selectedTeam} Roster`}</span>
                          </div>
                          <input type="text" placeholder="Search by Name..." className="input-rounded" style={{ width: '250px', padding: '10px 15px' }} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                        </div>
                        <div className="table-container">
                          <table className="data-table">
                            <thead><tr><th>Name</th><th>Position</th><th>Status</th></tr></thead>
                            <tbody>
                              {filteredAndSortedRoster.length === 0 && (<tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No employees found.</td></tr>)}
                              {filteredAndSortedRoster.map(emp => (
                                <tr key={emp.user_id}>
                                  <td style={{ fontWeight: 700 }}>{emp.name}</td>
                                  <td><div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>{emp.role_id === 4 && <span className="tag tag-sup">HEAD</span>} {emp.position || (emp.role_id === 4 ? 'Supervisor' : 'Employee')}</div></td>
                                  <td>{emp.status === 'in' ? <span className="tag tag-in">Clocked In</span> : <span className="tag tag-out">Clocked Out</span>}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="controls-panel">
                    <div className="glass-card" style={{ margin: 0, flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <div className="section-title">Manager Actions</div>
                      <p style={{ color: 'var(--text-muted)', marginBottom: '20px', fontSize: '0.9rem' }}>Department level controls and overrides.</p>

                      <div style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid var(--border-subtle)' }}>
                        <div className="hud-label" style={{ marginBottom: '5px' }}>MY STATUS</div>
                        <div className="status-badge go" style={{ display: 'flex', marginBottom: '10px', width: '100%', justifyContent: 'center', padding: '10px', background: 'var(--bg-input)', borderRadius: '8px' }}>CLOCKED IN</div>
                        <button className="btn-action btn-urgent" onClick={() => setShowClockOutModal(true)} style={{ borderRadius: '8px', backgroundColor: '#ff0000', color: 'white' }}>Clock Out</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* APPROVALS VIEW */}
            {hasClockedIn && activeSection === 'timesheets' && (() => {
              const currentTimesheets = approvalTab === 'pending' ? pendingTimesheets : awaitingSupervisorTimesheets;
              const filteredTimesheets = currentTimesheets.filter(ts => {
                const matchesSearch = ts.employee_name.toLowerCase().includes(tsSearch.toLowerCase());
                const matchesDate = tsDate ? ts.date === tsDate : true;
                return matchesSearch && matchesDate;
              });

              const formatHoursToHHMM = (hours: number) => {
                const h = Math.floor(hours);
                const m = Math.round((hours - h) * 60);
                return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
              };

              return (
                <div className="section-view active fade-in">
                  <div className="section-animate">
                    <div className="glass-card">
                      <div className="section-title" style={{ borderBottom: 'none', marginBottom: 0, paddingBottom: 0 }}>
                        <span style={{ textTransform: 'uppercase' }}>TIMESHEET APPROVALS</span>
                      </div>
                      <div style={{ display: 'flex', gap: '10px', marginBottom: 15, padding: '0 20px' }}>
                        <input type="date" className="input-rounded" style={{ padding: '8px 12px', color: tsDate ? 'var(--accent-blue)' : 'var(--text-main)', fontWeight: 700, fontFamily: 'var(--font-mono)', letterSpacing: '2px', cursor: 'pointer' }} value={tsDate} onChange={(e) => setTsDate(e.target.value)} />
                        <input type="text" placeholder="Search employee..." className="input-rounded" style={{ width: '220px', padding: '8px 15px' }} value={tsSearch} onChange={(e) => setTsSearch(e.target.value)} />
                      </div>
                      <div className="detail-log-tabs" style={{ marginBottom: 20 }}>
                        {([
                          { key: 'pending' as const, label: 'PENDING', color: '#eab308', count: pendingTimesheets.length },
                          { key: 'awaiting_supervisor' as const, label: 'AWAITING SUPERVISOR', color: '#f472b6', count: awaitingSupervisorTimesheets.length },
                        ]).map(tab => (
                          <button
                            key={tab.key}
                            className={`detail-log-tab ${approvalTab === tab.key ? 'active' : ''}`}
                            onClick={() => setApprovalTab(tab.key)}
                            style={approvalTab === tab.key ? { '--tab-color': tab.color } as React.CSSProperties : undefined}
                          >
                            {tab.label}
                            <span className="detail-log-tab-count" style={approvalTab === tab.key ? { background: tab.color, color: '#000' } : undefined}>
                              {tab.count}
                            </span>
                          </button>
                        ))}
                      </div>
                      <div className="approval-grid">
                        {approvalTab === 'pending' && (
                          <>
                            {tsLoading ? (
                              <>
                                {Array(4).fill(0).map((_, i) => (
                                  <div key={`pending-skeleton-${i}`} className="approval-card skeleton">
                                    <div className="approval-header">
                                      <div style={{ width: '100%' }}>
                                        <div className="skeleton-box" style={{ width: '60%', height: '1.2rem', marginBottom: '8px' }} />
                                        <div className="skeleton-box" style={{ width: '40%', height: '0.85rem' }} />
                                      </div>
                                    </div>
                                    <div className="approval-stats" style={{ marginTop: '15px' }}>
                                      <div className="stat-item">
                                        <div className="skeleton-box" style={{ width: '80%', height: '0.75rem', marginBottom: '8px' }} />
                                        <div className="skeleton-box" style={{ width: '50%', height: '1rem' }} />
                                      </div>
                                      <div className="stat-item">
                                        <div className="skeleton-box" style={{ width: '80%', height: '0.75rem', marginBottom: '8px' }} />
                                        <div className="skeleton-box" style={{ width: '50%', height: '1rem' }} />
                                      </div>
                                    </div>
                                    <div className="approval-actions" style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                                      <div className="skeleton-box" style={{ flex: 1, height: '36px', borderRadius: '6px' }} />
                                      <div className="skeleton-box" style={{ flex: 1, height: '36px', borderRadius: '6px' }} />
                                      <div className="skeleton-box" style={{ flex: 1, height: '36px', borderRadius: '6px' }} />
                                    </div>
                                  </div>
                                ))}
                              </>
                            ) : filteredTimesheets.length === 0 ? (
                              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                                <div style={{ fontSize: '1.3rem', marginBottom: 6, opacity: 0.4 }}>⏳</div>
                                {currentTimesheets.length === 0 ? 'All caught up! No pending approvals.' : 'No submissions match your filters.'}
                              </div>
                            ) : filteredTimesheets.map((ts, i) => (
                              <div key={`${ts.user_id}_${ts.date}`} className="approval-card" onClick={() => { setDetailsViewMode('timeline'); setSelectedTimesheet(ts); setDetailsModal({ show: true, timesheet: ts }); }} style={{ cursor: 'pointer' }}>
                                <div className="approval-header">
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", width: "100%" }}>
                                    <div>
                                      <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{ts.employee_name}</div>
                                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Date: {ts.date}</div>
                                    </div>
                                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "5px" }}>
                                      <div className="approval-badge pending">PENDING</div>
                                      <button
                                        className="btn-view-link"
                                        onClick={() => { setDetailsViewMode('timeline'); setSelectedTimesheet(ts); setDetailsModal({ show: true, timesheet: ts }); }}
                                        style={{
                                          marginTop: "8px",
                                          fontSize: "0.75rem",
                                          fontWeight: 600,
                                          padding: "4px 12px",
                                          background: "var(--bg-deep)",
                                          border: "1px solid var(--border-subtle)",
                                          borderRadius: "20px",
                                          color: "var(--text-main)",
                                          display: "flex",
                                          alignItems: "center",
                                          gap: "4px",
                                          transition: "all 0.2s"
                                        }}
                                      >
                                        View Details <span style={{ fontSize: "1rem" }}>→</span>
                                      </button>
                                    </div>
                                  </div>
                                </div>
                                <div className="approval-stats">
                                  <div className="stat-item">
                                    <span className="stat-label">Total Time</span>
                                    <span className="stat-value">{formatHoursToHHMM(ts.total_hours)}</span>
                                  </div>
                                  <div className="stat-item">
                                    <span className="stat-label">Activities</span>
                                    <span className="stat-value">{ts.activities.length}</span>
                                  </div>
                                </div>
                                <div className="approval-actions" style={{ marginTop: "15px", display: "flex", gap: "10px" }}>
                                  <button
                                    className="btn-reject-outline"
                                    onClick={(e) => { e.stopPropagation(); setSelectedTimesheet(ts); setDetailsViewMode('reject'); setDetailsModal({ show: true, timesheet: ts }); }}
                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', flex: 1 }}
                                  >
                                    ✗ Reject
                                  </button>
                                  <button
                                    className="btn-approve"
                                    onClick={(e) => { e.stopPropagation(); setSelectedTimesheet(ts); setDetailsViewMode('approve'); setDetailsModal({ show: true, timesheet: ts }); }}
                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', flex: 1 }}
                                  >
                                    ✓ Approve
                                  </button>
                                </div>
                              </div>
                            ))}
                          </>
                        )}
                        {approvalTab === 'awaiting_supervisor' && (
                          <>
                            {tsLoading ? (
                              <>
                                {Array(4).fill(0).map((_, i) => (
                                  <div key={`awaiting-skeleton-${i}`} className="approval-card skeleton">
                                    <div className="approval-header">
                                      <div style={{ width: '100%' }}>
                                        <div className="skeleton-box" style={{ width: '60%', height: '1.2rem', marginBottom: '8px' }} />
                                        <div className="skeleton-box" style={{ width: '40%', height: '0.85rem' }} />
                                      </div>
                                    </div>
                                    <div className="approval-stats" style={{ marginTop: '15px' }}>
                                      <div className="stat-item">
                                        <div className="skeleton-box" style={{ width: '80%', height: '0.75rem', marginBottom: '8px' }} />
                                        <div className="skeleton-box" style={{ width: '50%', height: '1rem' }} />
                                      </div>
                                      <div className="stat-item">
                                        <div className="skeleton-box" style={{ width: '80%', height: '0.75rem', marginBottom: '8px' }} />
                                        <div className="skeleton-box" style={{ width: '50%', height: '1rem' }} />
                                      </div>
                                    </div>
                                    <div className="approval-actions" style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                                      <div className="skeleton-box" style={{ flex: 1, height: '36px', borderRadius: '6px' }} />
                                      <div className="skeleton-box" style={{ flex: 1, height: '36px', borderRadius: '6px' }} />
                                      <div className="skeleton-box" style={{ flex: 1, height: '36px', borderRadius: '6px' }} />
                                    </div>
                                  </div>
                                ))}
                              </>
                            ) : filteredTimesheets.length === 0 ? (
                              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                                <div style={{ fontSize: '1.3rem', marginBottom: 6, opacity: 0.4 }}>✅</div>
                                {currentTimesheets.length === 0 ? 'No timesheets awaiting supervisor approval.' : 'No submissions match your filters.'}
                              </div>
                            ) : filteredTimesheets.map((ts, i) => (
                              <div key={`${ts.user_id}_${ts.date}`} className="approval-card" onClick={() => { setDetailsViewMode('timeline'); setSelectedTimesheet(ts); setDetailsModal({ show: true, timesheet: ts }); }} style={{ cursor: 'pointer', borderColor: 'rgba(244, 114, 182, 0.3)' }}>
                                <div className="approval-header">
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", width: "100%" }}>
                                    <div>
                                      <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{ts.employee_name}</div>
                                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Date: {ts.date}</div>
                                    </div>
                                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "5px" }}>
                                      <div className="approval-badge awaiting">AWAITING</div>
                                      <button
                                        className="btn-view-link"
                                        onClick={() => { setDetailsViewMode('timeline'); setSelectedTimesheet(ts); setDetailsModal({ show: true, timesheet: ts }); }}
                                        style={{
                                          marginTop: "8px",
                                          fontSize: "0.75rem",
                                          fontWeight: 600,
                                          padding: "4px 12px",
                                          background: "var(--bg-deep)",
                                          border: "1px solid var(--border-subtle)",
                                          borderRadius: "20px",
                                          color: "var(--text-main)",
                                          display: "flex",
                                          alignItems: "center",
                                          gap: "4px",
                                          transition: "all 0.2s"
                                        }}
                                      >
                                        View Details <span style={{ fontSize: "1rem" }}>→</span>
                                      </button>
                                    </div>
                                  </div>
                                </div>
                                <div className="approval-stats">
                                  <div className="stat-item">
                                    <span className="stat-label">Total Time</span>
                                    <span className="stat-value">{formatHoursToHHMM(ts.total_hours)}</span>
                                  </div>
                                  <div className="stat-item">
                                    <span className="stat-label">Activities</span>
                                    <span className="stat-value">{ts.activities.length}</span>
                                  </div>
                                </div>
                                <div className="approval-actions" style={{ marginTop: "15px", display: "flex", gap: "10px" }}>
                                  <button
                                    className="btn-reject-outline"
                                    disabled
                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', opacity: 0.4, cursor: 'not-allowed', flex: 1 }}
                                  >
                                    ✗ Reject
                                  </button>
                                  <button
                                    className="btn-approve"
                                    disabled
                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', opacity: 0.4, cursor: 'not-allowed', flex: 1 }}
                                  >
                                    ✓ Approve
                                  </button>
                                </div>
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* CALENDAR VIEW */}
            {hasClockedIn && activeSection === 'calendar' && (
              <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 0, height: '100%' }}>
                <div className="section-title" style={{ padding: '15px 25px', margin: 0, border: '1px solid var(--border-subtle)', background: 'var(--bg-panel)', justifyContent: 'space-between', alignItems: 'center', borderRadius: '12px 12px 0 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <span style={{ fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>Department Schedule</span>
                    <span className="status-badge" style={{ background: 'var(--bg-input)', padding: '5px 15px', color: 'var(--accent-blue)', border: '1px solid var(--border-subtle)', borderRadius: '8px' }}>
                      {calendarView === 'weekly' ? (() => { const d = new Date(currentDate); const day = d.getDay() || 7; const mon = new Date(d); mon.setDate(d.getDate() - day + 1); const sun = new Date(mon); sun.setDate(mon.getDate() + 6); const mf = (dt: Date) => dt.toLocaleDateString('en-US', { month: 'short' }); return mon.getMonth() === sun.getMonth() ? `${mf(mon)} ${mon.getDate()}-${sun.getDate()}` : `${mf(mon)} ${mon.getDate()}-${mf(sun)} ${sun.getDate()}`; })() : `Month of ${currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                    <button
                      onClick={() => { setAssignForm({ employee_id: '', shift_id: '', days: { monday: false, tuesday: false, wednesday: false, thursday: false, friday: false, saturday: false, sunday: false } }); setShowAssignModal(true); }}
                      style={{ padding: '8px 15px', borderRadius: '8px', border: '1px solid var(--accent-blue)', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent-blue)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap' }}
                    >+ Assign Schedule</button>
                    <div style={{ background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: '8px', display: 'flex', overflow: 'hidden' }}>
                      <button onClick={() => setCalendarView('weekly')} style={{ padding: '8px 15px', border: 'none', cursor: 'pointer', background: calendarView === 'weekly' ? 'var(--accent-blue)' : 'transparent', color: calendarView === 'weekly' ? '#fff' : 'var(--text-main)', fontWeight: calendarView === 'weekly' ? 700 : 400 }}>Weekly</button>
                      <button onClick={() => setCalendarView('monthly')} style={{ padding: '8px 15px', border: 'none', cursor: 'pointer', background: calendarView === 'monthly' ? 'var(--accent-blue)' : 'transparent', color: calendarView === 'monthly' ? '#fff' : 'var(--text-main)', fontWeight: calendarView === 'monthly' ? 700 : 400 }}>Monthly</button>
                    </div>
                    <div style={{ display: 'flex', gap: '5px' }}>
                      <button className="btn-action" style={{ padding: '8px 12px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-main)' }} onClick={() => { const newDate = new Date(currentDate); calendarView === 'weekly' ? newDate.setDate(newDate.getDate() - 7) : newDate.setMonth(newDate.getMonth() - 1); setCurrentDate(newDate); }}>← Prev</button>
                      <button className="btn-action" style={{ padding: '8px 12px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--accent-blue)', fontWeight: 600 }} onClick={() => setCurrentDate(new Date())}>Today</button>
                      <button className="btn-action" style={{ padding: '8px 12px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-main)' }} onClick={() => { const newDate = new Date(currentDate); calendarView === 'weekly' ? newDate.setDate(newDate.getDate() + 7) : newDate.setMonth(newDate.getMonth() + 1); setCurrentDate(newDate); }}>Next →</button>
                    </div>

                  </div>
                </div>

                <div className="table-container" style={{ padding: '20px', paddingBottom: '30px', background: 'var(--bg-deep)', borderRadius: '0 0 12px 12px', borderBottom: '1px solid var(--border-subtle)', borderLeft: '1px solid var(--border-subtle)', borderRight: '1px solid var(--border-subtle)', flex: 1, overflowY: 'auto' }}>
                  {calendarView === 'weekly' ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '15px' }}>
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => {
                        const dayKeyMap: Record<string, string> = { 'Mon': 'monday', 'Tue': 'tuesday', 'Wed': 'wednesday', 'Thu': 'thursday', 'Fri': 'friday', 'Sat': 'saturday', 'Sun': 'sunday' };
                        const dbDayKey = dayKeyMap[day];
                        const shiftsForDay = scheduleData.filter(emp => emp.schedule && emp.schedule[dbDayKey] !== null);

                        return (
                          <div key={day} style={{ background: 'var(--bg-input)', borderRadius: '12px', padding: '15px', minHeight: '300px', border: '1px solid var(--border-subtle)' }}>
                            <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '15px', marginBottom: '15px', textAlign: 'center', fontWeight: 700, color: 'var(--accent-blue)', letterSpacing: '1px', textTransform: 'uppercase' }}>{day}</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                              {schedLoading ? (
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center' }}>Loading...</div>
                              ) : shiftsForDay.length === 0 ? (
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center' }}>No shifts.</div>
                              ) : (
                                shiftsForDay.map(emp => (
                                  <div
                                    key={emp.user_id} className="glass-card fade-in-up"
                                    style={{ padding: '10px', margin: 0, cursor: 'pointer', transition: 'all 0.2s', border: '1px solid var(--border-subtle)', background: 'var(--bg-card)', borderRadius: '8px' }}
                                    onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = 'var(--accent-blue)'; e.currentTarget.style.boxShadow = 'var(--shadow-glow)'; }}
                                    onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.boxShadow = 'var(--shadow-card)'; }}
                                    onClick={() => setEditShiftModal({ show: true, empId: emp.user_id, empName: emp.name, day: day, currentShift: emp.schedule[dbDayKey].shift_name, newShiftId: "" })}
                                  >
                                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-main)' }}>{emp.name}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>{emp.schedule[dbDayKey].shift_name}</div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--accent-magenta)', marginTop: '2px', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                                      {emp.schedule[dbDayKey].time || ''}
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (() => {
                    const year = currentDate.getFullYear();
                    const month = currentDate.getMonth();
                    const firstDay = new Date(year, month, 1);
                    const lastDay = new Date(year, month + 1, 0);
                    const startOffset = (firstDay.getDay() + 6) % 7;
                    const totalDays = lastDay.getDate();
                    const totalCells = Math.ceil((startOffset + totalDays) / 7) * 7;
                    const today = new Date();
                    const dayNameMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

                    const cells: { date: Date; inMonth: boolean; dayKey: string; dateStr: string }[] = [];
                    for (let i = 0; i < totalCells; i++) {
                      const diff = i - startOffset;
                      const d = new Date(year, month, diff + 1);
                      cells.push({ date: d, inMonth: diff >= 0 && diff < totalDays, dayKey: dayNameMap[d.getDay()], dateStr: d.toISOString().split('T')[0] });
                    }

                    const weeks: typeof cells[] = [];
                    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

                    const expandedDayData = expandedDay ? cells.find(c => c.dateStr === expandedDay) : null;
                    const expandedShifts = expandedDayData ? scheduleData.filter(emp => emp.schedule && emp.schedule[expandedDayData.dayKey] !== null) : [];

                    return (
                      <>
                        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '4px' }}>
                            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                              <div key={d} style={{ textAlign: 'center', fontWeight: 700, fontSize: '0.8rem', color: 'var(--accent-gold)', letterSpacing: '1px', textTransform: 'uppercase', padding: '8px 0' }}>{d}</div>
                            ))}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                            {weeks.map((week, wi) => (
                              <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', flex: 1 }}>
                                {week.map((cell, ci) => {
                                  const isToday = cell.inMonth && cell.date.toDateString() === today.toDateString();
                                  const empCount = scheduleData.filter(emp => emp.schedule && emp.schedule[cell.dayKey] !== null).length;
                                  return (
                                    <div
                                      key={ci}
                                      onClick={() => cell.inMonth && empCount > 0 && setExpandedDay(cell.dateStr)}
                                      style={{
                                        background: isToday ? 'rgba(251, 191, 36, 0.1)' : cell.inMonth ? 'var(--bg-input)' : 'rgba(0,0,0,0.15)',
                                        border: isToday ? '2px solid var(--accent-gold)' : '1px solid var(--border-subtle)',
                                        borderRadius: '8px', padding: '10px',
                                        cursor: cell.inMonth && empCount > 0 ? 'pointer' : 'default',
                                        opacity: cell.inMonth ? 1 : 0.35, transition: 'all 0.2s',
                                        display: 'flex', flexDirection: 'column', minHeight: '80px',
                                      }}
                                      onMouseOver={(e) => { if (cell.inMonth && empCount > 0) { e.currentTarget.style.borderColor = 'var(--accent-gold)'; e.currentTarget.style.boxShadow = '0 0 12px rgba(251,191,36,0.15)'; } }}
                                      onMouseOut={(e) => { e.currentTarget.style.borderColor = isToday ? 'var(--accent-gold)' : 'var(--border-subtle)'; e.currentTarget.style.boxShadow = 'none'; }}
                                    >
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                        <span style={{ fontWeight: 700, fontSize: '1rem', color: isToday ? 'var(--accent-gold)' : cell.inMonth ? 'var(--text-main)' : 'var(--text-muted)' }}>{cell.date.getDate()}</span>
                                        {isToday && <span style={{ fontSize: '0.6rem', background: 'var(--accent-gold)', color: '#000', padding: '2px 6px', borderRadius: '4px', fontWeight: 700, letterSpacing: '0.5px' }}>TODAY</span>}
                                      </div>
                                      {cell.inMonth && empCount > 0 && (
                                        <div style={{ marginTop: 'auto', fontSize: '0.75rem', color: 'var(--accent-gold)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                          <span>👥</span> {empCount} scheduled
                                        </div>
                                      )}
                                      {cell.inMonth && empCount === 0 && !schedLoading && (
                                        <div style={{ marginTop: 'auto', fontSize: '0.7rem', color: 'var(--text-muted)' }}>No shifts</div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ))}
                          </div>
                        </div>

                        {expandedDay && expandedDayData && (
                          <div className="modal-overlay" style={{ zIndex: 9999 }} onClick={(e) => { if (e.target === e.currentTarget) setExpandedDay(null); }}>
                            <div className="modal-card" style={{ maxWidth: '550px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
                              <div className="modal-header" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                  <span className="modal-title" style={{ color: 'var(--accent-gold)' }}>
                                    {expandedDayData.date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                                  </span>
                                  <span style={{ background: 'var(--bg-input)', padding: '3px 10px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>
                                    {expandedShifts.length} employees
                                  </span>
                                </div>
                                <span onClick={() => setExpandedDay(null)} style={{ cursor: 'pointer', fontSize: '1.2rem', color: 'var(--text-muted)' }}>✕</span>
                              </div>
                              <div className="modal-body" style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', padding: '20px 30px' }}>
                                {expandedShifts.length === 0 ? (
                                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '30px 0' }}>No employees scheduled for this day.</div>
                                ) : expandedShifts.map(emp => (
                                  <div
                                    key={emp.user_id}
                                    style={{ background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '15px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
                                    onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--accent-gold)'; e.currentTarget.style.background = 'rgba(251,191,36,0.06)'; }}
                                    onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.background = 'var(--bg-input)'; }}
                                    onClick={() => {
                                      const dayShortMap: Record<string, string> = { monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun' };
                                      setExpandedDay(null);
                                      setEditShiftModal({ show: true, empId: emp.user_id, empName: emp.name, day: dayShortMap[expandedDayData.dayKey], currentShift: emp.schedule[expandedDayData.dayKey].shift_name, newShiftId: "" });
                                    }}
                                  >
                                    <div>
                                      <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-main)' }}>{emp.name}</div>
                                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>{emp.schedule[expandedDayData.dayKey].shift_name}</div>
                                    </div>
                                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--accent-gold)', fontWeight: 600, textAlign: 'right' }}>
                                      {emp.schedule[expandedDayData.dayKey].time || ''}
                                    </div>
                                  </div>
                                ))}
                              </div>
                              <div className="modal-footer" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                                <button className="btn-view" style={{ width: '100%', padding: '12px', fontSize: '0.95rem' }} onClick={() => setExpandedDay(null)}>Close</button>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* ANALYTICS VIEW */}
            {hasClockedIn && activeSection === 'analytics' && (
              <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%', overflowY: 'auto' }}>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '15px 20px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                  <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.1rem' }}>Activity Timeline</h3>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button className="btn-view" style={{ padding: '8px 16px' }} onClick={() => { const d = new Date(analyticsDate); d.setDate(d.getDate() - 7); setAnalyticsDate(d); }}>← Prev Week</button>
                    <div style={{ color: 'var(--accent-gold)', fontWeight: 600, margin: '0 10px', fontFamily: 'var(--font-mono)' }}>
                      {(() => { const d = new Date(analyticsDate); const day = d.getDay() || 7; const mon = new Date(d); mon.setDate(d.getDate() - day + 1); const sun = new Date(mon); sun.setDate(mon.getDate() + 6); const mf = (dt: Date) => dt.toLocaleDateString('en-US', { month: 'short' }); return mon.getMonth() === sun.getMonth() ? `${mf(mon)} ${mon.getDate()}-${sun.getDate()}` : `${mf(mon)} ${mon.getDate()}-${mf(sun)} ${sun.getDate()}`; })()}
                    </div>
                    <button className="btn-view" style={{ padding: '8px 16px' }} onClick={() => { const d = new Date(analyticsDate); d.setDate(d.getDate() + 7); setAnalyticsDate(d); }}>Next Week →</button>
                    <button className="btn-action btn-standard" style={{ padding: '8px 16px', marginLeft: '10px' }} onClick={() => setAnalyticsDate(new Date())}>Current Week</button>
                  </div>
                </div>

                {analyticsLoading || !analyticsData ? (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1, color: 'var(--accent-gold)' }}>Loading Department Analytics...</div>
                ) : (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
                      <div className="hud-card">
                        <div className="hud-bg-icon">📊</div>
                        <div className="hud-label">THIS WEEK</div>
                        <div className="hud-val" style={{ color: 'var(--accent-cyan)' }}>{analyticsData.weeklyHours.toFixed(1)} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>hrs</span></div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '5px' }}>Target: {analyticsData.targetWeeklyHours} hrs</div>
                      </div>
                      <div className="hud-card">
                        <div className="hud-bg-icon">📅</div>
                        <div className="hud-label">THIS MONTH</div>
                        <div className="hud-val">{analyticsData.monthlyHours.toFixed(1)} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>hrs</span></div>
                      </div>
                      <div className="hud-card" style={{ borderColor: analyticsData.weeklyPercentage >= 80 ? 'var(--color-go)' : 'var(--accent-gold)' }}>
                        <div className="hud-bg-icon">📈</div>
                        <div className="hud-label">WEEKLY ACTIVITY %</div>
                        <div className="hud-val" style={{ color: analyticsData.weeklyPercentage >= 80 ? 'var(--color-go)' : 'var(--accent-gold)' }}>{analyticsData.weeklyPercentage.toFixed(1)}%</div>
                        <div className={`status-badge ${analyticsData.weeklyPercentage >= 80 ? 'go' : ''}`} style={{ marginTop: '5px', fontSize: '0.7rem', display: 'inline-block' }}>{analyticsData.weeklyPercentage >= 80 ? 'ON TRACK' : 'NEEDS ATTENTION'}</div>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', flex: 1 }}>
                      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
                        <div className="section-title" style={{ padding: 0, border: 'none', marginBottom: '20px' }}>Hours This Week</div>
                        <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', fontSize: '0.8rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><div style={{ width: '12px', height: '12px', background: 'var(--accent-cyan)', borderRadius: '2px' }}></div> Actual</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-end', flex: 1, gap: '15px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px' }}>
                          {analyticsData.weeklyChart.map((data: any, idx: number) => {
                            const actualHeight = data.target > 0 ? Math.min((data.actual / data.target) * 100, 100) : 0;
                            return (
                              <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, gap: '8px', height: '100%' }}>
                                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '4px', height: '100%', width: '100%' }}>
                                  <div title={`Actual: ${data.actual.toFixed(1)}h`} style={{ height: `${actualHeight}%`, width: '80%', background: 'var(--accent-cyan)', borderRadius: '4px 4px 0 0', minHeight: '5px', opacity: data.actual === 0 ? 0.3 : 1 }}></div>
                                </div>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{data.day}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div className="glass-card" style={{ background: 'rgba(0, 210, 106, 0.05)', borderColor: 'rgba(0, 210, 106, 0.2)' }}>
                          <div className="section-title" style={{ padding: 0, border: 'none', marginBottom: '15px', color: 'var(--color-go)' }}>Generate Reports</div>
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '15px' }}>Export historical hours and activity data.</p>
                          <div style={{ display: 'flex', gap: '10px' }}>
                            <select className="input-rounded" style={{ flex: 1, padding: '10px', backgroundColor: '#1e1e1e', color: '#ffffff', border: '1px solid var(--border-subtle)' }} value={reportTarget} onChange={(e) => setReportTarget(e.target.value)}>
                              <option value="ALL" style={{ backgroundColor: '#1e1e1e', color: '#ffffff' }}>All Direct Reports</option>
                              {roster.map(emp => (<option key={`report-${emp.user_id}`} value={emp.user_id} style={{ backgroundColor: '#1e1e1e', color: '#ffffff' }}>{emp.name}</option>))}
                            </select>
                            <button className="btn-action btn-go" onClick={handleGenerateReport} style={{ width: 'auto', padding: '10px 20px' }}>Export CSV</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </main >
      </div >

      {/* --- ALL MODALS --- */}

      {/* SETTINGS & PASSWORD CHANGE MODAL */}
      {
        showSettingsModal && (
          <div className="modal-overlay" style={{ zIndex: 9999 }}>
            <div className="modal-card" style={{ maxWidth: '500px' }}>
              <div className="modal-header">
                <span className="modal-title" style={{ color: 'var(--accent-gold)' }}>Settings</span>
                <span onClick={resetSettingsState} style={{ cursor: 'pointer' }}>✕</span>
              </div>

              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
                {pwStep === 0 && (
                  <>
                    <div>
                      <h4 style={{ color: 'var(--text-main)', marginBottom: '10px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '5px' }}>Appearance</h4>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-input)', padding: '15px', borderRadius: '8px' }}>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>Theme Mode</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Toggle between Dark and Light mode.</div>
                        </div>
                        <button
                          className="btn-view" onClick={() => setLightMode(!lightMode)}
                          style={{ padding: '8px 15px', color: lightMode ? '#000' : 'var(--accent-gold)', borderColor: 'var(--accent-gold)', background: lightMode ? 'var(--accent-gold)' : 'transparent' }}
                        >
                          {lightMode ? '☀ Light Mode' : '☾ Dark Mode'}
                        </button>
                      </div>
                    </div>

                    <div>
                      <h4 style={{ color: 'var(--text-main)', marginBottom: '10px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '5px' }}>Security</h4>
                      <div style={{ background: 'var(--bg-input)', padding: '15px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>Change Password</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>A verification code will be sent to your registered email address.</div>

                        <button className="btn-action btn-standard" onClick={handleStartPasswordChange} style={{ alignSelf: 'flex-start' }} disabled={!managerEmailInput.trim() || pwLoading}>
                          {pwLoading ? "Sending Code..." : "Change Password"}
                        </button>
                        {pwError && <div style={{ color: 'var(--color-urgent)', fontSize: '0.85rem' }}>{pwError}</div>}
                      </div>
                    </div>
                  </>
                )}

                {/* STEP 1: VERIFY OTP */}
                {pwStep === 1 && (
                  <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <h4 style={{ color: 'var(--accent-gold)' }}>Verify Identity</h4>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Enter the 6-digit code sent to your registered contact.</p>

                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', margin: '15px 0' }}>
                      {otp.map((digit, idx) => (
                        <input
                          key={idx} ref={(el) => { otpRefs.current[idx] = el; }}
                          type="text" inputMode="numeric" maxLength={1} value={digit}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, "");
                            const newOtp = [...otp]; newOtp[idx] = val; setOtp(newOtp);
                            if (val && idx < 5) otpRefs.current[idx + 1]?.focus();
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Backspace" && !otp[idx] && idx > 0) {
                              const newOtp = [...otp]; newOtp[idx - 1] = ""; setOtp(newOtp);
                              otpRefs.current[idx - 1]?.focus();
                            }
                          }}
                          style={{ width: '45px', height: '55px', textAlign: 'center', fontSize: '1.5rem', backgroundColor: '#1e1e1e', border: '1px solid #444', color: '#fff', borderRadius: '8px' }}
                        />
                      ))}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', fontSize: '0.82rem', margin: '0 0 5px 0' }}>
                      {otpCountdown > 0 ? (
                        <span style={{ color: 'var(--text-muted, #666)' }}>RESEND IN {otpCountdown}s</span>
                      ) : (
                        <>
                          <span style={{ color: 'var(--text-muted, #666)' }}>CODE EXPIRED?</span>
                          <span
                            onClick={handleResendOtp}
                            style={{ color: 'var(--accent-gold, #f59e0b)', fontWeight: 700, cursor: resending ? 'not-allowed' : 'pointer', opacity: resending ? 0.6 : 1 }}
                          >
                            {resending ? "RESENDING..." : "RESEND CODE"}
                          </span>
                        </>
                      )}
                    </div>

                    {pwError && <div style={{ color: 'var(--color-urgent)', fontSize: '0.85rem', textAlign: 'center' }}>{pwError}</div>}

                    <button className="btn-action btn-go" onClick={handleVerifyOtp} disabled={pwLoading || otp.join('').length < 6} style={{ opacity: (pwLoading || otp.join('').length < 6) ? 0.5 : 1 }}>
                      {pwLoading ? "Verifying..." : "Verify Code"}
                    </button>
                  </div>
                )}

                {/* STEP 2: SECURITY QUESTION */}
                {pwStep === 2 && (
                  <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <h4 style={{ color: 'var(--accent-gold)' }}>Security Question</h4>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Please answer your security question to continue.</p>

                    <div style={{ background: 'var(--bg-input)', padding: '15px', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 600 }}>
                      {secQuestion.text}
                    </div>

                    <input
                      type="text" placeholder="Your Answer"
                      style={{ width: '100%', padding: '12px', backgroundColor: '#1e1e1e', color: '#ffffff', border: '1px solid #444', borderRadius: '8px' }}
                      value={secAnswer} onChange={(e) => setSecAnswer(e.target.value)}
                    />

                    {pwError && <div style={{ color: 'var(--color-urgent)', fontSize: '0.85rem', textAlign: 'center' }}>{pwError}</div>}

                    <button className="btn-action btn-go" onClick={handleAnswerQuestion} disabled={pwLoading || !secAnswer.trim()} style={{ opacity: (pwLoading || !secAnswer.trim()) ? 0.5 : 1 }}>
                      {pwLoading ? "Verifying..." : "Submit Answer"}
                    </button>
                  </div>
                )}

                {/* STEP 3: NEW PASSWORD */}
                {pwStep === 3 && (
                  <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <h4 style={{ color: 'var(--accent-gold)' }}>Create New Password</h4>

                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input
                        type={showPw ? "text" : "password"} placeholder="New Password"
                        style={{ width: '100%', padding: '12px', paddingRight: '120px', backgroundColor: '#1e1e1e', color: '#ffffff', border: '1px solid #444', borderRadius: '8px' }}
                        value={newPassword} onChange={(e) => setNewPassword(e.target.value.slice(0, 20))}
                      />
                      <button type="button" onClick={() => setShowPw(!showPw)} style={{ position: 'absolute', right: '10px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase', padding: '5px' }}>
                        {showPw ? "Hide Password" : "Show Password"}
                      </button>
                    </div>

                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input
                        type={showConfirmPw ? "text" : "password"} placeholder="Confirm Password"
                        style={{ width: '100%', padding: '12px', paddingRight: '120px', backgroundColor: '#1e1e1e', color: '#ffffff', border: '1px solid #444', borderRadius: '8px' }}
                        value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value.slice(0, 20))}
                      />
                      <button type="button" onClick={() => setShowConfirmPw(!showConfirmPw)} style={{ position: 'absolute', right: '10px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase', padding: '5px' }}>
                        {showConfirmPw ? "Hide Password" : "Show Password"}
                      </button>
                    </div>

                    <div style={{ fontSize: '0.75rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: 'var(--bg-input)', padding: '15px', borderRadius: '8px' }}>
                      <div style={{ color: pwValidation.lengthOk ? 'var(--color-go)' : 'var(--text-muted)' }}>• 15-20 characters</div>
                      <div style={{ color: pwValidation.upperOk ? 'var(--color-go)' : 'var(--text-muted)' }}>• Uppercase letter</div>
                      <div style={{ color: pwValidation.lowerOk ? 'var(--color-go)' : 'var(--text-muted)' }}>• Lowercase letter</div>
                      <div style={{ color: pwValidation.numberOk ? 'var(--color-go)' : 'var(--text-muted)' }}>• Number</div>
                      <div style={{ color: pwValidation.symbolOk ? 'var(--color-go)' : 'var(--text-muted)' }}>• Symbol (! @ ? _ -)</div>
                      <div style={{ color: passwordsMatch ? 'var(--color-go)' : 'var(--text-muted)' }}>• Passwords match</div>
                    </div>

                    {pwError && <div style={{ color: 'var(--color-urgent)', fontSize: '0.85rem', textAlign: 'center' }}>{pwError}</div>}

                    <button className="btn-action btn-go" onClick={handleResetPassword} disabled={pwLoading || !pwValidation.strongOk || !passwordsMatch} style={{ opacity: (pwLoading || !pwValidation.strongOk || !passwordsMatch) ? 0.5 : 1 }}>
                      {pwLoading ? "Saving..." : "Set New Password"}
                    </button>
                  </div>
                )}

                {/* STEP 4: SUCCESS */}
                {pwStep === 4 && (
                  <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px', padding: '20px 0' }}>
                    <div style={{ fontSize: '3rem', color: 'var(--color-go)' }}>✅</div>
                    <h4 style={{ color: 'var(--text-main)' }}>Password Updated</h4>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center' }}>Your password has been successfully changed.</p>
                    <button className="btn-view" onClick={resetSettingsState} style={{ marginTop: '10px', padding: '10px 20px' }}>Return to Settings</button>
                  </div>
                )}

              </div>
              {pwStep === 0 && (
                <div className="modal-footer" style={{ borderTop: 'none', paddingBottom: '20px' }}>
                  <button className="btn-view" style={{ width: '100%', padding: '14px', fontSize: '1rem' }} onClick={resetSettingsState}>Close Menu</button>
                </div>
              )}
              {pwStep > 0 && pwStep < 4 && (
                <div className="modal-footer" style={{ borderTop: 'none', paddingBottom: '20px' }}>
                  <button className="btn-view" style={{ width: '100%', padding: '14px', fontSize: '1rem' }} onClick={resetSettingsState}>Cancel Update</button>
                </div>
              )}
            </div>
          </div>
        )
      }

      {/* 1. APPROVE TIMESHEET CONFIRMATION MODAL */}
      {
        approveModal.show && (
          <div className="modal-overlay" style={{ zIndex: 9999 }}>
            <div className="modal-card" style={{ maxWidth: '400px', textAlign: 'center' }}>
              <div className="modal-body" style={{ padding: '30px 20px' }}>
                <div style={{ fontSize: '3rem', marginBottom: '15px', color: 'var(--color-go)' }}>✅</div>
                <h3 style={{ color: 'var(--text-main)', marginBottom: '10px' }}>Confirm Approval</h3>
                <p style={{ color: 'var(--text-muted)' }}>Are you sure you want to approve this timesheet?</p>
              </div>
              <div className="modal-footer" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', borderTop: 'none', paddingBottom: '30px' }}>
                <button className="btn-view" style={{ padding: '14px', fontSize: '1rem' }} onClick={() => setApproveModal({ show: false, tlogIds: [] })}>Cancel</button>
                <button className="btn-action btn-go" style={{ padding: '14px', fontSize: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={executeApproveTimesheet} disabled={isLoading}>
                  {isLoading ? "Processing..." : "Yes, Approve"}
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* 2. REJECT TIMESHEET REASON MODAL */}
      {
        rejectModal.show && (
          <div className="modal-overlay">
            <div className="modal-card">
              <div className="modal-header">
                <span className="modal-title" style={{ color: 'var(--color-urgent)' }}>Reject Timesheet</span>
                <span onClick={() => setRejectModal({ show: false, tlogIds: [], reason: '' })} style={{ cursor: 'pointer' }}>✕</span>
              </div>
              <div className="modal-body">
                <p style={{ color: 'var(--text-muted)', marginBottom: '15px', fontSize: '0.9rem' }}>
                  Please provide a reason for rejection. This will change the status to <span className="tag tag-out">Action Required</span> and return it to the staff.
                </p>
                <label className="hud-label" style={{ marginBottom: '5px', display: 'block' }}>Reason (Letters, numbers, and .,?! only)</label>
                <textarea
                  className="input-rounded" rows={4}
                  style={{ width: '100%', resize: 'none', background: '#1e1e1e', color: '#ffffff', border: '1px solid #444', padding: '15px', borderRadius: '8px' }}
                  value={rejectModal.reason}
                  onChange={(e) => setRejectModal({ ...rejectModal, reason: e.target.value })}
                  placeholder="e.g. Please verify the end time."
                />
              </div>
              <div className="modal-footer" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', borderTop: 'none', paddingBottom: '30px' }}>
                <button className="btn-view" style={{ padding: '14px', fontSize: '1rem' }} onClick={() => setRejectModal({ show: false, tlogIds: [], reason: '' })}>Cancel</button>
                <button className="btn-action btn-urgent" style={{ padding: '14px', fontSize: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={() => {
                  const isValidReason = /^[a-zA-Z0-9.,?! \n]+$/.test(rejectModal.reason);
                  if (!isValidReason || !rejectModal.reason.trim()) {
                    alert("Please enter a valid reason.");
                    return;
                  }
                  setRejectConfirmModal(true);
                }}>Return to Staff</button>
              </div>
            </div>
          </div>
        )
      }

      {/* 3. REJECT TIMESHEET CONFIRMATION MODAL */}
      {
        rejectConfirmModal && (
          <div className="modal-overlay" style={{ zIndex: 99999 }}>
            <div className="modal-card" style={{ maxWidth: '400px', textAlign: 'center' }}>
              <div className="modal-body" style={{ padding: '30px 20px' }}>
                <div style={{ fontSize: '3rem', marginBottom: '15px', color: 'var(--color-urgent)' }}>⚠️</div>
                <h3 style={{ color: 'var(--text-main)', marginBottom: '10px' }}>Confirm Rejection</h3>
                <p style={{ color: 'var(--text-muted)' }}>Are you sure you want to return this timesheet to the employee? They will be notified of the reason.</p>
              </div>
              <div className="modal-footer" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', borderTop: 'none', paddingBottom: '30px' }}>
                <button className="btn-view" style={{ padding: '14px', fontSize: '1rem' }} onClick={() => setRejectConfirmModal(false)}>Cancel</button>
                <button className="btn-action btn-urgent" style={{ padding: '14px', fontSize: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={executeRejectTimesheet} disabled={isLoading}>
                  {isLoading ? "Processing..." : "Yes, Reject"}
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* 4. EDIT SHIFT MODAL */}
      {
        editShiftModal.show && (
          <div className="modal-overlay">
            <div className="modal-card">
              <div className="modal-header">
                <span className="modal-title" style={{ color: 'var(--accent-gold)' }}>Edit Shift</span>
                <span onClick={() => setEditShiftModal({ ...editShiftModal, show: false })} style={{ cursor: 'pointer' }}>✕</span>
              </div>
              <div className="modal-body">
                <p style={{ color: 'var(--text-muted)', marginBottom: '15px', fontSize: '0.9rem' }}>
                  Updating schedule for <strong style={{ color: 'var(--text-main)' }}>{editShiftModal.empName}</strong> on <strong>{editShiftModal.day}</strong>.
                </p>

                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px', marginBottom: '15px' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Current Shift</div>
                  <div style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>{editShiftModal.currentShift}</div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <label className="hud-label" style={{ marginBottom: '-5px' }}>Assign New Shift</label>
                  <select
                    className="input-rounded"
                    style={{ width: '100%', padding: '10px', backgroundColor: '#1e1e1e', color: '#ffffff', border: '1px solid #444' }}
                    value={editShiftModal.newShiftId}
                    onChange={(e) => setEditShiftModal({ ...editShiftModal, newShiftId: e.target.value })}
                  >
                    <option value="" style={{ backgroundColor: '#1e1e1e', color: '#ffffff' }}>-- Select a Shift --</option>
                    <option value="OFF" style={{ backgroundColor: '#1e1e1e', color: '#ffffff' }}>Day Off (No Shift)</option>
                    {shiftTemplates.map(shift => (
                      <option key={shift.shift_id} value={shift.shift_id} style={{ backgroundColor: '#1e1e1e', color: '#ffffff' }}>
                        {shift.shift_name} ({shift.time_string})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="modal-footer" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', borderTop: 'none', paddingBottom: '30px' }}>
                <button className="btn-view" style={{ padding: '14px', fontSize: '1rem' }} onClick={() => setEditShiftModal({ ...editShiftModal, show: false })}>Cancel</button>
                <button
                  className="btn-action btn-standard"
                  style={{ padding: '14px', fontSize: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                  onClick={() => {
                    if (!editShiftModal.newShiftId) {
                      alert("Please select a new shift from the dropdown.");
                      return;
                    }
                    setSaveShiftConfirmModal(true);
                  }}
                  disabled={isLoading}
                >
                  {isLoading ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* 5. SHIFT SAVE CONFIRMATION MODAL */}
      {
        saveShiftConfirmModal && (
          <div className="modal-overlay" style={{ zIndex: 9999 }}>
            <div className="modal-card" style={{ maxWidth: '400px', textAlign: 'center' }}>
              <div className="modal-body" style={{ padding: '30px 20px' }}>
                <div style={{ fontSize: '3rem', marginBottom: '15px', color: 'var(--accent-gold)' }}>⚠️</div>
                <h3 style={{ color: 'var(--text-main)', marginBottom: '10px' }}>Confirm Shift Change</h3>
                <p style={{ color: 'var(--text-muted)' }}>
                  Are you sure you want to change the shift for <strong style={{ color: 'var(--text-main)' }}>{editShiftModal.empName}</strong> on <strong>{editShiftModal.day}</strong>?
                </p>
              </div>
              <div className="modal-footer" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', borderTop: 'none', paddingBottom: '30px' }}>
                <button className="btn-view" style={{ padding: '14px', fontSize: '1rem' }} onClick={() => setSaveShiftConfirmModal(false)}>Cancel</button>
                <button className="btn-action btn-go" style={{ padding: '14px', fontSize: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={executeSaveShiftEdit} disabled={isLoading}>
                  {isLoading ? "Saving..." : "Confirm Change"}
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* 6. LOGOUT CONFIRMATION MODAL */}
      {
        logoutModal && (
          <div className="modal-overlay" style={{ zIndex: 9999 }}>
            <div className="modal-card" style={{ maxWidth: '400px', textAlign: 'center' }}>
              <div className="modal-body" style={{ padding: '30px 20px' }}>
                <div style={{ fontSize: '3rem', marginBottom: '15px' }}>🚪</div>
                <h3 style={{ color: 'var(--text-main)', marginBottom: '10px' }}>Log Out</h3>
                <p style={{ color: 'var(--text-muted)' }}>Are you sure you want to end your session and return to the login page?</p>
              </div>
              <div className="modal-footer" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', borderTop: 'none', paddingBottom: '30px' }}>
                <button className="btn-view" style={{ padding: '14px', fontSize: '1rem' }} onClick={() => setLogoutModal(false)}>Cancel</button>
                <button className="btn-action btn-urgent" style={{ padding: '14px', fontSize: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={executeLogout}>Yes, Log Out</button>
              </div>
            </div>
          </div>
        )
      }

      {/* CLOCK OUT MODAL */}
      {
        showClockOutModal && (
          <div className="modal-overlay" style={{ zIndex: 9999 }}>
            <div className="modal-card" style={{ maxWidth: '400px', textAlign: 'center' }}>
              <div className="modal-body" style={{ padding: '30px 20px' }}>
                <div style={{ fontSize: '3rem', marginBottom: '15px' }}>⏱️</div>
                <h3 style={{ color: 'var(--text-main)', marginBottom: '10px' }}>End Management Session</h3>
                <p style={{ color: 'var(--text-muted)' }}>Are you sure you want to clock out? Your session time will stop recording.</p>
              </div>
              <div className="modal-footer" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', borderTop: 'none', paddingBottom: '30px' }}>
                <button className="btn-action btn-standard" style={{ padding: '14px', fontSize: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={() => setShowClockOutModal(false)} disabled={clockOutLoading}>Cancel</button>
                <button className="btn-action btn-urgent" style={{ padding: '14px', fontSize: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#ff0000', color: 'white' }} onClick={handleClockOut} disabled={clockOutLoading}>
                  {clockOutLoading ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                      Loading...
                    </span>
                  ) : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* POST-CLOCK OUT LOGOUT MODAL */}
      {
        showPostClockOutModal && (
          <div className="modal-overlay" style={{ zIndex: 9999 }}>
            <div className="modal-card" style={{ maxWidth: '400px', textAlign: 'center' }}>
              <div className="modal-body" style={{ padding: '30px 20px' }}>
                <div style={{ fontSize: '3rem', marginBottom: '15px' }}>✅</div>
                <h3 style={{ color: 'var(--text-main)', marginBottom: '10px' }}>Clock Out Successful</h3>
                <p style={{ color: 'var(--text-muted)' }}>You have successfully ended your management session. Would you like to log out of the application?</p>
              </div>
              <div className="modal-footer" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', borderTop: 'none', paddingBottom: '30px' }}>
                <button className="btn-action btn-standard" style={{ padding: '14px', fontSize: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={() => setShowPostClockOutModal(false)}>No</button>
                <button className="btn-action btn-urgent" style={{ padding: '14px', fontSize: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={executeLogout}>Log-out</button>
              </div>
            </div>
          </div>
        )
      }

      {/* 7. ACTIVE SESSION NOTICE MODAL */}
      {
        activeSessionNotice && (
          <div className="modal-overlay" style={{ zIndex: 9999 }}>
            <div className="modal-card" style={{ maxWidth: '400px', textAlign: 'center' }}>
              <div className="modal-body" style={{ padding: '30px 20px' }}>
                <div style={{ fontSize: '3rem', marginBottom: '15px', color: 'var(--color-urgent)' }}>⚠️</div>
                <h3 style={{ color: 'var(--text-main)', marginBottom: '10px' }}>Active Session Detected</h3>
                <p style={{ color: 'var(--text-muted)' }}>You are currently clocked in. Please clock out before logging out to ensure your time is recorded correctly.</p>
              </div>
              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'center', borderTop: 'none', paddingBottom: '30px' }}>
                <button className="btn-action btn-standard" style={{ padding: '10px 30px', fontSize: '1rem' }} onClick={() => setActiveSessionNotice(false)}>Understood</button>
              </div>
            </div>
          </div>
        )
      }

      {/* OTHER EXISTING MODALS (Schedule Override, Activity) */}
      {
        showScheduleModal && (
          <div className="modal-overlay">
            <div className="modal-card">
              <div className="modal-header">
                <span className="modal-title" style={{ color: 'var(--accent-gold)' }}>Add Schedule Override</span>
                <span onClick={() => setShowScheduleModal(false)} style={{ cursor: 'pointer' }}>✕</span>
              </div>
              <div className="modal-body">
                <p style={{ color: 'var(--text-muted)', marginBottom: '15px', fontSize: '0.8rem' }}>
                  Assign a specific task and time slot to an employee.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <div style={{ position: 'relative' }}>
                    <label className="hud-label" style={{ marginBottom: '5px', display: 'block' }}>Search Employee</label>
                    <input
                      type="text"
                      className="input-rounded"
                      placeholder="Type name (e.g. John)..."
                      value={selectedEmp ? `${selectedEmp.first_name} ${selectedEmp.last_name}` : schedSearch}
                      onChange={(e) => {
                        setSchedSearch(e.target.value);
                        setSelectedEmp(null);
                      }}
                      style={{ width: '100%', padding: '10px', backgroundColor: '#1e1e1e', color: '#ffffff', border: '1px solid #444', borderRadius: '8px' }}
                    />
                    {schedResults.length > 0 && !selectedEmp && (
                      <div style={{
                        position: 'absolute', top: '100%', left: 0, right: 0,
                        background: 'var(--bg-panel)', border: '1px solid var(--border-subtle)',
                        zIndex: 10, borderRadius: '8px', maxHeight: '150px', overflowY: 'auto'
                      }}>
                        {schedResults.map(emp => (
                          <div
                            key={emp.user_id}
                            style={{ padding: '10px', cursor: 'pointer', borderBottom: '1px solid var(--border-subtle)' }}
                            onClick={() => {
                              setSelectedEmp(emp);
                              setSchedResults([]);
                            }}
                            onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-input)'}
                            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            <div style={{ fontWeight: 600 }}>{emp.first_name} {emp.last_name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{emp.user_id} • {emp.D_tbldepartment?.dept_name}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label className="hud-label" style={{ marginBottom: '5px', display: 'block' }}>Date</label>
                      <input type="date" className="input-rounded" value={schedForm.date} onChange={(e) => setSchedForm({ ...schedForm, date: e.target.value })} style={{ width: '100%', padding: '12px' }} />
                    </div>
                    <div>
                      <label className="hud-label" style={{ marginBottom: '5px', display: 'block' }}>Time Slot (Start - End)</label>
                      <div style={{ display: 'flex', gap: '5px' }}>
                        <input type="time" className="input-rounded" value={schedForm.start} onChange={(e) => setSchedForm({ ...schedForm, start: e.target.value })} style={{ width: '100%', padding: '12px' }} />
                        <input type="time" className="input-rounded" value={schedForm.end} onChange={(e) => setSchedForm({ ...schedForm, end: e.target.value })} style={{ width: '100%', padding: '12px' }} />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="hud-label" style={{ marginBottom: '5px', display: 'block' }}>Assigned Task</label>
                    <input type="text" className="input-rounded" placeholder="e.g. Emergency Room Support" value={schedForm.task} onChange={(e) => setSchedForm({ ...schedForm, task: e.target.value })} style={{ width: '100%', padding: '12px' }} />
                  </div>
                </div>
              </div>
              <div className="modal-footer" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <button className="btn-view" style={{ padding: '12px', fontSize: '1rem' }} onClick={() => setShowScheduleModal(false)}>Cancel</button>
                <button className="btn-action btn-standard" style={{ padding: '12px', fontSize: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={handleAssignSchedule} disabled={isLoading}>
                  {isLoading ? "Saving..." : "Assign Schedule"}
                </button>
              </div>
            </div>
          </div>
        )
      }

      {
        showActivityModal && (
          <div className="modal-overlay">
            <div className="modal-card">
              <div className="modal-header">
                <span className="modal-title" style={{ color: 'var(--text-main)' }}>Manage Activities</span>
                <span onClick={() => setShowActivityModal(false)} style={{ cursor: 'pointer', color: 'var(--text-muted)' }}>✕</span>
              </div>
              <div className="modal-body">
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input type="text" className="input-rounded" placeholder="New Activity Code" style={{ flex: 1, padding: '12px' }} />
                  <button className="btn-action btn-go" style={{ width: 'auto', padding: '0 25px' }}>Add</button>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn-action btn-standard" onClick={() => setShowActivityModal(false)}>Done</button>
              </div>
            </div>
          </div>
        )
      }

      {/* View Details Modal (Split-Pane Timeline Layout) */}
      {detailsModal.show && selectedTimesheet && (() => {
        const billableCount = selectedTimesheet.activities?.filter((d: any) => d.is_billable).length || 0;
        const totalCount = selectedTimesheet.activities?.length || 0;
        const initials = selectedTimesheet.employee_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || '??';
        return (
          <div className={`modal-overlay-improved manager-theme ${lightMode ? 'light-mode' : ''} ${isDetailsClosing ? 'modal-closing' : ''}`} onClick={closeDetailsModal} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div className={`modal-card-improved details-modal ${isDetailsClosing ? 'modal-card-closing' : ''}`} onClick={(e) => e.stopPropagation()} style={{
              padding: 0,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              width: '1020px',
              maxWidth: '95vw',
              height: '660px',
              maxHeight: '90vh',
              boxShadow: 'var(--shadow-card)',
              borderRadius: '16px'
            }}>

              {/* TOP STATUS BAR */}
              <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-input)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '5px 12px',
                  background: 'rgba(251, 191, 36, 0.1)',
                  color: 'var(--color-warn)',
                  borderRadius: '20px',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  letterSpacing: '1px',
                  textTransform: 'uppercase' as const,
                  border: '1px solid rgba(251, 191, 36, 0.2)'
                }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-warn)', boxShadow: '0 0 6px var(--color-warn)', animation: 'pulse 2s ease-in-out infinite' }} /> Pending Approval
                </div>
                <button
                  onClick={closeDetailsModal}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem', display: 'flex', padding: '6px', borderRadius: '50%', transition: 'all 0.2s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-main)'; e.currentTarget.style.background = 'var(--bg-input)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent' }}
                >
                  ✕
                </button>
              </div>

              {/* Two-pane row container */}
              <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

                {/* LEFT PANE with accent bar */}
                <div style={{
                  width: '300px',
                  minWidth: '300px',
                  background: 'var(--bg-deep)',
                  backgroundImage: 'linear-gradient(180deg, rgba(59,130,246,0.08) 0%, transparent 40%)',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative'
                }}>
                  {/* Right-edge separator glow */}
                  <div style={{ position: 'absolute', right: '-1px', top: 0, bottom: 0, width: '1px', background: 'linear-gradient(180deg, var(--accent-primary), var(--accent-cyan), var(--border-subtle))', opacity: 0.5, zIndex: 2 }} />
                  <div style={{ position: 'absolute', right: '-4px', top: 0, bottom: 0, width: '8px', background: 'linear-gradient(90deg, rgba(59,130,246,0.08), transparent)', pointerEvents: 'none', zIndex: 1 }} />
                  {/* Accent edge line */}
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '3px', background: 'linear-gradient(180deg, var(--accent-primary), var(--accent-cyan), transparent)', borderRadius: '0 2px 2px 0' }} />

                  <div style={{ padding: '35px 28px 0 32px' }}>
                    {/* Profile Section */}
                    <div style={{ textAlign: 'center', marginBottom: '20px', paddingBottom: '22px', borderBottom: '1px solid var(--border-subtle)' }}>
                      <div style={{
                        width: 56, height: 56, borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-highlight))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '1.1rem', fontWeight: 800, color: 'white', letterSpacing: '1px',
                        margin: '0 auto 14px',
                        boxShadow: '0 0 24px var(--shadow-glow)'
                      }}>{initials}</div>
                      <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.3px' }}>{selectedTimesheet.employee_name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px', letterSpacing: '0.5px' }}>Timesheet Report</div>
                    </div>
                  </div>

                  {/* Scrollable Bottom Area */}
                  <div style={{ padding: '0 28px 35px 32px', flex: 1, overflowY: 'auto' }}>
                    {/* Dynamic Bottom Left Section: Stats vs Condensed Timeline */}
                    {detailsViewMode === 'timeline' ? (
                      <div key={`stats-${detailsViewMode}`} style={{ display: 'flex', flexDirection: 'column', gap: '12px', animation: 'cardSlideIn 0.35s ease-out forwards' }}>
                        <div style={{ background: 'var(--bg-input)', borderRadius: '10px', padding: '14px 16px', border: '1px solid var(--border-subtle)', boxShadow: lightMode ? '0 2px 8px rgba(0,0,0,0.04)' : 'none' }}>
                          <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text-muted)', marginBottom: 6 }}>Date Logged</div>
                          <div style={{ fontWeight: 600, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)' }}>
                            <span style={{ opacity: 0.6, fontSize: '0.9rem' }}>📅</span> {selectedTimesheet.date}
                          </div>
                        </div>

                        <div style={{ background: 'var(--bg-input)', borderRadius: '10px', padding: '14px 16px', border: '1px solid var(--border-subtle)', boxShadow: lightMode ? '0 2px 8px rgba(0,0,0,0.04)' : 'none' }}>
                          <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text-muted)', marginBottom: 6 }}>Total Hours</div>
                          <div style={{ fontWeight: 700, fontSize: '1.8rem', color: 'var(--accent-cyan)', lineHeight: 1 }}>
                            {Number(selectedTimesheet.total_hours).toFixed(2)} <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>hrs</span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '10px' }}>
                          <div style={{ flex: 1, background: 'var(--bg-input)', borderRadius: '10px', padding: '12px 14px', border: '1px solid var(--border-subtle)', boxShadow: lightMode ? '0 2px 8px rgba(0,0,0,0.04)' : 'none' }}>
                            <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text-muted)', marginBottom: 4 }}>Activities</div>
                            <div style={{ fontWeight: 700, fontSize: '1.3rem', color: 'var(--text-main)' }}>{totalCount}</div>
                          </div>
                          <div style={{ flex: 1, background: 'rgba(74, 222, 128, 0.04)', borderRadius: '10px', padding: '12px 14px', border: '1px solid rgba(74, 222, 128, 0.08)', boxShadow: lightMode ? '0 2px 8px rgba(34,197,94,0.06)' : 'none' }}>
                            <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--color-go)', marginBottom: 4 }}>Billable</div>
                            <div style={{ fontWeight: 700, fontSize: '1.3rem', color: 'var(--color-go)' }}>{billableCount}</div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div key={`summary-${detailsViewMode}`} style={{ display: 'flex', flexDirection: 'column', gap: '10px', animation: 'cardSlideIn 0.35s ease-out forwards' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px', paddingLeft: '4px' }}>
                          <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', fontWeight: 700 }}>Summary Timeline</span>
                          <span style={{ fontSize: '0.65rem', background: 'var(--bg-input)', padding: '3px 8px', borderRadius: '10px', color: 'var(--text-muted)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{totalCount} entries</span>
                        </div>
                        {selectedTimesheet.activities && selectedTimesheet.activities.length > 0 ? (
                          selectedTimesheet.activities.map((detail: any, idx: number) => (
                            <div key={idx} style={{
                              background: 'var(--bg-input)',
                              border: '1px solid var(--border-subtle)',
                              borderLeft: `3px solid ${detail.is_billable ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                              borderRadius: '8px',
                              padding: '12px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '6px',
                              boxShadow: lightMode ? '0 4px 12px rgba(0,0,0,0.05)' : 'none'
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '70%' }}>
                                  <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-main)', lineHeight: 1.2 }}>{detail.activity_name}</span>
                                  {detail.is_billable && (
                                    <span style={{ alignSelf: 'flex-start', fontSize: '0.55rem', color: 'var(--color-go)', fontWeight: 700, background: 'rgba(74, 222, 128, 0.1)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(74, 222, 128, 0.15)' }}>BILLABLE</span>
                                  )}
                                </div>
                                <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>{detail.hours || '00:00'}</span>
                              </div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center' }}>
                                <span>{detail.start_time}</span>
                                <span style={{ opacity: 0.4, margin: '0 4px' }}>→</span>
                                <span>{detail.end_time}</span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0', background: 'var(--bg-input)', borderRadius: '10px', border: '1px dashed var(--border-subtle)' }}>No activities</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* RIGHT PANE */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-panel)', minWidth: 0, position: 'relative', overflow: 'hidden' }}>

                  {detailsViewMode === 'timeline' && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', animation: 'fadeIn 0.25s ease forwards' }}>
                      {/* Header */}
                      <div style={{ padding: '24px 32px 18px', borderBottom: '1px solid var(--border-subtle)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>Activity Timeline</h3>
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', background: 'var(--bg-input)', padding: '3px 10px', borderRadius: '12px', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{totalCount} entries</div>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '3px' }}>Chronological breakdown of {selectedTimesheet.date}</div>
                      </div>

                      {/* Scrollable Timeline with mask fade */}
                      <div style={{
                        flex: 1,
                        overflowY: 'auto',
                        padding: '28px 32px',
                        maskImage: 'linear-gradient(to bottom, transparent 0%, black 8%, black 92%, transparent 100%)',
                        WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 8%, black 92%, transparent 100%)'
                      }}>
                        {selectedTimesheet.activities && selectedTimesheet.activities.length > 0 ? (
                          <div style={{ position: 'relative', paddingLeft: '28px' }}>
                            {/* Vertical Timeline Line */}
                            <div style={{ position: 'absolute', left: '6px', top: '10px', bottom: '10px', width: '2px', background: 'linear-gradient(180deg, var(--accent-primary), var(--accent-cyan), var(--border-subtle))', borderRadius: '2px', opacity: 0.4 }} />

                            {selectedTimesheet.activities.map((detail: any, idx: number) => (
                              <div key={idx} style={{
                                position: 'relative',
                                marginBottom: idx === selectedTimesheet.activities.length - 1 ? 0 : '16px',
                                opacity: 0,
                                animation: `cardSlideIn 0.35s ease-out ${idx * 0.06}s both`
                              }}>

                                {/* Timeline Dot */}
                                <div style={{
                                  position: 'absolute',
                                  left: '-28px',
                                  top: '16px',
                                  width: '10px',
                                  height: '10px',
                                  borderRadius: '50%',
                                  background: detail.is_billable
                                    ? 'linear-gradient(135deg, var(--accent-primary), var(--accent-cyan))'
                                    : 'var(--bg-panel)',
                                  border: detail.is_billable
                                    ? '2px solid var(--accent-highlight)'
                                    : '2px solid var(--border-subtle)',
                                  boxShadow: detail.is_billable
                                    ? '0 0 8px rgba(167, 139, 250, 0.6), 0 0 3px rgba(167, 139, 250, 0.3)'
                                    : '0 0 4px rgba(0,0,0,0.3)',
                                  zIndex: 2
                                }} />

                                {/* Content Card with left accent border */}
                                <div style={{
                                  background: 'var(--bg-input)',
                                  border: '1px solid var(--border-subtle)',
                                  borderLeft: `3px solid ${detail.is_billable ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                                  borderRadius: '10px',
                                  padding: '14px 16px',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  transition: 'all 0.2s',
                                  gap: '16px',
                                  boxShadow: lightMode ? '0 4px 15px rgba(0,0,0,0.06)' : 'none'
                                }}
                                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-card)'; e.currentTarget.style.borderColor = 'var(--accent-primary)'; e.currentTarget.style.borderLeftColor = detail.is_billable ? 'var(--accent-highlight)' : 'var(--accent-primary)'; if (lightMode) e.currentTarget.style.boxShadow = '0 6px 20px rgba(167,139,250,0.15)'; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-input)'; e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.borderLeftColor = detail.is_billable ? 'var(--accent-primary)' : 'var(--border-subtle)'; if (lightMode) e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.06)'; }}
                                >
                                  <div style={{ minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                                      <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-main)' }}>{detail.activity_name}</span>
                                      {detail.is_billable && (
                                        <span style={{ fontSize: '0.6rem', color: 'var(--color-go)', fontWeight: 700, background: 'rgba(74, 222, 128, 0.1)', padding: '2px 7px', borderRadius: '10px', border: '1px solid rgba(74, 222, 128, 0.15)' }}>BILLABLE</span>
                                      )}
                                    </div>
                                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'var(--font-mono)' }}>
                                      <span>{detail.start_time}</span>
                                      <span style={{ opacity: 0.4 }}>→</span>
                                      <span>{detail.end_time}</span>
                                    </div>
                                  </div>
                                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                    <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>
                                      {detail.hours || '00:00'}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', opacity: 0.5 }}>
                            <div style={{ fontSize: '3rem', marginBottom: '15px' }}>📭</div>
                            <div>No detailed activities found for this session.</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {detailsViewMode === 'approve' && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', animation: 'scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
                      {/* Header */}
                      <div style={{ padding: '40px 40px 24px', borderBottom: '1px solid var(--border-subtle)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                          <div className="modal-icon-wrapper approve-icon" style={{ margin: 0, width: '50px', height: '50px', fontSize: '1.8rem' }}>✓</div>
                          <div>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>Approve Timesheet?</h3>
                            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '4px' }}>Confirm approval of these recorded hours</div>
                          </div>
                        </div>
                      </div>

                      {/* Action Body */}
                      <div style={{
                        flex: 1,
                        overflowY: 'auto',
                        padding: '40px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center'
                      }}>
                        <div style={{
                          maxWidth: '500px', width: '100%',
                          background: 'var(--bg-deep)', borderRadius: '16px', padding: '30px',
                          border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '16px',
                          boxShadow: '0 10px 30px rgba(0,0,0,0.1)'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Employee</span>
                            <span style={{ color: 'var(--text-main)', fontWeight: 700, fontSize: '1rem' }}>{selectedTimesheet.employee_name}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Period</span>
                            <span style={{ color: 'var(--text-main)', fontWeight: 600, fontSize: '1rem' }}>{selectedTimesheet.date}</span>
                          </div>
                          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '16px', marginTop: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Total Hours</span>
                            <span style={{ color: '#22c55e', fontWeight: 800, fontSize: '1.4rem' }}>{selectedTimesheet.total_hours.toFixed(2)}h</span>
                          </div>
                        </div>
                        <p style={{ color: 'var(--text-muted)', textAlign: 'center', margin: '30px 0 0 0', fontSize: '0.95rem', lineHeight: '1.6', maxWidth: '500px' }}>
                          By approving, you verify that these hours are accurate to your knowledge and comply with company policy. This action will process the timesheet.
                        </p>
                      </div>
                    </div>
                  )}

                  {detailsViewMode === 'reject' && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', animation: 'scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
                      {/* Header */}
                      <div style={{ padding: '40px 40px 24px', borderBottom: '1px solid var(--border-subtle)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                          <div className="modal-icon-wrapper reject-icon" style={{ margin: 0, width: '50px', height: '50px', fontSize: '1.8rem' }}>✗</div>
                          <div>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>Reject Timesheet?</h3>
                            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '4px' }}>Confirm rejection and provide a detailed reason</div>
                          </div>
                        </div>
                      </div>

                      {/* Action Body */}
                      <div style={{
                        flex: 1,
                        overflowY: 'auto',
                        padding: '40px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center'
                      }}>
                        <div className="form-group-improved" style={{ width: '100%', maxWidth: '500px' }}>
                          <label className="label-improved" style={{ fontSize: '0.85rem', marginBottom: '10px' }}>Rejection Reason *</label>
                          <textarea
                            className="textarea-improved"
                            rows={6}
                            style={{ fontSize: '0.95rem', padding: '20px', lineHeight: '1.6' }}
                            placeholder="e.g., Hours do not match scheduled shift, missing activity details, unauthorized overtime..."
                            value={rejectionReason}
                            onChange={(e) => {
                              const sanitized = e.target.value
                                .replace(/[^a-zA-Z0-9.,\s]/g, "")
                                .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2300}-\u{23FF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{1F1E0}-\u{1F1FF}]/gu, "");
                              setRejectionReason(sanitized);
                            }}
                            onPaste={e => {
                              e.preventDefault();
                              const text = e.clipboardData.getData("text/plain");
                              const sanitized = text
                                .replace(/[^a-zA-Z0-9.,\s]/g, "")
                                .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2300}-\u{23FF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{1F1E0}-\u{1F1FF}]/gu, "");
                              setRejectionReason(rejectionReason + sanitized);
                            }}
                            autoFocus
                          />
                          <div className="input-hint" style={{ marginTop: '12px', fontSize: '0.8rem' }}>This reason will be visible to the employee so they can correct it</div>
                        </div>
                      </div>
                    </div>
                  )}

                </div>

                {/* Close two-pane row container */}
              </div>

              {/* ACTION FOOTER */}
              <div style={{ zIndex: 10, padding: '16px 28px', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-panel)', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '10px', boxShadow: '0 -10px 20px rgba(0,0,0,0.1)' }}>
                {detailsViewMode === 'timeline' ? (
                  <>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', marginRight: 'auto' }}>Review carefully before approving.</span>
                    <button className="btn-reject-outline" onClick={() => { setRejectionReason(''); setDetailsViewMode('reject'); }} style={{ padding: '7px 18px', borderRadius: '8px', fontWeight: 700, whiteSpace: 'nowrap', fontSize: '0.8rem', flex: 'none' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'; e.currentTarget.style.borderColor = '#ef4444' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--color-urgent)' }}
                    >
                      ✗ Reject
                    </button>
                    <button className="btn-approve" onClick={() => setDetailsViewMode('approve')} style={{ padding: '7px 18px', borderRadius: '8px', fontWeight: 700, whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                      ✓ Approve
                    </button>
                  </>
                ) : detailsViewMode === 'approve' ? (
                  <>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', marginRight: 'auto' }}>Confirm your approval.</span>
                    <button className="btn-improved" onClick={() => setDetailsViewMode('timeline')} style={{ background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-main)', padding: '7px 18px', borderRadius: '8px', fontWeight: 700, whiteSpace: 'nowrap', fontSize: '0.8rem', flex: 'none', transition: 'all 0.2s' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-input)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      Back to Timeline
                    </button>
                    <button className="btn-approve" onClick={handleApproveConfirm} style={{ padding: '7px 18px', borderRadius: '8px', fontWeight: 700, whiteSpace: 'nowrap', fontSize: '0.8rem', background: '#22c55e', color: 'white', border: 'none', boxShadow: '0 4px 15px rgba(34, 197, 94, 0.3)' }}>
                      ✓ Confirm Approve
                    </button>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', marginRight: 'auto' }}>Provide rejection reason.</span>
                    <button className="btn-improved" onClick={() => setDetailsViewMode('timeline')} style={{ background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-main)', padding: '7px 18px', borderRadius: '8px', fontWeight: 700, whiteSpace: 'nowrap', fontSize: '0.8rem', flex: 'none', transition: 'all 0.2s' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-input)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      Back to Timeline
                    </button>
                    <button className="btn-improved btn-reject" onClick={handleRejectSubmit} disabled={!rejectionReason.trim()} style={{ padding: '7px 18px', borderRadius: '8px', fontWeight: 700, whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                      <span>✗</span> Confirm Reject
                    </button>
                  </>
                )}
              </div>
            </div>
          </div >
        );
      })()}

      {/* 4. ASSIGN SCHEDULE MODAL */}
      {
        showAssignModal && (
          <div className="modal-overlay" style={{ zIndex: 99999 }} onClick={() => setShowAssignModal(false)}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px', padding: '0', overflow: 'hidden' }}>
              <div style={{ background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(0,0,0,0) 100%)', padding: '20px 25px', borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', color: 'var(--accent-blue)', border: '1px solid rgba(59, 130, 246, 0.3)' }}>📅</div>
                  <div>
                    <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.2rem', fontWeight: 700, letterSpacing: '0.5px' }}>Assign Schedule</h3>
                    <p style={{ margin: '5px 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Set up a weekly schedule for an employee.</p>
                  </div>
                </div>
              </div>

              <div style={{ padding: '25px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <label className="label-sm" style={{ marginBottom: '8px', display: 'block' }}>Employee *</label>
                  <select
                    className="input-field"
                    style={{ width: '100%', padding: '12px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-main)' }}
                    value={assignForm.employee_id}
                    onChange={(e) => setAssignForm({ ...assignForm, employee_id: e.target.value })}
                  >
                    <option value="">Select Employee</option>
                    {scheduleData.filter((member: any) => member.role_id === 1).map((member: any) => (
                      <option key={member.user_id} value={member.user_id}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label-sm" style={{ marginBottom: '8px', display: 'block' }}>Shift *</label>
                  <select
                    className="input-field"
                    style={{ width: '100%', padding: '12px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-main)' }}
                    value={assignForm.shift_id}
                    onChange={(e) => setAssignForm({ ...assignForm, shift_id: e.target.value })}
                  >
                    <option value="">Select Shift</option>
                    {shiftTemplates.map((shift: any) => (
                      <option key={shift.shift_id} value={shift.shift_id}>
                        {shift.shift_name} ({shift.time_string})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label-sm" style={{ marginBottom: '10px', display: 'block' }}>Days to Assign *</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                    {(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const).map(day => (
                      <label
                        key={day}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '8px',
                          padding: '8px 12px', borderRadius: '8px', cursor: 'pointer',
                          background: assignForm.days[day] ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-input)',
                          border: `1px solid ${assignForm.days[day] ? 'var(--accent-blue)' : 'var(--border-subtle)'}`,
                          transition: 'all 0.2s', fontSize: '0.85rem', fontWeight: 600,
                          color: assignForm.days[day] ? 'var(--accent-blue)' : 'var(--text-muted)',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={assignForm.days[day]}
                          onChange={(e) => setAssignForm({ ...assignForm, days: { ...assignForm.days, [day]: e.target.checked } })}
                          style={{ accentColor: 'var(--accent-blue)', width: '16px', height: '16px' }}
                        />
                        {day.charAt(0).toUpperCase() + day.slice(1, 3)}
                      </label>
                    ))}
                    <label
                      style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '8px 12px', borderRadius: '8px', cursor: 'pointer',
                        background: Object.values(assignForm.days).every(v => v) ? 'rgba(74, 222, 128, 0.15)' : 'var(--bg-input)',
                        border: `1px solid ${Object.values(assignForm.days).every(v => v) ? '#4ade80' : 'var(--border-subtle)'}`,
                        transition: 'all 0.2s', fontSize: '0.85rem', fontWeight: 700,
                        color: Object.values(assignForm.days).every(v => v) ? '#4ade80' : 'var(--text-muted)',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={Object.values(assignForm.days).every(v => v)}
                        onChange={(e) => {
                          const allChecked = e.target.checked;
                          setAssignForm({ ...assignForm, days: { monday: allChecked, tuesday: allChecked, wednesday: allChecked, thursday: allChecked, friday: allChecked, saturday: allChecked, sunday: allChecked } });
                        }}
                        style={{ accentColor: '#4ade80', width: '16px', height: '16px' }}
                      />
                      All
                    </label>
                  </div>
                </div>
              </div>
              <div className="modal-footer" style={{ display: 'flex', gap: '15px', padding: '20px 25px', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-panel)' }}>
                <button className="btn-view" style={{ flex: 1, padding: '12px' }} onClick={() => setShowAssignModal(false)}>Cancel</button>
                <button
                  className="btn-action btn-go"
                  style={{ flex: 1, padding: '12px', fontWeight: 600, border: 'none' }}
                  onClick={() => {
                    if (!assignForm.employee_id) { alert('Please select an employee.'); return; }
                    if (!assignForm.shift_id) { alert('Please select a shift.'); return; }
                    const selectedDays = Object.entries(assignForm.days).filter(([, v]) => v).map(([k]) => k);
                    if (selectedDays.length === 0) { alert('Please select at least one day.'); return; }

                    // Check for conflicts
                    const empData = scheduleData.find((e: any) => e.user_id === assignForm.employee_id);
                    const conflictDays: string[] = [];
                    if (empData) {
                      selectedDays.forEach(day => {
                        if (empData.schedule && empData.schedule[day] !== null) {
                          conflictDays.push(day);
                        }
                      });
                    }

                    setAssignConfirmModal({ show: true, hasConflicts: conflictDays.length > 0, conflictDays });
                  }}
                >Save Schedule</button>
              </div>
            </div>
          </div>
        )
      }

      {/* 5. ASSIGN CONFIRM MODAL */}
      {
        assignConfirmModal.show && (
          <div className="modal-overlay" style={{ zIndex: 999999 }} onClick={() => !assignSaving && setAssignConfirmModal({ show: false, hasConflicts: false, conflictDays: [] })}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px', padding: '0', overflow: 'hidden' }}>
              <div style={{ padding: '30px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: '3.5rem', marginBottom: '15px' }}>
                  {assignConfirmModal.hasConflicts ? '⚠️' : '📋'}
                </div>
                <h3 style={{ color: 'var(--text-main)', marginBottom: '10px', fontSize: '1.2rem', fontWeight: 700 }}>
                  {assignConfirmModal.hasConflicts ? 'Schedule Conflict' : 'Confirm Assignment'}
                </h3>
                {assignConfirmModal.hasConflicts ? (
                  <div>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '15px' }}>
                      This employee already has a schedule on:
                    </p>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '15px' }}>
                      {assignConfirmModal.conflictDays.map(d => (
                        <span key={d} style={{ padding: '4px 12px', borderRadius: '6px', background: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24', fontSize: '0.85rem', fontWeight: 700, textTransform: 'capitalize', border: '1px solid rgba(251,191,36,0.3)' }}>{d}</span>
                      ))}
                    </div>
                    <p style={{ color: '#f87171', fontSize: '0.9rem', fontWeight: 600, padding: '10px', background: 'rgba(248, 113, 113, 0.1)', borderRadius: '8px' }}>
                      Saving will overwrite the existing schedule.
                    </p>
                  </div>
                ) : (
                  <p style={{ color: 'var(--text-muted)' }}>
                    Are you sure you want to assign this schedule?
                  </p>
                )}
              </div>
              <div className="modal-footer" style={{ display: 'flex', gap: '15px', padding: '20px', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-panel)' }}>
                <button className="btn-view" style={{ flex: 1, padding: '12px' }} onClick={() => setAssignConfirmModal({ show: false, hasConflicts: false, conflictDays: [] })} disabled={assignSaving}>Cancel</button>
                <button
                  className="btn-action btn-go"
                  style={{ flex: 1, padding: '12px', fontWeight: 600, border: 'none', background: assignConfirmModal.hasConflicts ? '#f87171' : 'var(--color-go)', color: assignConfirmModal.hasConflicts ? '#fff' : '#000' }}
                  disabled={assignSaving}
                  onClick={async () => {
                    setAssignSaving(true);
                    try {
                      const selectedDays = Object.entries(assignForm.days).filter(([, v]) => v).map(([k]) => k);
                      const shiftId = Number(assignForm.shift_id);

                      const empData = scheduleData.find((e: any) => e.user_id === assignForm.employee_id);
                      const hasExistingSchedule = empData && empData.schedule_id;

                      const payload: Record<string, any> = {
                        user_id: assignForm.employee_id,
                      };

                      if (hasExistingSchedule) {
                        payload.schedule_id = empData.schedule_id;
                      }

                      const allDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
                      allDays.forEach(day => {
                        // If selected, apply new shift.
                        if (selectedDays.includes(day)) {
                          payload[`${day}_shift_id`] = shiftId;
                        } else if (!hasExistingSchedule) {
                          // If creating new and this day isn't selected, it's explicitly null
                          payload[`${day}_shift_id`] = null;
                        }
                        // If updating and not selected, we don't include it in payload so it stays the same
                      });

                      const endpoint = hasExistingSchedule
                        ? '/api/manager/schedule/update'
                        : '/api/manager/schedule/create';

                      const res = await fetch(endpoint, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload),
                      });

                      if (res.ok) {
                        setAssignConfirmModal({ show: false, hasConflicts: false, conflictDays: [] });
                        setShowAssignModal(false);
                        setAssignResultModal({ show: true, success: true, message: 'Schedule assigned successfully!' });
                        fetchScheduleData();
                      } else {
                        const data = await res.json();
                        setAssignConfirmModal({ show: false, hasConflicts: false, conflictDays: [] });
                        setAssignResultModal({ show: true, success: false, message: data.message || 'Failed to assign schedule.' });
                      }
                    } catch (err) {
                      setAssignConfirmModal({ show: false, hasConflicts: false, conflictDays: [] });
                      setAssignResultModal({ show: true, success: false, message: 'Connection error. Please try again.' });
                    } finally {
                      setAssignSaving(false);
                    }
                  }}
                >
                  {assignSaving ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                      Saving...
                    </span>
                  ) : assignConfirmModal.hasConflicts ? 'Overwrite & Save' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* 6. ASSIGN RESULT MODAL */}
      {
        assignResultModal.show && (
          <div className="modal-overlay" style={{ zIndex: 999999 }} onClick={() => setAssignResultModal({ show: false, success: false, message: '' })}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '380px', padding: '0', overflow: 'hidden', textAlign: 'center' }}>
              <div style={{ padding: '40px 20px' }}>
                <div style={{ fontSize: '4rem', marginBottom: '20px' }}>
                  {assignResultModal.success ? '✅' : '❌'}
                </div>
                <h3 style={{ color: 'var(--text-main)', marginBottom: '10px', fontSize: '1.4rem', fontWeight: 700 }}>
                  {assignResultModal.success ? 'Success!' : 'Assignment Failed'}
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>{assignResultModal.message}</p>
              </div>
              <div className="modal-footer" style={{ padding: '20px', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-panel)' }}>
                <button className="btn-action btn-go" style={{ width: '100%', padding: '12px', fontWeight: 600, border: 'none' }} onClick={() => setAssignResultModal({ show: false, success: false, message: '' })}>OK</button>
              </div>
            </div>
          </div>
        )
      }

      <style jsx>{`
        /* Card Actions */
        .btn-approve,
        .btn-reject,
        .btn-reject-outline,
        .btn-view-link {
          padding: 10px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
          font-size: 0.85rem;
          text-transform: uppercase;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
        }

        .btn-approve {
          border: none;
          background: var(--color-go);
          color: white;
        }

        .btn-approve:hover {
          background: #3bc76e;
          transform: translateY(-1px);
        }

        .btn-reject {
          border: none;
          background: var(--color-urgent);
          color: white;
        }

        .btn-reject:hover {
          background: #f65858;
          transform: translateY(-1px);
        }

        .btn-reject-outline {
          border: 1px solid var(--color-urgent);
          background: transparent;
          color: var(--color-urgent);
          flex: 1;
        }

        .btn-reject-outline:hover {
          background: rgba(248, 113, 113, 0.1);
        }

        .btn-view-link {
          border: none;
          background: transparent;
          color: var(--accent-primary);
          text-transform: none;
          font-size: 0.85rem;
          padding: 0;
          margin-top: 15px;
          justify-content: flex-end;
          width: 100%;
        }

        .btn-view-link:hover {
          color: var(--accent-highlight);
          text-decoration: underline;
        }

        .manager-theme.light-mode .btn-reject-outline {
          border-color: var(--color-urgent);
          color: var(--color-urgent);
          background: rgba(239, 68, 68, 0.05);
        }

        .manager-theme.light-mode .btn-reject-outline:hover {
          background: rgba(239, 68, 68, 0.12);
        }

        .manager-theme.light-mode .btn-approve {
          color: #fff;
        }

        /* Improved Modal Styles */
        .modal-overlay-improved {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          animation: fadeIn 0.3s ease;
          padding: 20px;
        }

        .modal-overlay-improved.modal-closing {
          animation: fadeOut 0.3s forwards;
        }

        .modal-card-improved {
          background: var(--bg-main);
          border: 1px solid var(--border-subtle);
          border-radius: 20px;
          box-shadow: 0 25px 80px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05);
          animation: scaleIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          max-width: 650px;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
          position: relative;
        }

        .modal-card-improved.modal-card-closing {
          animation: scaleOut 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .modal-card-improved.rejection-modal {
          max-width: 550px;
        }

        .modal-card-improved.details-modal {
          max-width: 750px;
          background: var(--bg-main);
        }

        .modal-header-improved {
          padding: 30px 30px 20px 30px;
          border-bottom: 1px solid var(--border-subtle);
          text-align: center;
          background: #1a1a1a;
          border-radius: 20px 20px 0 0;
        }

        .light-mode .modal-header-improved {
          background: #f8fafc;
        }

        .modal-icon-wrapper {
          width: 70px;
          height: 70px;
          margin: 0 auto 15px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          font-size: 2rem;
          animation: bounceIn 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes fadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }

        @keyframes scaleOut {
          from { opacity: 1; transform: scale(1) translateY(0); }
          to { opacity: 0; transform: scale(0.95) translateY(10px); }
        }

        @keyframes bounceIn {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          50% {
            transform: scale(1.1);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        .modal-icon-wrapper.approve-icon {
          background: linear-gradient(135deg, rgba(34, 197, 94, 0.2) 0%, rgba(20, 184, 166, 0.1) 100%);
          border: 2px solid rgba(34, 197, 94, 0.3);
          color: #22c55e;
        }

        .modal-icon-wrapper.reject-icon {
          background: linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(220, 38, 38, 0.1) 100%);
          border: 2px solid rgba(239, 68, 68, 0.3);
          color: #ef4444;
        }

        .modal-icon-wrapper.view-icon {
          background: linear-gradient(135deg, rgba(167, 139, 250, 0.2) 0%, rgba(124, 58, 237, 0.1) 100%);
          border: 2px solid rgba(167, 139, 250, 0.3);
          color: var(--accent-primary);
        }

        .modal-title-improved {
          font-size: 1.75rem;
          font-weight: 700;
          color: var(--text-main);
          margin-bottom: 8px;
        }

        .modal-subtitle {
          font-size: 0.95rem;
          color: var(--text-muted);
          font-weight: 500;
        }

        .modal-body-improved {
          padding: 25px 30px;
        }

        .rejection-info {
          background: var(--bg-input);
          border: 1px solid var(--border-subtle);
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 25px;
        }

        .info-item {
          display: flex;
          justify-content: space-between;
          padding: 10px 0;
          border-bottom: 1px solid var(--border-subtle);
        }

        .info-item:last-child {
          border-bottom: none;
        }

        .info-label {
          font-weight: 600;
          color: var(--text-muted);
          font-size: 0.9rem;
        }

        .info-value {
          font-weight: 700;
          color: var(--text-main);
          font-size: 0.95rem;
        }

        .form-group-improved {
          margin-bottom: 20px;
        }

        .label-improved {
          display: block;
          font-weight: 600;
          color: var(--text-main);
          margin-bottom: 10px;
          font-size: 0.95rem;
        }

        .textarea-improved {
          width: 100%;
          padding: 15px;
          border-radius: 12px;
          border: 2px solid var(--border-subtle);
          background: var(--bg-input);
          color: var(--text-main);
          font-family: inherit;
          font-size: 0.95rem;
          resize: vertical;
          transition: all 0.3s ease;
        }

        .textarea-improved:focus {
          outline: none;
          border-color: var(--accent-primary);
          box-shadow: 0 0 0 3px rgba(167, 139, 250, 0.1);
        }

        .input-hint {
          margin-top: 8px;
          font-size: 0.85rem;
          color: var(--text-muted);
          font-style: italic;
        }

        .details-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 15px;
          margin-bottom: 25px;
        }

        .detail-card-improved {
          background: var(--bg-input);
          border: 1px solid var(--border-subtle);
          border-radius: 12px;
          padding: 15px;
          display: flex;
          align-items: center;
          gap: 12px;
          transition: all 0.3s ease;
        }

        .detail-card-improved:hover {
          border-color: var(--accent-primary);
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(167, 139, 250, 0.15);
        }

        .detail-icon {
          font-size: 1.5rem;
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(167, 139, 250, 0.1);
          border-radius: 8px;
          flex-shrink: 0;
        }

        .detail-content {
          flex: 1;
          min-width: 0;
        }

        .detail-label-improved {
          font-size: 0.75rem;
          color: var(--text-muted);
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
          white-space: normal;
          overflow: visible;
          text-overflow: unset;
        }

        .detail-value-improved {
          font-size: 1rem;
          color: var(--text-main);
          font-weight: 700;
          white-space: normal;
          overflow: visible;
          text-overflow: unset;
        }

        .activity-breakdown {
          margin-top: 25px;
        }

        .breakdown-title {
          font-size: 1.2rem;
          font-weight: 700;
          color: var(--text-main);
          margin-bottom: 15px;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .breakdown-title:before {
          content: '';
          width: 4px;
          height: 24px;
          background: var(--accent-primary);
          border-radius: 2px;
        }

        .activity-list-improved {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .activity-item-improved {
          background: var(--bg-input);
          border: 1px solid var(--border-subtle);
          border-left: 4px solid var(--accent-primary);
          border-radius: 10px;
          padding: 15px;
          transition: all 0.3s ease;
        }

        .activity-item-improved:hover {
          border-color: var(--accent-primary);
          box-shadow: 0 4px 15px rgba(167, 139, 250, 0.15);
          transform: translateX(5px);
        }

        .activity-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }

        .activity-name {
          font-weight: 700;
          color: var(--text-main);
          font-size: 1rem;
        }

        .badge-billable {
          padding: 4px 10px;
          background: rgba(34, 197, 94, 0.15);
          color: #22c55e;
          border-radius: 6px;
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.5px;
        }

        .activity-time {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .time-badge {
          padding: 4px 10px;
          background: rgba(167, 139, 250, 0.1);
          border: 1px solid rgba(167, 139, 250, 0.2);
          border-radius: 6px;
          font-size: 0.85rem;
          color: var(--text-main);
          font-weight: 600;
          font-family: var(--font-mono);
        }

        .time-arrow {
          color: var(--text-muted);
          font-weight: 700;
        }

        .duration-badge {
          padding: 4px 12px;
          background: linear-gradient(135deg, rgba(167, 139, 250, 0.2) 0%, rgba(124, 58, 237, 0.1) 100%);
          border: 1px solid var(--accent-primary);
          border-radius: 20px;
          font-size: 0.85rem;
          color: var(--accent-primary);
          font-weight: 700;
          margin-left: auto;
        }

        .modal-actions-improved {
          padding: 20px 30px;
          border-top: 1px solid var(--border-subtle);
          display: flex;
          gap: 12px;
          justify-content: flex-end;
          background: rgba(255, 255, 255, 0.02);
        }

        .btn-improved {
          padding: 12px 24px;
          border-radius: 10px;
          border: none;
          font-weight: 700;
          font-size: 0.95rem;
          cursor: pointer;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          gap: 8px;
          position: relative;
          overflow: hidden;
        }

        .btn-improved:before {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          width: 0;
          height: 0;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.1);
          transform: translate(-50%, -50%);
          transition: width 0.6s, height 0.6s;
        }

        .btn-improved:hover:before {
          width: 300px;
          height: 300px;
        }

        .btn-improved span {
          position: relative;
          z-index: 1;
        }

        .btn-improved:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
        }

        .btn-improved:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }

        .btn-improved:disabled:hover {
          transform: none;
          box-shadow: none;
        }

        .btn-ghost {
          background: transparent;
          color: var(--text-muted);
          border: 2px solid var(--border-subtle);
        }

        .btn-ghost:hover {
          background: rgba(255, 255, 255, 0.05);
          border-color: var(--text-main);
          color: var(--text-main);
        }

        .btn-reject {
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
          color: white;
        }

        .btn-reject:hover {
          background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
        }

        .btn-primary {
          background: linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%);
          color: white;
        }

        .btn-primary:hover {
          background: linear-gradient(135deg, var(--accent-secondary) 0%, var(--accent-primary) 100%);
        }

        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes cardSlideIn {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}