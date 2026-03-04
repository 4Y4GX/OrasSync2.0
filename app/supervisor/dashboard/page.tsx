'use client';

import { useState, useEffect, useRef } from 'react';
import '../../styles/dashboard.css';
import '../../styles/supervisor.css';
import AutoLogout from '@/app/components/AutoLogout';
import SupervisorScheduleManagement from '@/app/components/SupervisorScheduleManagement';
import TeamStatusMonitor from '@/app/components/TeamStatusMonitor';
import { Eye, EyeOff, CheckCircle } from 'lucide-react';
import { passwordChecks, removeEmojis, STRONG_PASS_REGEX } from "@/lib/zeroTrustValidation";

function formatHoursToHHMM(hours: number | string) {
  if (!hours) return "00:00";
  const h = typeof hours === 'number' ? hours : parseFloat(hours as string);
  const totalMinutes = Math.round(h * 60);
  const hh = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
  const mm = (totalMinutes % 60).toString().padStart(2, '0');
  return `${hh}:${mm}`;
}

export default function SupervisorDashboard() {
  const [activeSection, setActiveSection] = useState('team');
  const [lightMode, setLightMode] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // --- Clock Settings ---
  const [hasClockedIn, setHasClockedIn] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const [sessionStart, setSessionStart] = useState<number | null>(null);
  const [sessionDuration, setSessionDuration] = useState('00:00:00');
  const [activeSessionNotice, setActiveSessionNotice] = useState(false);
  const [logoutModal, setLogoutModal] = useState(false);
  const [showClockOutModal, setShowClockOutModal] = useState(false);

  // UPDATED: Added new stat fields for Monthly data and Compliance array
  const [stats, setStats] = useState({
    totalMembers: 0,
    currentlyWorking: 0,
    totalHours: '0.0',
    offline: 0,
    graphData: [] as { day: string; hours: string; percentage: number }[],
    complianceData: [] as any[],
    teamPerformance: {
      weeklyTotal: '0.0',
      monthlyTotal: '0.0',
      targetWeeklyHours: 0,
      avgPerPerson: '0.0',
      productivity: '0%'
    }
  });

  const [isProcessing, setIsProcessing] = useState<Record<string, 'approve' | 'reject' | null>>({});
  const [approvals, setApprovals] = useState<any[]>([]);
  const [managerRejected, setManagerRejected] = useState<any[]>([]);
  const [loadingApprovals, setLoadingApprovals] = useState(false);
  const [approvalTab, setApprovalTab] = useState<'pending' | 'manager_rejected'>('pending');
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [isDetailsClosing, setIsDetailsClosing] = useState(false);
  const [selectedTimesheet, setSelectedTimesheet] = useState<any>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [weekOffset, setWeekOffset] = useState(0);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  const closeDetailsModal = () => {
    setIsDetailsClosing(true);
    setTimeout(() => {
      setShowDetailsModal(false);
      setIsDetailsClosing(false);
    }, 280);
  };



  // Handle Tick
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString("en-US", { hour12: true, hour: "2-digit", minute: "2-digit" }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Check clock status on load
  useEffect(() => {
    const initClock = async () => {
      try {
        const statusRes = await fetch('/api/supervisor/clock/in');
        if (statusRes.ok) {
          const data = await statusRes.json();
          if (data.isClockedIn) {
            setHasClockedIn(true);
            setSessionStart(new Date(data.startTime).getTime());
          }
        }
      } catch (e) {
        console.error("Failed fetching clock status", e);
      }
    };
    initClock();
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (hasClockedIn && sessionStart) {
      interval = setInterval(() => {
        const diff = Date.now() - sessionStart;
        const hrs = Math.floor(diff / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((diff % (1000 * 60)) / 1000);
        setSessionDuration(
          `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
        );
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [hasClockedIn, sessionStart]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadApprovals = async () => {
    setLoadingApprovals(true);
    try {
      const [pendingRes, rejectedRes] = await Promise.all([
        fetch('/api/supervisor/approvals/list?filter=pending'),
        fetch('/api/supervisor/approvals/list?filter=manager_rejected'),
      ]);
      if (pendingRes.ok) setApprovals(await pendingRes.json());
      if (rejectedRes.ok) setManagerRejected(await rejectedRes.json());
    } catch (err) {
      console.error("Failed to load approvals", err);
    } finally {
      setLoadingApprovals(false);
    }
  };

  const handleApprovalAction = async (log_ids: number[], action: 'APPROVE' | 'REJECT', reason?: string) => {
    const processKey = log_ids.join(',');
    setIsProcessing(prev => ({ ...prev, [processKey]: action.toLowerCase() as 'approve' | 'reject' }));
    try {
      const res = await fetch('/api/supervisor/approvals/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ log_ids, action, rejection_reason: reason })
      });
      if (res.ok) {
        await Promise.all([loadApprovals(), loadStats()]);
      }
    } catch (err) {
      console.error("Failed to process approval", err);
    } finally {
      setIsProcessing(prev => ({ ...prev, [processKey]: null }));
    }
  };

  const openRejectModal = (timesheet: any) => {
    setSelectedTimesheet(timesheet);
    setRejectionReason('');
    setShowRejectionModal(true);
  };

  const handleRejectSubmit = () => {
    if (!rejectionReason.trim()) {
      alert('Rejection reason is required!');
      return;
    }
    handleApprovalAction(selectedTimesheet.log_ids, 'REJECT', rejectionReason);
    setShowRejectionModal(false);
    setSelectedTimesheet(null);
    setRejectionReason('');
  };

  const openDetailsModal = (timesheet: any) => {
    setSelectedTimesheet(timesheet);
    setShowDetailsModal(true);
  };

  const handleLogout = async () => {
    if (hasClockedIn) {
      alert("You are currently clocked in. Please clock out before logging out to ensure your time is recorded correctly.");
      return;
    }
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (res.ok) {
        window.location.href = '/login';
      }
    } catch (err) {
      console.error('Logout failed', err);
    }
  };

  const [isLoading, setIsLoading] = useState(false);

  const handleClockIn = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/supervisor/clock/in', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setSessionStart(new Date(data.startTime).getTime());
        setHasClockedIn(true);
      }
      else { alert(`Failed: ${data.message}`); }
    } catch (e) { alert("Connection Error."); } finally { setIsLoading(false); }
  };

  const handleClockOut = async () => {
    setShowClockOutModal(false);
    try {
      const res = await fetch('/api/supervisor/clock/out', { method: 'POST' });
      if (res.ok) {
        setHasClockedIn(false);
        setSessionStart(null);
        setSessionDuration('00:00:00');
        window.location.reload();
      }
      else { alert("Failed to end session."); }
    } catch (e) { alert("Connection error."); }
  };

  const handleNavClick = (section: string) => {
    if (!hasClockedIn) return;
    setActiveSection(section);
  };

  const getDateString = () => {
    const options: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return new Date().toLocaleDateString('en-US', options);
  };

  const [userProfile, setUserProfile] = useState({
    name: 'Loading...',
    role: ' Supervisor',
    initials: '...',
    email: ''
  });

  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch('/api/user/me')
      .then(res => res.json())
      .then(data => {
        if (data.name) setUserProfile(data);
      })
      .catch(err => console.error("Failed to load profile", err));
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("orasync-theme");
      const isLight = saved === "light";
      setLightMode(isLight);
      document.body.classList.toggle("light-mode", isLight);
    } catch { }
  }, []);

  // --- Change Password State & Helpers ---
  const [showCpModal, setShowCpModal] = useState(false);
  const [cpStep, setCpStep] = useState<1 | 2 | 3 | 4>(1);
  const [cpLoading, setCpLoading] = useState(false);
  const [cpError, setCpError] = useState("");

  const [cpOtp, setCpOtp] = useState<string[]>(Array(6).fill(""));
  const [cpOtpSent, setCpOtpSent] = useState(false);
  const [cpCountdown, setCpCountdown] = useState(0);
  const cpOtpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [cpQuestion, setCpQuestion] = useState("");
  const [cpQuestionId, setCpQuestionId] = useState<number | null>(null);
  const [cpAnswer, setCpAnswer] = useState("");

  const [cpNewPassword, setCpNewPassword] = useState("");
  const [cpConfirmPassword, setCpConfirmPassword] = useState("");
  const [cpShowPass1, setCpShowPass1] = useState(false);
  const [cpShowPass2, setCpShowPass2] = useState(false);
  const [cpTouchedPw, setCpTouchedPw] = useState(false);
  const [cpTouchedConfirm, setCpTouchedConfirm] = useState(false);
  const [cpCapsOn1, setCpCapsOn1] = useState(false);
  const [cpCapsOn2, setCpCapsOn2] = useState(false);

  useEffect(() => {
    if (cpCountdown > 0) {
      const timer = setTimeout(() => setCpCountdown(cpCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cpCountdown]);

  const resetCpState = () => {
    setCpStep(1);
    setCpError("");
    setCpLoading(false);
    setCpOtp(Array(6).fill(""));
    setCpOtpSent(false);
    setCpAnswer("");
    setCpNewPassword("");
    setCpConfirmPassword("");
    setCpTouchedPw(false);
    setCpTouchedConfirm(false);
  };

  const handleSendOtp = async () => {
    if (!userProfile.email) return;
    setCpError("");
    setCpLoading(true);
    try {
      const res = await fetch("/api/auth/otp/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: userProfile.email })
      });
      const err = await res.json().catch(() => ({}));

      if (res.status === 429 || err?.message === "OTP_LIMIT_REACHED") {
        setCpError("YOU'VE REACHED THE DAILY OTP LIMIT.");
      } else if (res.ok || res.status === 200) {
        setCpOtpSent(true);
        setCpCountdown(90);
        setTimeout(() => cpOtpRefs.current[0]?.focus(), 100);
      } else {
        setCpError(err.message || "Failed to send OTP");
      }
    } catch {
      setCpError("Failed to send OTP");
    } finally {
      setCpLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = cpOtp.join("");
    if (code.length < 6) return;
    setCpError("");
    setCpLoading(true);
    try {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userProfile.email, otp: code, flow: "recovery" })
      });
      if (res.ok) {
        setCpError("");
        const qRes = await fetch("/api/supervisor/settings/security-question");
        if (qRes.ok) {
          const qData = await qRes.json();
          setCpQuestion(qData.question_text);
          setCpQuestionId(qData.question_id);
          setCpStep(2);
        } else {
          setCpError("Failed to fetch security question");
        }
      } else {
        const err = await res.json().catch(() => ({}));
        setCpError(err.message || "OTP Verification Failed");
      }
    } catch {
      setCpError("OTP Verification Failed");
    } finally {
      setCpLoading(false);
    }
  };

  const handleVerifyQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setCpError("");
    setCpLoading(true);
    try {
      const res = await fetch("/api/supervisor/settings/security-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: cpQuestionId, answer: removeEmojis(cpAnswer) })
      });
      if (res.ok) {
        setCpStep(3);
      } else {
        const err = await res.json().catch(() => ({}));
        setCpError(err.message || "Incorrect Answer");
        if (err.lockedOut) {
          alert("Account locked due to too many failed attempts.");
          handleLogout();
        }
      }
    } catch {
      setCpError("Verification Failed");
    } finally {
      setCpLoading(false);
    }
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCpTouchedPw(true);
    setCpTouchedConfirm(true);
    if (cpNewPassword !== cpConfirmPassword || !STRONG_PASS_REGEX.test(removeEmojis(cpNewPassword))) return;
    setCpError("");
    setCpLoading(true);
    try {
      const res = await fetch("/api/supervisor/settings/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_password: removeEmojis(cpNewPassword) })
      });
      if (res.ok) {
        setCpStep(4);
        setTimeout(() => {
          handleLogout();
        }, 2000);
      } else {
        const err = await res.json().catch(() => ({}));
        setCpError(err.message || "Failed to update password");
      }
    } catch {
      setCpError("Failed to update password");
    } finally {
      setCpLoading(false);
    }
  };

  const clampPasswordInput = (raw: string) => removeEmojis(raw).slice(0, 20);
  const syncCaps = (e: React.KeyboardEvent<HTMLInputElement>, which: 1 | 2) => {
    const on = e.getModifierState?.("CapsLock") ?? false;
    if (which === 1) setCpCapsOn1(on); else setCpCapsOn2(on);
  };

  const cpChecks = passwordChecks(cpNewPassword);


  useEffect(() => {
    document.body.style.backgroundColor = lightMode ? '#eef2f6' : '#121212';
    document.body.style.overflow = 'hidden';
    document.body.style.margin = '0';
    return () => {
      document.body.style.backgroundColor = '';
      document.body.style.overflow = '';
    };
  }, [lightMode]);

  const toggleTheme = () => {
    const next = !lightMode;
    setLightMode(next);
    document.body.classList.toggle("light-mode", next);
    try {
      localStorage.setItem("orasync-theme", next ? "light" : "dark");
    } catch { }
  };

  const loadStats = async (offset: number = 0) => {
    try {
      const res = await fetch(`/api/supervisor/stats?weekOffset=${offset}`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      } else {
        console.error('Failed to load stats:', res.status);
      }
    } catch (err) {
      console.error("Failed to load supervisor stats", err);
    }
  };

  useEffect(() => {
    // Only start polling once the user has checked in (or we verified they are clocked in)
    if (hasClockedIn) {
      loadStats(weekOffset);
      loadApprovals();

      const interval = setInterval(() => {
        loadStats(weekOffset);
        loadApprovals();
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [weekOffset, hasClockedIn]);

  const handleRefreshNow = () => {
    loadStats(weekOffset);
    loadApprovals();
  };

  return (
    <>
      <div className={`split-layout supervisor-theme ${lightMode ? 'light-mode' : ''}`}>
        <div className="tech-mesh" />
        <aside className="info-panel">
          <div className="bg-decor bg-sq-outline sq-top-left" />
          <div className="bg-decor bg-sq-outline sq-mid-left" />
          <div className="bg-decor bg-sq-solid sq-bot-left" />

          <div className="brand-logo">ORASync</div>

          <ul className="nav-links">
            <li className={`nav-item ${activeSection === 'team' ? 'active' : ''} ${!hasClockedIn ? 'locked' : ''}`} onClick={() => handleNavClick('team')}>
              Team Overview
            </li>
            <li className={`nav-item ${activeSection === 'approval' ? 'active' : ''} ${!hasClockedIn ? 'locked' : ''}`} onClick={() => handleNavClick('approval')}>
              Timesheet Approval
            </li>
            <li className={`nav-item ${activeSection === 'schedule' ? 'active' : ''} ${!hasClockedIn ? 'locked' : ''}`} onClick={() => handleNavClick('schedule')}>
              Team Schedule
            </li>
            <li className={`nav-item ${activeSection === 'analytics' ? 'active' : ''} ${!hasClockedIn ? 'locked' : ''}`} onClick={() => handleNavClick('analytics')}>
              Team Analytics
            </li>
          </ul>

          <div className="widget-box">
            <div className="label-sm">Pending Approvals</div>
            <div className="status-badge warn">
              <span className="dot" />
              <span style={{ marginLeft: 8 }}>{approvals.length} PENDING</span>
            </div>
          </div>

          <div
            className="profile-card"
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            ref={profileMenuRef}
          >
            <div className="streak-badge">👔 {userProfile.role.toUpperCase()}</div>
            <div className="avatar">{userProfile.initials}</div>
            <div className="profile-info">
              <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-main)' }}>{userProfile.name}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{userProfile.role}</div>
            </div>

            {showProfileMenu && (
              <div className="profile-dropdown">
                <button className="dropdown-item" onClick={(e) => { e.stopPropagation(); setShowSettingsModal(true); setShowProfileMenu(false); }}>
                  <span>⚙️</span> Settings
                </button>
                <button className="dropdown-item" onClick={(e) => { e.stopPropagation(); setLogoutModal(true); setShowProfileMenu(false); }}>
                  <span>🚪</span> Logout
                </button>
              </div>
            )}
          </div>
        </aside>

        <main className="workspace-panel">
          <AutoLogout />


          <div className="content-area">
            {/* LANDING SCREEN */}
            {!hasClockedIn && (
              <div id="layout-initial" className="fade-in" style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div className="landing-card">
                  <div className="hero-clock-label">Supervisor Control</div>
                  <div className="hero-clock-row">
                    {currentTime.split(" ")[0] || '00:00:00'}
                    <span className="clock-ampm">
                      {currentTime.split(" ")[1] || ''}
                    </span>
                  </div>
                  <div className="hero-date-display">
                    {getDateString()}
                  </div>
                  <p style={{ color: 'var(--text-muted)', marginBottom: '30px', textAlign: 'center' }}>Supervisor access enabled. Click below to begin session.</p>

                  <button className="btn-clock-in-large" onClick={handleClockIn} disabled={isLoading}>
                    {isLoading ? "CLOCKING IN..." : "CLOCK IN"}
                  </button>
                </div>
              </div>
            )}

            {/* ACTIVE VIEW */}
            {hasClockedIn && activeSection === 'team' && (
              <div className="section-view fade-in">
                <div className="section-animate">
                  <div className="hud-row" style={{ marginBottom: '20px', display: 'flex', gap: '20px' }}>
                    <div className="hud-card" style={{ flex: 1 }}>
                      <div className="hud-bg-icon">⏱</div>
                      <div className="hud-label">CURRENT TIME</div>
                      <div className="hud-val" style={{ color: 'var(--accent-cyan)' }}>{currentTime}</div>
                    </div>
                    <div className="hud-card" style={{ flex: 1 }}>
                      <div className="hud-bg-icon">⚡</div>
                      <div className="hud-label">SESSION DURATION</div>
                      <div className="hud-val">{sessionDuration.substring(0, 5)}</div>
                    </div>
                    <div className="hud-card" style={{ flex: 1 }}>
                      <div className="hud-bg-icon">🔥</div>
                      <div className="hud-label">TOTAL HOURS TODAY</div>
                      <div className="hud-val warn">{stats.totalHours}</div>
                      <div className="status-badge warn" style={{ marginTop: 5, alignSelf: 'flex-start', fontSize: '0.7rem' }}>
                        Team Hours
                      </div>
                    </div>
                  </div>
                  <div className="workspace-grid">
                    <div className="logs-panel">
                      <TeamStatusMonitor />
                    </div>

                    <div className="controls-panel" style={{ display: 'flex', flexDirection: 'column' }}>
                      <div className="glass-card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <div className="section-title" style={{ padding: 0, background: 'transparent', margin: '0 0 20px 0' }}>Action Panel</div>
                        <p style={{ color: "var(--text-muted)", marginBottom: 16, fontSize: "0.9rem" }}>
                          Supervisor session active. Manage team status below.
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0', marginBottom: 20, borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Team Members</span>
                            <span style={{ fontSize: '1rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--text-main)' }}>{stats.totalMembers}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Currently Working</span>
                            <span style={{ fontSize: '1rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#22c55e' }}>{stats.currentlyWorking}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 14px' }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Offline</span>
                            <span style={{ fontSize: '1rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{stats.offline}</span>
                          </div>
                        </div>

                        <div style={{ marginTop: "auto" }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <div className="label-sm" style={{ margin: 0 }}>SESSION STATUS</div>
                            {sessionStart && (
                              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                                Since {new Date(sessionStart).toLocaleTimeString("en-US", { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hour12: true })}
                              </div>
                            )}
                          </div>
                          <div className="session-status-box" style={{ marginBottom: 10 }}>
                            CLOCKED IN
                          </div>

                          <button
                            className="btn-ap-danger"
                            onClick={() => setShowClockOutModal(true)}
                          >
                            CLOCK OUT
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {hasClockedIn && activeSection === 'approval' && (
              <div className="section-view active fade-in" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <div className="section-animate" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <div className="section-title" style={{ borderBottom: 'none', marginBottom: 0, paddingBottom: 0 }}>
                      <span>Timesheet Approvals</span>
                    </div>
                    <div className="detail-log-tabs" style={{ marginBottom: 20 }}>
                      {([
                        { key: 'pending' as const, label: 'Pending', color: '#eab308', count: approvals.length },
                        { key: 'manager_rejected' as const, label: 'Rejected by Manager', color: '#ef4444', count: managerRejected.length },
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
                      {loadingApprovals && approvals.length === 0 && managerRejected.length === 0 ? (
                        <>
                          {Array(4).fill(0).map((_, i) => (
                            <div key={`approval-skeleton-${i}`} className="approval-card skeleton">
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
                              </div>
                            </div>
                          ))}
                        </>
                      ) : approvalTab === 'pending' ? (
                        <>
                          {approvals.length === 0 ? (
                            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                              <div style={{ fontSize: '1.3rem', marginBottom: 6, opacity: 0.4 }}>⏳</div>
                              No pending approvals found.
                            </div>
                          ) : approvals.map((timesheet, i) => (
                            <div key={i} className="approval-card" onClick={() => openDetailsModal(timesheet)} style={{ cursor: 'pointer' }}>
                              <div className="approval-header">
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", width: "100%" }}>
                                  <div>
                                    <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{timesheet.employee}</div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Date: {timesheet.date}</div>
                                  </div>
                                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "5px" }}>
                                    <div className="approval-badge pending">PENDING</div>
                                    <button
                                      className="btn-view-link"
                                      onClick={() => openDetailsModal(timesheet)}
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
                                  <span className="stat-value">{formatHoursToHHMM(timesheet.hours)}</span>
                                </div>
                                <div className="stat-item">
                                  <span className="stat-label">Activities</span>
                                  <span className="stat-value">{timesheet.activities}</span>
                                </div>
                              </div>
                              <div className="approval-actions" style={{ marginTop: "15px" }}>
                                <button
                                  className="btn-reject-outline"
                                  onClick={(e) => { e.stopPropagation(); openRejectModal(timesheet); }}
                                  disabled={!!isProcessing[timesheet.log_ids.join(',')]}
                                  style={{ opacity: isProcessing[timesheet.log_ids.join(',')] ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                                >
                                  {isProcessing[timesheet.log_ids.join(',')] === 'reject' ? <span className="spinner-small" style={{ borderColor: 'rgba(239,68,68,0.3)', borderTopColor: '#ef4444' }} /> : '✗'} Reject
                                </button>
                                <button
                                  className="btn-approve"
                                  onClick={(e) => { e.stopPropagation(); handleApprovalAction(timesheet.log_ids, 'APPROVE'); }}
                                  disabled={!!isProcessing[timesheet.log_ids.join(',')]}
                                  style={{ opacity: isProcessing[timesheet.log_ids.join(',')] ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', background: isProcessing[timesheet.log_ids.join(',')] === 'approve' ? '#16a34a' : '' }}
                                >
                                  {isProcessing[timesheet.log_ids.join(',')] === 'approve' ? <span className="spinner-small" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#ffffff' }} /> : '✓'} Approve
                                </button>
                              </div>
                            </div>
                          ))}
                        </>
                      ) : (
                        <>
                          {managerRejected.length === 0 ? (
                            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                              <div style={{ fontSize: '1.3rem', marginBottom: 6, opacity: 0.4 }}>✅</div>
                              No manager-rejected timesheets found.
                            </div>
                          ) : managerRejected.map((timesheet, i) => (
                            <div key={i} className="approval-card" onClick={() => openDetailsModal(timesheet)} style={{ cursor: 'pointer', borderColor: 'rgba(239, 68, 68, 0.3)' }}>
                              <div className="approval-header">
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", width: "100%" }}>
                                  <div>
                                    <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{timesheet.employee}</div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Date: {timesheet.date}</div>
                                  </div>
                                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "5px" }}>
                                    <div className="approval-badge rejected">REJECTED</div>
                                    <button
                                      className="btn-view-link"
                                      onClick={() => openDetailsModal(timesheet)}
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
                              {timesheet.rejection_reason && (
                                <div style={{
                                  padding: '8px 12px',
                                  borderRadius: 6,
                                  background: 'rgba(239, 68, 68, 0.08)',
                                  border: '1px solid rgba(239, 68, 68, 0.2)',
                                  fontSize: '0.85rem',
                                  color: '#ef4444',
                                  marginTop: 8,
                                }}>
                                  <span style={{ fontWeight: 600 }}>Manager's Reason:</span> {timesheet.rejection_reason}
                                </div>
                              )}
                              <div className="approval-stats">
                                <div className="stat-item">
                                  <span className="stat-label">Total Time</span>
                                  <span className="stat-value">{formatHoursToHHMM(timesheet.hours)}</span>
                                </div>
                                <div className="stat-item">
                                  <span className="stat-label">Activities</span>
                                  <span className="stat-value">{timesheet.activities}</span>
                                </div>
                              </div>
                              <div className="approval-actions" style={{ marginTop: "15px" }}>
                                <button
                                  className="btn-reject-outline"
                                  onClick={(e) => { e.stopPropagation(); openRejectModal(timesheet); }}
                                  disabled={!!isProcessing[timesheet.log_ids.join(',')]}
                                  style={{ opacity: isProcessing[timesheet.log_ids.join(',')] ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                                >
                                  {isProcessing[timesheet.log_ids.join(',')] === 'reject' ? <span className="spinner-small" style={{ borderColor: 'rgba(239,68,68,0.3)', borderTopColor: '#ef4444' }} /> : '✗'} Modify Rejection
                                </button>
                                <button
                                  className="btn-approve"
                                  onClick={(e) => { e.stopPropagation(); handleApprovalAction(timesheet.log_ids, 'APPROVE'); }}
                                  disabled={!!isProcessing[timesheet.log_ids.join(',')]}
                                  style={{ opacity: isProcessing[timesheet.log_ids.join(',')] ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', background: isProcessing[timesheet.log_ids.join(',')] === 'approve' ? '#16a34a' : '' }}
                                >
                                  {isProcessing[timesheet.log_ids.join(',')] === 'approve' ? <span className="spinner-small" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#ffffff' }} /> : '✓'} Force Approve
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
            )}

            {hasClockedIn && activeSection === 'schedule' && (
              <div className="section-view active fade-in">
                <div className="section-animate">
                  <SupervisorScheduleManagement />
                </div>
              </div>
            )}

            {/* --- COMPLETELY REBUILT ANALYTICS SECTION --- */}
            {hasClockedIn && activeSection === 'analytics' && (
              <div className="section-view active fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div className="section-animate">

                  {/* Top Analytics Panels */}
                  <div className="analytics-top-row">
                    <div className="analytics-card">
                      <div className="analytics-icon">📊</div>
                      <div className="analytics-content">
                        <div className="analytics-label">THIS WEEK</div>
                        <div className="analytics-value accent-cyan">
                          {stats.teamPerformance?.weeklyTotal || '0.0'} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>hrs</span>
                        </div>
                        <div className="analytics-sub">Target: {stats.teamPerformance?.targetWeeklyHours || '0'} hrs</div>
                      </div>
                    </div>
                    <div className="analytics-card">
                      <div className="analytics-icon">📅</div>
                      <div className="analytics-content">
                        <div className="analytics-label">THIS MONTH</div>
                        <div className="analytics-value">
                          {stats.teamPerformance?.monthlyTotal || '0.0'} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>hrs</span>
                        </div>
                        <div className="analytics-sub">Total Monthly Hours</div>
                      </div>
                    </div>
                    <div className="analytics-card">
                      <div className="analytics-icon">📈</div>
                      <div className="analytics-content">
                        <div className="analytics-label">WEEKLY ACTIVITY %</div>
                        <div className="analytics-value success">{stats.teamPerformance?.productivity || '0%'}</div>
                        <div className="analytics-sub">Of Total Expected Capacity</div>
                      </div>
                    </div>
                  </div>

                  {/* 2-Column Layout for Graph & Compliance */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '1.5rem', flex: 1 }}>

                    {/* Team Performance Graph */}
                    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
                      <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ display: 'flex', alignItems: 'center' }}>
                          Team Performance Overview
                          {(() => {
                            const curr = new Date();
                            curr.setDate(curr.getDate() + (weekOffset * 7));
                            const firstDay = new Date(curr);
                            firstDay.setDate(curr.getDate() - curr.getDay() + (curr.getDay() === 0 ? -6 : 1));
                            const lastDay = new Date(firstDay);
                            lastDay.setDate(firstDay.getDate() + 6);

                            const startOfYear = new Date(firstDay.getFullYear(), 0, 1);
                            const days = Math.floor((firstDay.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
                            const weekNumber = Math.ceil((firstDay.getDay() + 1 + days) / 7);

                            const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
                            return (
                              <span className="week-badge">
                                📅 <span style={{ opacity: 0.9, fontWeight: 600 }}>{firstDay.toLocaleDateString('en-US', options)} - {lastDay.toLocaleDateString('en-US', options)}</span>
                              </span>
                            );
                          })()}
                        </span>
                        <div style={{ display: 'flex', gap: '5px' }}>
                          <button className="week-nav-btn" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => setWeekOffset(weekOffset - 1)} title="Previous Week">← Prev</button>
                          <button className="week-nav-btn" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => setWeekOffset(0)} disabled={weekOffset === 0} title="Current Week">Current</button>
                          <button className="week-nav-btn" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => setWeekOffset(weekOffset + 1)} disabled={weekOffset >= 0} title="Next Week">Next →</button>
                        </div>
                      </div>
                      <div className="graph-container" style={{ flex: 1, minHeight: '300px' }}>
                        {!stats.graphData || stats.graphData.length === 0 ? (
                          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>Loading graph data...</div>
                        ) : stats.graphData.map((day: any, i: number) => (
                          <div key={`${day.day}-${i}`} className="bar-group">
                            <div
                              className="bar bar-actual supervisor-bar"
                              style={{
                                height: `${Math.max(day.percentage, 5)}%`,
                                minHeight: day.percentage > 0 ? '10px' : '0px'
                              }}
                              title={`${day.day}: ${day.hours} hours (${day.percentage.toFixed(1)}%)`}
                            >
                              {Number(day.hours) > 0 && (
                                <div style={{
                                  position: 'absolute', top: '-25px', left: '50%', transform: 'translateX(-50%)',
                                  fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-primary)', whiteSpace: 'nowrap'
                                }}>
                                  {day.hours}h
                                </div>
                              )}
                            </div>
                            <div className="bar-label">{day.day}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Team Member Compliance Table */}
                    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
                      <div className="section-title">
                        <span>Team Member Compliance</span>
                      </div>
                      <div style={{
                        padding: '14px 20px', marginBottom: '20px', background: 'rgba(167, 139, 250, 0.08)',
                        border: '1px solid rgba(167, 139, 250, 0.2)', borderRadius: '14px', color: 'var(--text-muted)', fontSize: '0.85rem',
                        display: 'flex', alignItems: 'center', gap: '10px'
                      }}>
                        <span style={{ fontSize: '1.1rem' }}>📋</span>
                        <span><strong style={{ color: 'var(--text-main)' }}>Daily Limit:</strong> 8 hours per day &nbsp;|&nbsp; <strong style={{ color: 'var(--text-main)' }}>Weekly Limit:</strong> 40 hours per week</span>
                      </div>

                      {stats.complianceData && stats.complianceData.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', paddingRight: '5px' }}>
                          {/* Table Header */}
                          <div style={{
                            display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)',
                            padding: '10px 15px', fontSize: '0.65rem', fontWeight: 700, gap: '5px',
                            color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px'
                          }}>
                            <span>Employee</span>
                            <span>Today</span>
                            <span>Status</span>
                            <span>Weekly</span>
                            <span>Compliance</span>
                          </div>

                          {stats.complianceData.map((emp: any, i: number) => {
                            const weeklyPercent = Math.min((parseFloat(emp.weeklyHours) / 40) * 100, 100);
                            const initials = emp.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2);
                            return (
                              <div key={i} style={{
                                display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)',
                                alignItems: 'center', padding: '12px 15px',
                                background: 'var(--bg-input)', border: '1px solid var(--border-subtle)',
                                borderRadius: '12px', transition: 'all 0.2s', gap: '5px'
                              }}
                                onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--accent-primary)'; e.currentTarget.style.transform = 'translateX(2px)'; }}
                                onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.transform = 'translateX(0)'; }}
                              >
                                {/* Employee */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                                  <div style={{
                                    width: '32px', height: '32px', borderRadius: '50%',
                                    background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: 'white', fontWeight: 700, fontSize: '0.7rem', flexShrink: 0
                                  }}>
                                    {initials}
                                  </div>
                                  <div style={{ minWidth: 0 }}>
                                    <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{emp.name}</div>
                                  </div>
                                </div>

                                {/* Today */}
                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-main)' }}>
                                  {emp.todayHours}<span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>/8h</span>
                                </div>

                                {/* Status */}
                                <div>
                                  <span style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                                    padding: '4px 8px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 700,
                                    background: emp.isOverDaily ? 'rgba(245, 158, 11, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                                    color: emp.isOverDaily ? '#f59e0b' : '#22c55e',
                                    border: `1px solid ${emp.isOverDaily ? 'rgba(245, 158, 11, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`,
                                  }}>
                                    {emp.isOverDaily ? '⚠ OT' : '✓ OK'}
                                  </span>
                                </div>

                                {/* Weekly */}
                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-main)' }}>
                                  {emp.weeklyHours}<span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>/40h</span>
                                </div>

                                {/* Compliance Bar */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <div className="compliance-bar" style={{ flex: 1, minWidth: '40px' }}>
                                    <div
                                      className={`compliance-fill ${emp.isOverWeekly ? 'over' : 'ok'}`}
                                      style={{ width: `${weeklyPercent}%` }}
                                    />
                                  </div>
                                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)', minWidth: '25px', textAlign: 'right' }}>
                                    {weeklyPercent.toFixed(0)}%
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                          <div style={{ fontSize: '2rem', marginBottom: '10px' }}>👥</div>
                          No team members to display
                        </div>
                      )}
                      {/* Generate Reports Area */}
                      <div style={{ marginTop: '20px', paddingTop: '15px', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '15px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Generate Report:</span>
                          <div style={{ display: 'flex', gap: '8px', background: 'rgba(255, 255, 255, 0.02)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                            <select id="reportTarget" className="input-rounded" style={{ padding: '8px 14px', backgroundColor: 'var(--bg-input, #1e1e1e)', color: 'var(--text-main, #ffffff)', border: 'none', fontSize: '0.8rem', borderRadius: '6px', cursor: 'pointer', outline: 'none', width: 'auto' }}>
                              <option value="all" style={{ backgroundColor: 'var(--bg-panel, #121212)', color: 'var(--text-main, #ffffff)' }}>All Direct Reports</option>
                              {stats.complianceData && stats.complianceData.map((emp: any, i: number) => (
                                <option key={`report-${i}`} value={emp.user_id || emp.name} style={{ backgroundColor: 'var(--bg-panel, #121212)', color: 'var(--text-main, #ffffff)' }}>{emp.name}</option>
                              ))}
                            </select>
                            <select id="reportFormat" className="input-rounded" style={{ padding: '8px 14px', backgroundColor: 'var(--bg-input, #1e1e1e)', color: 'var(--text-main, #ffffff)', border: 'none', fontSize: '0.8rem', borderRadius: '6px', cursor: 'pointer', outline: 'none', width: 'auto' }}>
                              <option value="csv" style={{ backgroundColor: 'var(--bg-panel, #121212)', color: 'var(--text-main, #ffffff)' }}>CSV Format</option>
                              <option value="json" style={{ backgroundColor: 'var(--bg-panel, #121212)', color: 'var(--text-main, #ffffff)' }}>JSON Format</option>
                            </select>
                          </div>
                        </div>
                        <button
                          className="btn-improved btn-primary"
                          style={{ padding: '8px 20px', fontSize: '0.8rem' }}
                          onClick={async () => {
                            const target = (document.getElementById('reportTarget') as HTMLSelectElement).value;
                            const format = (document.getElementById('reportFormat') as HTMLSelectElement).value;
                            try {
                              const res = await fetch('/api/supervisor/reports/generate', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  report_type: 'custom',
                                  format: format,
                                  employee_id: target,
                                  start_date: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
                                  end_date: new Date().toISOString().split('T')[0]
                                })
                              });

                              if (res.ok) {
                                const data = await res.json();
                                if (format === 'csv') {
                                  const blob = new Blob([data.report.content], { type: 'text/csv' });
                                  const url = window.URL.createObjectURL(blob);
                                  const a = document.createElement('a');
                                  a.href = url;
                                  a.download = data.report.filename;
                                  document.body.appendChild(a);
                                  a.click();
                                  a.remove();
                                } else {
                                  alert("JSON Report generated. Check console.");
                                  console.log(data);
                                }
                              } else {
                                alert("Failed to generate report.");
                              }
                            } catch (e) {
                              alert("Error connecting to report server.");
                            }
                          }}
                        >
                          Generate & Export
                        </button>
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            )}
            {/* Removed inline settings section */}
          </div>
        </main>
      </div>

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className={`modal-overlay-improved supervisor-theme ${lightMode ? 'light-mode' : ''}`} onClick={() => setShowSettingsModal(false)}>
          <div className="modal-card-improved" style={{ maxWidth: '600px', width: '90%', border: '1px solid var(--border-subtle)' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-improved">
              <div className="modal-icon-wrapper" style={{ background: 'rgba(167,139,250,0.1)', color: 'var(--accent-primary)', border: '1px solid rgba(167,139,250,0.3)' }}>⚙️</div>
              <div className="modal-title-improved">Dashboard Settings</div>
              <div className="modal-subtitle">Manage your profile and application appearance</div>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="btn-close-modal"
                style={{ position: 'absolute', right: '20px', top: '20px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}
              >
                ✕
              </button>
            </div>

            <div className="modal-body-improved" style={{ maxHeight: '70vh', overflowY: 'auto', padding: '30px', background: 'var(--bg-panel)' }}>

              {/* Security Section */}
              <div style={{ marginBottom: '30px' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '15px', textTransform: 'uppercase', letterSpacing: '1px', paddingLeft: '4px' }}>Security Settings</div>
                <div style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '20px',
                  padding: '24px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={{
                      width: '52px',
                      height: '52px',
                      borderRadius: '50%',
                      background: 'var(--bg-deep)',
                      border: '1px solid var(--border-subtle)',
                      color: '#f59e0b',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.4rem'
                    }}>
                      🔑
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '1.05rem' }}>Change Password</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>Update your account access credentials</div>
                    </div>
                  </div>
                  <button
                    style={{
                      background: '#22c55e',
                      color: 'white',
                      border: 'none',
                      padding: '10px 24px',
                      borderRadius: '10px',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}
                    onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(34, 197, 94, 0.3)'; }}
                    onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                    onClick={() => {
                      setShowSettingsModal(false);
                      resetCpState();
                      setShowCpModal(true);
                    }}
                  >
                    Update
                  </button>
                </div>
              </div>

              {/* Appearance Section */}
              <div style={{ marginBottom: '15px' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '15px', textTransform: 'uppercase', letterSpacing: '1px', paddingLeft: '4px' }}>Appearance</div>
                <div style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '20px',
                  padding: '4px 0',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
                }}>
                  {/* Theme Mode Row */}
                  <div style={{ padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                      <div style={{
                        width: '46px',
                        height: '46px',
                        borderRadius: '50%',
                        background: 'var(--bg-deep)',
                        border: '1px solid var(--border-subtle)',
                        color: '#f59e0b',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.2rem'
                      }}>
                        ☀️
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>Theme Mode</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Toggle between light and dark visual themes</div>
                      </div>
                    </div>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={!lightMode}
                        onChange={toggleTheme}
                      />
                      <span className="slider"></span>
                    </label>
                  </div>


                </div>
              </div>

              {message && (
                <div className="fade-in" style={{
                  marginTop: '1.5rem',
                  color: 'var(--accent-primary)',
                  fontWeight: 600,
                  textAlign: 'center',
                  background: 'rgba(167, 139, 250, 0.08)',
                  padding: '12px',
                  borderRadius: '12px',
                  border: '1px solid rgba(167, 139, 250, 0.2)',
                  fontSize: '0.9rem'
                }}>
                  {message}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Logout Confirmation Modal */}
      {logoutModal && (
        <div className={`modal-overlay-improved supervisor-theme ${lightMode ? 'light-mode' : ''}`} onClick={() => setLogoutModal(false)}>
          <div className="modal-card-improved" style={{ maxWidth: '440px', width: '90%', border: '1px solid var(--border-subtle)' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-improved">
              <div className="modal-icon-wrapper" style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)' }}>🚪</div>
              <div className="modal-title-improved">End Session</div>
              <div className="modal-subtitle">Are you sure you want to log out?</div>
              <button
                onClick={() => setLogoutModal(false)}
                className="btn-close-modal"
                style={{ position: 'absolute', right: '20px', top: '20px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}
              >
                ✕
              </button>
            </div>

            <div className="modal-body-improved" style={{ padding: '25px 30px', background: 'var(--bg-panel)' }}>
              {hasClockedIn && (
                <div style={{
                  background: 'rgba(251, 191, 36, 0.1)',
                  border: '1px solid rgba(251, 191, 36, 0.3)',
                  borderRadius: '14px',
                  padding: '16px 20px',
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px'
                }}>
                  <span style={{ fontSize: '1.5rem' }}>⚠️</span>
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--color-warn)', fontSize: '0.9rem' }}>Active Session Detected</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '3px' }}>You are currently clocked in. Please clock out before logging out to ensure your time is recorded correctly.</div>
                  </div>
                </div>
              )}

              <p style={{ color: 'var(--text-muted)', textAlign: 'center', margin: '0 0 25px 0', fontSize: '0.9rem', lineHeight: '1.6' }}>
                {hasClockedIn
                  ? 'Logging out while clocked in is not allowed.'
                  : 'Your session will be terminated and you will be redirected to the login page.'
                }
              </p>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => setLogoutModal(false)}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '12px',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-input)',
                    color: 'var(--text-main)',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.background = 'var(--bg-deep)'; }}
                  onMouseOut={(e) => { e.currentTarget.style.background = 'var(--bg-input)'; }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (!hasClockedIn) {
                      handleLogout();
                    }
                  }}
                  disabled={hasClockedIn}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '12px',
                    border: 'none',
                    background: hasClockedIn ? '#6b7280' : '#ef4444',
                    color: 'white',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    cursor: hasClockedIn ? 'not-allowed' : 'pointer',
                    opacity: hasClockedIn ? 0.5 : 1,
                    transition: 'all 0.2s',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}
                  onMouseOver={(e) => { if (!hasClockedIn) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.4)'; } }}
                  onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clock Out Confirmation Modal */}
      {showClockOutModal && (
        <div className={`modal-overlay-improved supervisor-theme ${lightMode ? 'light-mode' : ''}`} onClick={() => setShowClockOutModal(false)}>
          <div className="modal-card-improved" style={{ maxWidth: '440px', width: '90%', border: '1px solid var(--border-subtle)' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-improved">
              <div className="modal-icon-wrapper" style={{ background: 'rgba(251, 191, 36, 0.12)', color: '#fbbf24', border: '1px solid rgba(251, 191, 36, 0.3)' }}>⏱</div>
              <div className="modal-title-improved">End Session</div>
              <div className="modal-subtitle">Are you sure you want to clock out?</div>
              <button
                onClick={() => setShowClockOutModal(false)}
                className="btn-close-modal"
                style={{ position: 'absolute', right: '20px', top: '20px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}
              >
                ✕
              </button>
            </div>

            <div className="modal-body-improved" style={{ padding: '25px 30px', background: 'var(--bg-panel)' }}>
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', margin: '0 0 25px 0', fontSize: '0.9rem', lineHeight: '1.6' }}>
                Your supervisor session will be ended and your work hours will be recorded.
              </p>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => setShowClockOutModal(false)}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '12px',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-input)',
                    color: 'var(--text-main)',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.background = 'var(--bg-deep)'; }}
                  onMouseOut={(e) => { e.currentTarget.style.background = 'var(--bg-input)'; }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleClockOut}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '12px',
                    border: 'none',
                    background: '#ef4444',
                    color: 'white',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.4)'; }}
                  onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  Clock Out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Change Password Modal */}
      {showCpModal && (
        <div className={`modal-overlay-improved supervisor-theme ${lightMode ? 'light-mode' : ''}`} onClick={() => !cpLoading && setShowCpModal(false)}>
          <div className="modal-card-improved" style={{ maxWidth: '480px', width: '90%', border: '1px solid var(--border-subtle)' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-improved" style={{ paddingBottom: '15px' }}>
              <div className="modal-icon-wrapper" style={{
                background: cpStep === 4 ? 'rgba(34, 197, 94, 0.12)' : 'rgba(167,139,250,0.1)',
                color: cpStep === 4 ? '#22c55e' : 'var(--accent-primary)',
                border: `1px solid ${cpStep === 4 ? 'rgba(34, 197, 94, 0.3)' : 'rgba(167,139,250,0.3)'}`
              }}>
                {cpStep === 4 ? <CheckCircle size={28} /> : '🔒'}
              </div>
              <div className="modal-title-improved">
                {cpStep === 1 ? "Secure Verification" : cpStep === 2 ? "Security Question" : cpStep === 3 ? "New Password" : "Password Updated"}
              </div>
              <div className="modal-subtitle">
                {cpStep === 1 ? "Verify your identity via email OTP." : cpStep === 2 ? "Answer your security question." : cpStep === 3 ? "Set your new secure password." : "Redirecting to login..."}
              </div>
              <button
                onClick={() => !cpLoading && setShowCpModal(false)}
                style={{ position: 'absolute', right: '20px', top: '20px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}
              >
                ✕
              </button>
            </div>

            <div className="modal-body-improved" style={{ padding: '25px 30px', background: 'var(--bg-panel)' }}>
              {/* Fancy Step Indicator */}
              {cpStep < 4 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0', marginBottom: '25px' }}>
                  {[
                    { num: 1, label: 'Verify' },
                    { num: 2, label: 'Question' },
                    { num: 3, label: 'Password' }
                  ].map((s, idx) => (
                    <div key={s.num} style={{ display: 'flex', alignItems: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                        <div style={{
                          width: '32px', height: '32px', borderRadius: '50%',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.8rem', fontWeight: 700,
                          background: cpStep > s.num ? '#22c55e' : cpStep === s.num ? 'var(--accent-primary)' : 'var(--bg-input)',
                          color: cpStep >= s.num ? 'white' : 'var(--text-muted)',
                          border: `2px solid ${cpStep > s.num ? '#22c55e' : cpStep === s.num ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                          transition: 'all 0.3s'
                        }}>
                          {cpStep > s.num ? '✓' : s.num}
                        </div>
                        <span style={{
                          fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px',
                          color: cpStep >= s.num ? 'var(--text-main)' : 'var(--text-muted)'
                        }}>
                          {s.label}
                        </span>
                      </div>
                      {idx < 2 && (
                        <div style={{
                          width: '40px', height: '2px', margin: '0 8px', marginBottom: '22px',
                          background: cpStep > s.num ? '#22c55e' : 'var(--border-subtle)',
                          transition: 'background 0.3s'
                        }} />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {cpError && (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '12px', padding: '12px 16px', marginBottom: '20px',
                  color: '#ef4444', fontSize: '0.85rem', fontWeight: 600, textAlign: 'center'
                }}>
                  {cpError}
                </div>
              )}

              {/* Step 1: OTP */}
              {cpStep === 1 && (
                <div>
                  {!cpOtpSent ? (
                    <div style={{ textAlign: 'center' }}>
                      <div style={{
                        background: 'var(--bg-input)', border: '1px solid var(--border-subtle)',
                        borderRadius: '14px', padding: '20px', marginBottom: '20px'
                      }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
                          Verification will be sent to
                        </div>
                        <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
                          {userProfile.email ? userProfile.email : "Loading email..."}
                        </div>
                      </div>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: '1.6' }}>
                        We will send a 6-digit verification code to your registered email address.
                      </p>
                      <button
                        onClick={handleSendOtp} disabled={cpLoading || !userProfile.email}
                        style={{
                          width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
                          background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                          color: 'white', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer',
                          transition: 'all 0.2s', opacity: (cpLoading || !userProfile.email) ? 0.5 : 1
                        }}
                        onMouseOver={(e) => { if (!cpLoading) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 15px rgba(167, 139, 250, 0.4)'; } }}
                        onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                      >
                        {cpLoading ? "Sending..." : "📧 Send Verification Code"}
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleVerifyOtp}>
                      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '12px' }}>
                        Enter 6-Digit Code
                      </div>
                      <div className="cp-otp-grid">
                        {[0, 1, 2, 3, 4, 5].map((idx) => (
                          <input
                            key={idx}
                            ref={(el) => { cpOtpRefs.current[idx] = el; }}
                            type="text"
                            maxLength={1}
                            className="cp-otp-box"
                            value={cpOtp[idx]}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, "");
                              const newOtp = [...cpOtp];
                              newOtp[idx] = val;
                              setCpOtp(newOtp);
                              if (val && idx < 5) cpOtpRefs.current[idx + 1]?.focus();
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Backspace" && !cpOtp[idx] && idx > 0) {
                                cpOtpRefs.current[idx - 1]?.focus();
                              }
                            }}
                            onPaste={(e) => {
                              e.preventDefault();
                              const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
                              if (text) {
                                const newOtp = [...cpOtp];
                                text.split("").forEach((char, i) => { newOtp[i] = char; });
                                setCpOtp(newOtp);
                                cpOtpRefs.current[Math.min(text.length, 5)]?.focus();
                              }
                            }}
                            required
                          />
                        ))}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '12px 0 20px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        <span>Code expires in 90s</span>
                        <span
                          onClick={() => cpCountdown === 0 && handleSendOtp()}
                          style={{ color: cpCountdown === 0 ? 'var(--accent-primary)' : 'var(--text-muted)', cursor: cpCountdown === 0 ? 'pointer' : 'default', fontWeight: 600 }}
                        >
                          {cpCountdown > 0 ? `Resend in ${cpCountdown}s` : 'Resend Code'}
                        </span>
                      </div>
                      <button type="submit" disabled={cpLoading || cpOtp.join("").length < 6}
                        style={{
                          width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
                          background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                          color: 'white', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer',
                          transition: 'all 0.2s', opacity: (cpLoading || cpOtp.join("").length < 6) ? 0.5 : 1
                        }}
                      >
                        {cpLoading ? "Verifying..." : "Verify Code"}
                      </button>
                    </form>
                  )}
                </div>
              )}

              {/* Step 2: Question */}
              {cpStep === 2 && (
                <form onSubmit={handleVerifyQuestion}>
                  <div style={{
                    background: 'var(--bg-input)', border: '1px solid var(--border-subtle)',
                    borderRadius: '14px', padding: '20px', marginBottom: '20px', textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
                      Security Question
                    </div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--accent-orange)' }}>
                      {(cpQuestion || "SECURITY CHECK").toUpperCase()}
                    </div>
                  </div>
                  <div className="form-group-improved">
                    <input
                      type="text"
                      className="input-improved"
                      style={{ padding: '14px', fontSize: '1rem', textAlign: 'center', letterSpacing: '1px' }}
                      placeholder="Enter your answer"
                      value={cpAnswer}
                      onChange={(e) => setCpAnswer(removeEmojis(e.target.value))}
                      required
                      autoFocus
                    />
                  </div>
                  <button type="submit" disabled={cpLoading || !cpAnswer.trim()}
                    style={{
                      width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
                      background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                      color: 'white', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer',
                      transition: 'all 0.2s', marginTop: '15px', opacity: (cpLoading || !cpAnswer.trim()) ? 0.5 : 1
                    }}
                    onMouseOver={(e) => { if (!cpLoading && cpAnswer.trim()) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 15px rgba(167, 139, 250, 0.4)'; } }}
                    onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                  >
                    {cpLoading ? "Verifying..." : "Verify Answer"}
                  </button>
                </form>
              )}

              {/* Step 3: Fast Password */}
              {cpStep === 3 && (
                <form onSubmit={handleChangePasswordSubmit}>
                  <div className="form-group-improved">
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', display: 'block' }}>NEW PASSWORD</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={cpShowPass1 ? "text" : "password"}
                        className="input-improved"
                        style={{ padding: '14px', paddingRight: '45px', fontSize: '1rem' }}
                        placeholder="15-20 characters"
                        value={cpNewPassword}
                        onChange={(e) => { setCpTouchedPw(true); setCpNewPassword(clampPasswordInput(e.target.value)); }}
                        onBlur={() => setCpTouchedPw(true)}
                        onKeyDown={(e) => syncCaps(e, 1)}
                        onKeyUp={(e) => syncCaps(e, 1)}
                        maxLength={20}
                        required
                        onPaste={(e) => e.preventDefault()}
                        onCopy={(e) => e.preventDefault()}
                      />
                      <button type="button" onClick={() => setCpShowPass1(!cpShowPass1)}
                        style={{
                          position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                          background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '5px'
                        }}
                      >
                        {cpShowPass1 ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    {cpCapsOn1 && <div style={{ fontSize: '0.75rem', color: '#f59e0b', marginTop: '6px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}><span>⚠</span> CAPS LOCK IS ON</div>}

                    {(cpTouchedPw || cpTouchedConfirm) && cpNewPassword.length > 0 && (
                      <div style={{
                        marginTop: '12px', padding: '12px', background: 'var(--bg-input)',
                        border: '1px solid var(--border-subtle)', borderRadius: '8px',
                        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px'
                      }}>
                        <div style={{ fontSize: '0.75rem', color: cpChecks.lengthOk ? '#22c55e' : 'var(--text-muted)' }}>{cpChecks.lengthOk ? '✓' : '•'} 15–20 chars</div>
                        <div style={{ fontSize: '0.75rem', color: cpChecks.upperOk ? '#22c55e' : 'var(--text-muted)' }}>{cpChecks.upperOk ? '✓' : '•'} Uppercase</div>
                        <div style={{ fontSize: '0.75rem', color: cpChecks.lowerOk ? '#22c55e' : 'var(--text-muted)' }}>{cpChecks.lowerOk ? '✓' : '•'} Lowercase</div>
                        <div style={{ fontSize: '0.75rem', color: cpChecks.numberOk ? '#22c55e' : 'var(--text-muted)' }}>{cpChecks.numberOk ? '✓' : '•'} Number</div>
                        <div style={{ fontSize: '0.75rem', color: cpChecks.symbolOk ? '#22c55e' : 'var(--text-muted)' }}>{cpChecks.symbolOk ? '✓' : '•'} Symbol (!@?_-)</div>
                        <div style={{ fontSize: '0.75rem', color: cpChecks.onlyAllowed ? '#22c55e' : '#ef4444' }}>{cpChecks.onlyAllowed ? '✓' : '✗'} Permitted chars</div>
                      </div>
                    )}
                  </div>

                  <div className="form-group-improved" style={{ marginTop: '20px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', display: 'block' }}>CONFIRM PASSWORD</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={cpShowPass2 ? "text" : "password"}
                        className="input-improved"
                        style={{ padding: '14px', paddingRight: '45px', fontSize: '1rem' }}
                        placeholder="Retype password"
                        value={cpConfirmPassword}
                        onChange={(e) => { setCpTouchedConfirm(true); setCpConfirmPassword(clampPasswordInput(e.target.value)); }}
                        onBlur={() => setCpTouchedConfirm(true)}
                        onKeyDown={(e) => syncCaps(e, 2)}
                        onKeyUp={(e) => syncCaps(e, 2)}
                        maxLength={20}
                        required
                        onPaste={(e) => e.preventDefault()}
                        onCopy={(e) => e.preventDefault()}
                      />
                      <button type="button" onClick={() => setCpShowPass2(!cpShowPass2)}
                        style={{
                          position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                          background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '5px'
                        }}
                      >
                        {cpShowPass2 ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    {cpCapsOn2 && <div style={{ fontSize: '0.75rem', color: '#f59e0b', marginTop: '6px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}><span>⚠</span> CAPS LOCK IS ON</div>}

                    {cpTouchedConfirm && cpConfirmPassword.length > 0 && cpNewPassword !== cpConfirmPassword && (
                      <div style={{ fontSize: '0.8rem', color: '#ef4444', marginTop: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span>✗</span> PASSWORDS DO NOT MATCH
                      </div>
                    )}
                  </div>

                  <button type="submit" disabled={cpLoading || !cpChecks.strongOk || cpNewPassword !== cpConfirmPassword}
                    style={{
                      width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
                      background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                      color: 'white', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer',
                      transition: 'all 0.2s', marginTop: '25px', opacity: (cpLoading || !cpChecks.strongOk || cpNewPassword !== cpConfirmPassword) ? 0.5 : 1
                    }}
                    onMouseOver={(e) => { if (!cpLoading && cpChecks.strongOk && cpNewPassword === cpConfirmPassword) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 15px rgba(167, 139, 250, 0.4)'; } }}
                    onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                  >
                    {cpLoading ? "Updating..." : "Update Password"}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Rejection Reason Modal */}
      {showRejectionModal && (
        <div className="modal-overlay-improved" onClick={() => setShowRejectionModal(false)}>
          <div className="modal-card-improved rejection-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-improved">
              <div className="modal-icon-wrapper reject-icon">✗</div>
              <div className="modal-title-improved">Reject Timesheet</div>
              <div className="modal-subtitle">Please provide a detailed reason for rejecting this timesheet</div>
            </div>
            <div className="modal-body-improved">
              {selectedTimesheet && (
                <div className="rejection-info">
                  <div className="info-item">
                    <span className="info-label">Employee:</span>
                    <span className="info-value">{selectedTimesheet.employee}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Date:</span>
                    <span className="info-value">{selectedTimesheet.date}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Hours:</span>
                    <span className="info-value">{selectedTimesheet.hours.toFixed(2)}</span>
                  </div>
                </div>
              )}
              <div className="form-group-improved">
                <label className="label-improved">Rejection Reason *</label>
                <textarea
                  className="textarea-improved"
                  rows={5}
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
                <div className="input-hint">This reason will be visible to the employee</div>
              </div>
            </div>
            <div className="modal-actions-improved">
              <button className="btn-improved btn-ghost" onClick={() => setShowRejectionModal(false)}>
                Cancel
              </button>
              <button className="btn-improved btn-reject" onClick={handleRejectSubmit} disabled={!rejectionReason.trim()}>
                <span>✗</span> Reject Timesheet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Details Modal (Split-Pane Timeline Layout) */}
      {showDetailsModal && selectedTimesheet && (() => {
        const billableCount = selectedTimesheet.details?.filter((d: any) => d.is_billable).length || 0;
        const totalCount = selectedTimesheet.details?.length || 0;
        const initials = selectedTimesheet.employee?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || '??';
        return (
          <div className={`modal-overlay-improved supervisor-theme ${lightMode ? 'light-mode' : ''} ${isDetailsClosing ? 'modal-closing' : ''}`} onClick={closeDetailsModal} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                  backgroundImage: 'linear-gradient(180deg, rgba(167,139,250,0.08) 0%, transparent 40%)',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative'
                }}>
                  {/* Right-edge separator glow */}
                  <div style={{ position: 'absolute', right: '-1px', top: 0, bottom: 0, width: '1px', background: 'linear-gradient(180deg, var(--accent-primary), var(--accent-cyan), var(--border-subtle))', opacity: 0.5, zIndex: 2 }} />
                  <div style={{ position: 'absolute', right: '-4px', top: 0, bottom: 0, width: '8px', background: 'linear-gradient(90deg, rgba(167,139,250,0.08), transparent)', pointerEvents: 'none', zIndex: 1 }} />
                  {/* Accent edge line */}
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '3px', background: 'linear-gradient(180deg, var(--accent-primary), var(--accent-cyan), transparent)', borderRadius: '0 2px 2px 0' }} />

                  <div style={{ padding: '35px 28px 35px 32px', flex: 1, overflowY: 'auto' }}>
                    {/* Profile Section */}
                    <div style={{ textAlign: 'center', marginBottom: '28px', paddingBottom: '22px', borderBottom: '1px solid var(--border-subtle)' }}>
                      <div style={{
                        width: 56, height: 56, borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-highlight))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '1.1rem', fontWeight: 800, color: 'white', letterSpacing: '1px',
                        margin: '0 auto 14px',
                        boxShadow: '0 0 24px var(--shadow-glow)'
                      }}>{initials}</div>
                      <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.3px' }}>{selectedTimesheet.employee}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px', letterSpacing: '0.5px' }}>Timesheet Report</div>
                    </div>

                    {/* Stats */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ background: 'var(--bg-input)', borderRadius: '10px', padding: '14px 16px', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text-muted)', marginBottom: 6 }}>Date Logged</div>
                        <div style={{ fontWeight: 600, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)' }}>
                          <span style={{ opacity: 0.6, fontSize: '0.9rem' }}>📅</span> {selectedTimesheet.date}
                        </div>
                      </div>

                      <div style={{ background: 'var(--bg-input)', borderRadius: '10px', padding: '14px 16px', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text-muted)', marginBottom: 6 }}>Total Hours</div>
                        <div style={{ fontWeight: 700, fontSize: '1.8rem', color: 'var(--accent-cyan)', lineHeight: 1 }}>
                          {Number(selectedTimesheet.hours).toFixed(2)} <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>hrs</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '10px' }}>
                        <div style={{ flex: 1, background: 'var(--bg-input)', borderRadius: '10px', padding: '12px 14px', border: '1px solid var(--border-subtle)' }}>
                          <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text-muted)', marginBottom: 4 }}>Activities</div>
                          <div style={{ fontWeight: 700, fontSize: '1.3rem', color: 'var(--text-main)' }}>{totalCount}</div>
                        </div>
                        <div style={{ flex: 1, background: 'rgba(74, 222, 128, 0.04)', borderRadius: '10px', padding: '12px 14px', border: '1px solid rgba(74, 222, 128, 0.08)' }}>
                          <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--color-go)', marginBottom: 4 }}>Billable</div>
                          <div style={{ fontWeight: 700, fontSize: '1.3rem', color: 'var(--color-go)' }}>{billableCount}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* RIGHT PANE */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-panel)', minWidth: 0 }}>

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
                    {selectedTimesheet.details && selectedTimesheet.details.length > 0 ? (
                      <div style={{ position: 'relative', paddingLeft: '28px' }}>
                        {/* Vertical Timeline Line */}
                        <div style={{ position: 'absolute', left: '6px', top: '10px', bottom: '10px', width: '2px', background: 'linear-gradient(180deg, var(--accent-primary), var(--accent-cyan), var(--border-subtle))', borderRadius: '2px', opacity: 0.4 }} />

                        {selectedTimesheet.details.map((detail: any, idx: number) => (
                          <div key={idx} style={{
                            position: 'relative',
                            marginBottom: idx === selectedTimesheet.details.length - 1 ? 0 : '16px',
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
                              gap: '16px'
                            }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-card)'; e.currentTarget.style.borderColor = 'var(--accent-primary)'; e.currentTarget.style.borderLeftColor = detail.is_billable ? 'var(--accent-highlight)' : 'var(--accent-primary)' }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-input)'; e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.borderLeftColor = detail.is_billable ? 'var(--accent-primary)' : 'var(--border-subtle)' }}
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

                {/* Close two-pane row container */}
              </div>

              {/* ACTION FOOTER */}
              <div style={{ padding: '14px 28px', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-input)', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', marginRight: 'auto' }}>Review carefully before approving.</span>
                <button className="btn-reject-outline" onClick={() => { closeDetailsModal(); setTimeout(() => openRejectModal(selectedTimesheet), 280); }} style={{ padding: '7px 18px', borderRadius: '8px', fontWeight: 700, whiteSpace: 'nowrap', fontSize: '0.8rem', flex: 'none' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'; e.currentTarget.style.borderColor = '#ef4444' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--color-urgent)' }}
                >
                  ✗ Reject
                </button>
                <button className="btn-approve" onClick={() => { closeDetailsModal(); setTimeout(() => handleApprovalAction(selectedTimesheet.log_ids, 'APPROVE'), 280); }} style={{ padding: '7px 18px', borderRadius: '8px', fontWeight: 700, whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                  ✓ Approve
                </button>
              </div>
            </div>
          </div >
        );
      })()}

      <style jsx>{`
        .profile-dropdown {
          position: absolute;
          bottom: 100%;
          left: 0;
          right: 0;
          margin-bottom: 10px;
          background: var(--bg-panel);
          border: 1px solid var(--border-subtle);
          border-radius: 12px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
          overflow: hidden;
          z-index: 1000;
          animation: slideUp 0.2s ease;
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .dropdown-item {
          width: 100%;
          padding: 12px 16px;
          border: none;
          background: transparent;
          color: var(--text-main);
          text-align: left;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 10px;
          transition: all 0.2s;
        }

        .dropdown-item:hover {
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          animation: fadeIn 0.2s ease;
        }

        .modal-card {
          background: var(--bg-panel);
          border: 1px solid var(--border-subtle);
          border-radius: 16px;
          padding: 30px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
          animation: scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
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

        .modal-title {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--text-main);
          margin-bottom: 1rem;
        }

        .modal-actions {
          display: flex;
          gap: 10px;
          justify-content: flex-end;
        }

        .modal-btn {
          padding: 10px 20px;
          border-radius: 8px;
          border: none;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .modal-btn.ok {
          background: var(--accent-primary);
          color: white;
        }

        .modal-btn.ok:hover {
          background: var(--accent-secondary);
          transform: translateY(-1px);
        }

        .modal-btn.ghost {
          background: transparent;
          color: var(--text-muted);
          border: 1px solid var(--border-subtle);
        }

        .modal-btn.ghost:hover {
          background: rgba(255, 255, 255, 0.05);
          color: var(--text-main);
        }

        .detail-row {
          display: flex;
          justify-content: space-between;
          padding: 12px 0;
          border-bottom: 1px solid var(--border-subtle);
        }

        .detail-label {
          font-weight: 600;
          color: var(--text-muted);
        }

        .detail-value {
          font-weight: 600;
          color: var(--text-main);
        }

        .activity-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .activity-item {
          padding: 12px;
          background: var(--bg-input);
          border: 1px solid var(--border-subtle);
          border-radius: 8px;
        }

        .billable-badge {
          display: inline-block;
          margin-top: 5px;
          padding: 2px 8px;
          background: rgba(34, 197, 94, 0.1);
          color: var(--color-go);
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 600;
        }

        .week-nav-btn {
          padding: 8px 16px;
          background: var(--bg-input);
          border: 1px solid var(--border-subtle);
          border-radius: 8px;
          color: var(--text-main);
          font-weight: 600;
          font-size: 0.85rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .week-nav-btn:hover:not(:disabled) {
          background: var(--accent-primary);
          border-color: var(--accent-primary);
          color: white;
          transform: translateY(-1px);
        }

        .week-nav-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .bar-group {
          position: relative;
        }

        .bar {
          position: relative;
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

        /* Analytics Improvements */
        .analytics-top-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 1.5rem;
          margin-bottom: 2rem;
        }

        .analytics-card {
          background: var(--bg-panel);
          border: 1px solid var(--border-subtle);
          border-radius: 16px;
          padding: 1.75rem;
          display: flex;
          align-items: center;
          gap: 1.25rem;
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
        }

        .analytics-card:before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
          background: linear-gradient(90deg, var(--accent-primary), var(--accent-secondary));
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .analytics-card:hover {
          border-color: var(--accent-primary);
          transform: translateY(-5px);
          box-shadow: 0 10px 30px rgba(167, 139, 250, 0.25);
        }

        .analytics-card:hover:before {
          opacity: 1;
        }

        .analytics-icon {
          width: 70px;
          height: 70px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, rgba(167, 139, 250, 0.2) 0%, rgba(124, 58, 237, 0.1) 100%);
          border-radius: 14px;
          font-size: 2rem;
          flex-shrink: 0;
        }

        .analytics-content {
          flex: 1;
          min-width: 0;
        }

        .analytics-label {
          font-size: 0.75rem;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 0.5rem;
        }

        .analytics-value {
          font-size: 2rem;
          font-weight: 700;
          color: var(--text-main);
          line-height: 1;
          margin-bottom: 0.25rem;
        }

        .analytics-value.accent-cyan {
          color: #06b6d4;
        }

        .analytics-value.success {
          color: #22c55e;
        }

        .analytics-sub {
          font-size: 0.85rem;
          color: var(--text-muted);
          font-weight: 500;
        }

        /* Compliance Table Styles */
        .compliance-bar {
          height: 24px;
          background: rgba(156, 163, 175, 0.2);
          border-radius: 12px;
          overflow: hidden;
          position: relative;
        }

        .compliance-fill {
          height: 100%;
          transition: width 0.5s ease;
          position: relative;
        }

        .compliance-fill.ok {
          background: linear-gradient(90deg, #22c55e 0%, #16a34a 100%);
        }

        .compliance-fill.over {
          background: linear-gradient(90deg, #f59e0b 0%, #ef4444 100%);
        }

        .compliance-fill:after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
          animation: shimmer 2s infinite;
        }

        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }

        .status-badge.ok {
          background: rgba(34, 197, 94, 0.15);
          color: #22c55e;
          border: 1px solid rgba(34, 197, 94, 0.3);
        }

        /* Settings Improvements */
        .settings-section {
          padding: 1.5rem 0;
        }

        .settings-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.25rem;
          background: var(--bg-input);
          border: 1px solid var(--border-subtle);
          border-radius: 12px;
          transition: all 0.3s ease;
        }

        .settings-header:hover {
          border-color: var(--accent-primary);
          box-shadow: 0 4px 12px rgba(167, 139, 250, 0.15);
        }

        .btn-settings-action {
          padding: 0.75rem 1.5rem;
          background: linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%);
          color: white;
          border: none;
          border-radius: 10px;
          font-weight: 700;
          font-size: 0.9rem;
          cursor: pointer;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .btn-settings-action:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(167, 139, 250, 0.4);
        }
      `}</style>
    </>
  );
}