'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import '../../styles/manager.css'; 

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

  const [timesheets, setTimesheets] = useState<any[]>([]);
  const [tsLoading, setTsLoading] = useState(false);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  
  const [rejectModal, setRejectModal] = useState({ show: false, tlogIds: [] as number[], reason: "" });
  const [rejectConfirmModal, setRejectConfirmModal] = useState(false);
  const [approveModal, setApproveModal] = useState({ show: false, tlogIds: [] as number[] });

  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  
  const [editShiftModal, setEditShiftModal] = useState({
      show: false, empId: "", empName: "", day: "", currentShift: "", newShiftId: "" 
  });
  
  const [logoutModal, setLogoutModal] = useState(false);
  const [saveShiftConfirmModal, setSaveShiftConfirmModal] = useState(false);
  
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const [pwStep, setPwStep] = useState(0);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  
  const [secQuestion, setSecQuestion] = useState({ id: null, text: "" });
  const [secAnswer, setSecAnswer] = useState("");
  
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  const pwValidation = useMemo(() => passwordChecks(newPassword), [newPassword]);
  const passwordsMatch = newPassword === confirmNewPassword && confirmNewPassword.length > 0;

  const [currentTime, setCurrentTime] = useState('');
  const [sessionStart, setSessionStart] = useState<number | null>(null);
  const [sessionDuration, setSessionDuration] = useState('00:00:00');

  const [schedSearch, setSchedSearch] = useState("");
  const [schedResults, setSchedResults] = useState<any[]>([]);
  const [selectedEmp, setSelectedEmp] = useState<any>(null);
  const [schedForm, setSchedForm] = useState({ date: "", start: "", end: "", task: "" });

  const [calendarView, setCalendarView] = useState<'weekly' | 'monthly'>('weekly');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [scheduleData, setScheduleData] = useState<any[]>([]);
  const [shiftTemplates, setShiftTemplates] = useState<any[]>([]); 
  const [schedLoading, setSchedLoading] = useState(false);

  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [activeProjectTab, setActiveProjectTab] = useState<string>(''); 
  const [reportTarget, setReportTarget] = useState('ALL'); 

  const [currentUser, setCurrentUser] = useState({ name: 'Loading...', initials: '...', position: '...', email: '' });
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    const handleTimeoutLogout = async () => {
        try { await fetch('/api/auth/logout', { method: 'POST' }); window.location.href = '/'; } catch (error) {}
    };
    const resetTimer = () => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => { alert("Session expired due to inactivity."); handleTimeoutLogout(); }, 30 * 60 * 1000);
    };
    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keypress', resetTimer);
    window.addEventListener('click', resetTimer);
    window.addEventListener('scroll', resetTimer);
    resetTimer();
    return () => {
        clearTimeout(timeoutId);
        window.removeEventListener('mousemove', resetTimer);
        window.removeEventListener('keypress', resetTimer);
        window.removeEventListener('click', resetTimer);
        window.removeEventListener('scroll', resetTimer);
    };
  }, []);

  const executeLogout = async () => {
      try { await fetch('/api/auth/logout', { method: 'POST' }); window.location.href = '/'; } catch (error) {}
  };

  useEffect(() => {
    const initDashboard = async () => {
      try {
        const meRes = await fetch('/api/manager/me');
        if (meRes.ok) {
            const meData = await meRes.json();
            setCurrentUser(meData);
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
      setCurrentTime(now.toLocaleTimeString([], { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (hasClockedIn && sessionStart) {
      interval = setInterval(() => {
        const diff = Date.now() - sessionStart;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setSessionDuration(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
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
        } catch (e) {}
      } else { setSchedResults([]); }
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [schedSearch]);

  const fetchPendingTimesheets = async () => {
    setTsLoading(true);
    try {
      const res = await fetch('/api/manager/timesheets/pending');
      if (res.ok) {
        const data = await res.json();
        setTimesheets(data.timesheets || []);
      }
    } catch (e) {} finally { setTsLoading(false); }
  };

  const fetchAnalyticsData = async () => {
    setAnalyticsLoading(true);
    try {
      const res = await fetch('/api/manager/analytics');
      if (res.ok) {
        const data = await res.json();
        setAnalyticsData(data);
        if (data.teams && data.teams.length > 0 && !activeProjectTab) {
          setActiveProjectTab(data.teams[0].team_name);
        }
      }
    } catch (e) {} finally { setAnalyticsLoading(false); }
  };

  useEffect(() => {
    if (activeSection === 'timesheets') fetchPendingTimesheets();
    else if (activeSection === 'analytics') fetchAnalyticsData();
  }, [activeSection]);

  const executeApproveTimesheet = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/manager/timesheets/approve', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tlog_ids: approveModal.tlogIds }) 
      });
      if (res.ok) { setApproveModal({ show: false, tlogIds: [] }); fetchPendingTimesheets(); } 
      else { const data = await res.json(); alert(`Failed: ${data.message}`); }
    } catch (e) { alert("Error approving timesheet."); } finally { setIsLoading(false); }
  };

  const executeRejectTimesheet = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/manager/timesheets/reject', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tlog_ids: rejectModal.tlogIds, reason: rejectModal.reason }) 
      });
      if (res.ok) { setRejectConfirmModal(false); setRejectModal({ show: false, tlogIds: [], reason: "" }); fetchPendingTimesheets(); } 
      else { const data = await res.json(); alert(`Failed: ${data.message}`); }
    } catch (e) { alert("Error rejecting timesheet."); } finally { setIsLoading(false); }
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
    if (!confirm("End Management Session?")) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/manager/clock/out', { method: 'POST' });
      if (res.ok) { setHasClockedIn(false); setSessionStart(null); setSessionDuration('00:00:00'); window.location.reload(); } 
      else { alert("Failed to end session."); }
    } catch (e) { alert("Connection error."); } finally { setIsLoading(false); }
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
      setPwLoading(true);
      setPwError("");
      try {
          const res = await fetch('/api/auth/otp/generate', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: currentUser.email })
          });
          if (res.ok) { setPwStep(1); setOtp(["", "", "", "", "", ""]); } 
          else { setPwError("Failed to send OTP."); }
      } catch (e) { setPwError("Connection error."); } 
      finally { setPwLoading(false); }
  };

  const handleVerifyOtp = async () => {
      const code = otp.join("");
      if (code.length < 6) return;
      setPwLoading(true);
      setPwError("");
      try {
          const res = await fetch('/api/auth/otp/verify', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: currentUser.email, otp: code, flow: "recovery" })
          });
          if (res.ok) {
              // FIXED: Changed to plural 'security-questions' to match your folder structure
              const qRes = await fetch('/api/manager/security-questions');
              if (qRes.ok) {
                  const qData = await qRes.json();
                  setSecQuestion({ id: qData.questionId, text: qData.questionText });
                  setPwStep(2);
              } else { 
                  // Now extracts the actual error message from the backend
                  const errData = await qRes.json().catch(()=>({}));
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
      setTimeout(() => { setPwStep(0); setPwError(""); setNewPassword(""); setConfirmNewPassword(""); setSecAnswer(""); }, 300);
  };

  const getDateString = () => {
    return new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).toUpperCase();
  };

  if (isLoading) {
    return (
        <div className={`dashboard-container ${lightMode ? 'light-mode' : ''}`} style={{display:'flex', justifyContent:'center', alignItems:'center'}}>
            <div style={{color: 'var(--accent-gold)', fontFamily: 'var(--font-mono)'}}>LOADING SYSTEM...</div>
        </div>
    );
  }

  return (
    <div className={`dashboard-container ${lightMode ? 'light-mode' : ''}`}>
      <div className="tech-mesh"></div>

      <aside className="info-panel" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="bg-decor bg-sq-outline sq-top-left"></div>
        <div className="bg-decor bg-sq-solid sq-bot-left"></div>

        <div className="brand-logo">
          ORASYNC 
          <span style={{ fontSize: '0.8rem', color: 'var(--accent-gold)', display: 'block', letterSpacing: '4px', marginTop: '-5px' }}>MANAGER</span>
        </div>

        <ul className="nav-links">
          <li className={`nav-item ${activeSection === 'department' ? 'active' : ''} ${!hasClockedIn ? 'locked' : ''}`} onClick={() => hasClockedIn && handleNavClick('department')}>Department</li>
          <li className={`nav-item ${activeSection === 'timesheets' ? 'active' : ''} ${!hasClockedIn ? 'locked' : ''}`} onClick={() => hasClockedIn && handleNavClick('timesheets')}>Approvals (Timesheets)</li>
          <li className={`nav-item ${activeSection === 'calendar' ? 'active' : ''} ${!hasClockedIn ? 'locked' : ''}`} onClick={() => hasClockedIn && handleNavClick('calendar')}>Schedule / Calendar</li>
          <li className={`nav-item ${activeSection === 'analytics' ? 'active' : ''} ${!hasClockedIn ? 'locked' : ''}`} onClick={() => hasClockedIn && handleNavClick('analytics')}>Reports / Analytics</li>
        </ul>

        {/* PROFILE MENU & POPUP */}
        <div style={{ position: 'relative', marginTop: 'auto' }}>
            {showProfileMenu && (
                <div className="fade-in" style={{ 
                    position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: '10px', 
                    background: '#141414', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px',
                    display: 'flex', flexDirection: 'column', zIndex: 100, boxShadow: '0 4px 20px rgba(0,0,0,0.5)', overflow: 'hidden' 
                }}>
                    <button 
                        onClick={() => { setShowSettingsModal(true); setShowProfileMenu(false); }} 
                        style={{ width: '100%', textAlign: 'left', border: 'none', padding: '16px 20px', background: 'transparent', color: '#ffffff', fontSize: '0.95rem', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '12px', transition: 'background 0.2s' }}
                        onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                        onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                        <span style={{ fontSize: '1.1rem' }}>⚙</span> Settings
                    </button>
                    <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', width: '100%' }}></div>
                    <button 
                        onClick={() => { setShowProfileMenu(false); setLogoutModal(true); }} 
                        style={{ width: '100%', textAlign: 'left', border: 'none', padding: '16px 20px', background: 'transparent', color: '#ff6b6b', fontSize: '0.95rem', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '12px', transition: 'background 0.2s' }}
                        onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                        onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                        <span style={{ fontSize: '1.1rem' }}>⊘</span> Log Out
                    </button>
                </div>
            )}
            
            <div 
                className="glass-card" 
                style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '15px', margin: 0, cursor: 'pointer', transition: 'all 0.2s', borderColor: showProfileMenu ? 'var(--accent-gold)' : 'transparent', background: showProfileMenu ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.2)' }}
                onClick={() => setShowProfileMenu(!showProfileMenu)}
            >
                <div className="avatar" style={{ margin: 0, flexShrink: 0 }}>{currentUser.initials}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-main)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{currentUser.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', marginTop: '2px' }}>{currentUser.position}</div>
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{showProfileMenu ? '▼' : '▲'}</div>
            </div>
        </div>
      </aside>

      <main className="workspace-panel">
        <div className="top-bar">
          <div className="status-badge go"><span className="dot"></span> SYSTEM SECURE</div>
        </div>

        <div className="content-area">
          
          {/* LANDING SCREEN */}
          {!hasClockedIn && (
            <div className="landing-layout fade-in">
              <div className="landing-card">
                <div className="section-title" style={{ justifyContent: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '30px' }}>
                    Manager Control
                </div>
                <div className="landing-clock">{currentTime || '00:00:00'}</div>
                <div style={{ marginBottom: '40px', letterSpacing: '2px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{getDateString()}</div>
                <p style={{ color: 'var(--text-muted)', marginBottom: '30px' }}>Executive access enabled. Click below to begin session.</p>
                <button className="btn-action btn-go" style={{ padding: '20px', fontSize: '1.3rem', boxShadow: '0 0 30px rgba(0, 210, 106, 0.3)' }} onClick={handleClockIn} disabled={isLoading}>
                  {isLoading ? "Starting..." : "CLOCK IN"}
                </button>
              </div>
            </div>
          )}

          {/* ACTIVE DEPARTMENT VIEW */}
          {hasClockedIn && activeSection === 'department' && (
            <div className="fade-in" style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div className="hud-row">
                    <div className="hud-card">
                        <div className="hud-bg-icon">⏱</div>
                        <div className="hud-label">CURRENT TIME</div>
                        <div className="hud-val" style={{ color: 'var(--accent-cyan)' }}>{currentTime}</div>
                    </div>
                    <div className="hud-card">
                        <div className="hud-bg-icon">⚡</div>
                        <div className="hud-label">SESSION DURATION</div>
                        <div className="hud-val">{sessionDuration}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '5px' }}>Productivity Target: {sessionDuration.substring(0, 5)} / 8h</div>
                    </div>
                    <div className="hud-card" style={{ borderColor: 'var(--accent-gold)' }}>
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
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
                                                    <h3 style={{ margin: 0, color: 'var(--accent-gold)', fontSize: '1.2rem' }}>{team.name === 'Unassigned' ? team.name : `Team ${team.name}`}</h3>
                                                    <span className="status-badge" style={{ background: 'var(--bg-input)', padding: '5px 10px', borderRadius: '12px', color: 'var(--text-main)' }}>👥 {team.members.length}</span>
                                                </div>
                                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '5px' }}>Supervisor</div>
                                                <div style={{ fontWeight: 600, fontSize: '1.05rem' }}>{team.supervisor}</div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="section-title" style={{ padding: '20px 25px', margin: 0, border: 'none', background: 'rgba(0,0,0,0.1)', justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                        <button className="btn-view" onClick={() => {setSelectedTeam(null); setSearchQuery("");}}>← Back</button>
                                        <span>{selectedTeam === 'Unassigned' ? 'Unassigned Roster' : `Team ${selectedTeam} Roster`}</span>
                                    </div>
                                    <input type="text" placeholder="Search by Name..." className="btn-view" style={{ width: '250px', textAlign: 'left', cursor: 'text' }} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                                </div>
                                <div className="table-container">
                                    <table className="data-table">
                                        <thead><tr><th>Name</th><th>Position</th><th>Status</th></tr></thead>
                                        <tbody>
                                            {filteredAndSortedRoster.length === 0 && (<tr><td colSpan={3} style={{textAlign:'center', color:'var(--text-muted)'}}>No employees found.</td></tr>)}
                                            {filteredAndSortedRoster.map(emp => (
                                                <tr key={emp.user_id}>
                                                    <td style={{ fontWeight: 700 }}>{emp.name}</td>
                                                    <td>{emp.role_id === 4 && <span className="tag tag-sup">HEAD</span>} {emp.position || (emp.role_id === 4 ? 'Supervisor' : 'Employee')}</td>
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
                            <button className="btn-action btn-standard" onClick={() => setShowScheduleModal(true)} style={{ marginBottom: '15px' }}>+ Override Schedule</button>
                            <button className="btn-action btn-standard" onClick={() => setShowActivityModal(true)} style={{ marginBottom: '15px', background: 'transparent', border: '1px solid var(--accent-gold)', color: 'var(--accent-gold)' }}>Activities</button>
                            <div style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid var(--border-subtle)' }}>
                                <div className="hud-label" style={{ marginBottom: '5px' }}>MY STATUS</div>
                                <div className="status-badge go" style={{ display: 'flex', marginBottom: '10px', width: '100%', justifyContent: 'center', padding: '10px', background: 'var(--bg-input)' }}>CLOCKED IN</div>
                                <button className="btn-action btn-urgent" onClick={handleClockOut}>Clock Out</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
          )}

          {/* APPROVALS VIEW */}
          {hasClockedIn && activeSection === 'timesheets' && (
            <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%' }}>
              <div className="section-title" style={{ justifyContent: 'space-between', background: 'rgba(0,0,0,0.2)', padding: '20px' }}>
                <span>Pending Timesheet Approvals</span>
                <span className="status-badge go" style={{ background: 'var(--bg-input)', padding: '5px 15px' }}>{timesheets.length} Submissions</span>
              </div>
              <div className="table-container" style={{ padding: '10px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px', alignContent: 'start', overflowY: 'auto' }}>
                {tsLoading ? (
                  <div style={{ color: 'var(--text-muted)', gridColumn: '1 / -1', textAlign: 'center' }}>Loading Approvals...</div>
                ) : timesheets.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', gridColumn: '1 / -1', textAlign: 'center', marginTop: '40px' }}>All caught up! No pending submissions found.</div>
                ) : (
                  timesheets.map((ts) => {
                    const cardId = `${ts.user_id}_${ts.date}`;
                    const isExpanded = expandedCard === cardId;
                    return (
                      <div key={cardId} className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '1.2rem', color: 'var(--text-main)' }}>{ts.employee_name}</div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--accent-gold)', fontFamily: 'var(--font-mono)' }}>{ts.date}</div>
                          </div>
                          <div className="status-badge" style={{ background: 'rgba(0,0,0,0.3)', color: 'var(--accent-cyan)', fontSize: '1rem', padding: '8px 12px' }}>{ts.total_hours.toFixed(2)} hrs</div>
                        </div>
                        <div style={{ display: 'flex', gap: '15px', fontSize: '0.85rem' }}>
                          <span style={{ color: 'var(--text-muted)' }}>📂 {ts.activities.length} Activities</span>
                          <span className={ts.approval_status === 'SUPERVISOR_APPROVED' ? 'tag tag-in' : 'tag tag-out'} style={{ fontSize: '0.7rem' }}>
                            {ts.approval_status === 'SUPERVISOR_APPROVED' ? '✓ SUP. APPROVED' : '⚠ SUP. PENDING'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
                          <button className="btn-view" style={{ flex: 1, borderColor: 'var(--accent-cyan)', color: 'var(--accent-cyan)' }} onClick={() => setExpandedCard(isExpanded ? null : cardId)}>{isExpanded ? 'Hide Details' : 'Details'}</button>
                          <button className="btn-view" style={{ flex: 1, color: 'var(--color-go)', borderColor: 'var(--color-go)' }} onClick={() => setApproveModal({ show: true, tlogIds: ts.activities.map((a: any) => a.tlog_id) })}>Approve</button>
                          <button className="btn-view" style={{ flex: 1, color: 'var(--color-urgent)', borderColor: 'var(--color-urgent)' }} onClick={() => setRejectModal({ show: true, tlogIds: ts.activities.map((a: any) => a.tlog_id), reason: '' })}>Reject</button>
                        </div>
                        {isExpanded && (
                          <div className="fade-in" style={{ marginTop: '10px', paddingTop: '15px', borderTop: '1px solid rgba(255,255,255,0.1)', fontSize: '0.85rem' }}>
                            <div style={{ marginBottom: '10px', fontWeight: 600, color: 'var(--accent-gold)' }}>Activity Breakdown:</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {ts.activities.map((act: any) => (
                                <div key={act.tlog_id} style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '6px' }}>
                                  <span>{act.activity_code} - {act.activity_name}</span><span style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>{act.hours}h</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* CALENDAR VIEW */}
          {hasClockedIn && activeSection === 'calendar' && (
            <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%' }}>
              <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px' }}>
                <div>
                  <h2 style={{ margin: 0, color: 'var(--accent-gold)' }}>Department Schedule</h2>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '5px' }}>
                    {calendarView === 'weekly' ? `Week of ${currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : `Month of ${currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                  <div style={{ background: 'var(--bg-input)', borderRadius: '8px', display: 'flex', overflow: 'hidden' }}>
                    <button onClick={() => setCalendarView('weekly')} style={{ padding: '8px 15px', border: 'none', cursor: 'pointer', background: calendarView === 'weekly' ? 'var(--accent-gold)' : 'transparent', color: calendarView === 'weekly' ? '#000' : 'var(--text-main)', fontWeight: calendarView === 'weekly' ? 700 : 400 }}>Weekly</button>
                    <button onClick={() => setCalendarView('monthly')} style={{ padding: '8px 15px', border: 'none', cursor: 'pointer', background: calendarView === 'monthly' ? 'var(--accent-gold)' : 'transparent', color: calendarView === 'monthly' ? '#000' : 'var(--text-main)', fontWeight: calendarView === 'monthly' ? 700 : 400 }}>Monthly</button>
                  </div>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <button className="btn-view" onClick={() => { const newDate = new Date(currentDate); calendarView === 'weekly' ? newDate.setDate(newDate.getDate() - 7) : newDate.setMonth(newDate.getMonth() - 1); setCurrentDate(newDate); }}>← Prev</button>
                    <button className="btn-view" onClick={() => setCurrentDate(new Date())}>Today</button>
                    <button className="btn-view" onClick={() => { const newDate = new Date(currentDate); calendarView === 'weekly' ? newDate.setDate(newDate.getDate() + 7) : newDate.setMonth(newDate.getMonth() + 1); setCurrentDate(newDate); }}>Next →</button>
                  </div>
                  <button className="btn-action btn-go" onClick={() => setShowScheduleModal(true)}>+ Assign Activity</button>
                </div>
              </div>

              <div className="glass-card" style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
                {calendarView === 'weekly' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '10px', height: '100%' }}>
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => {
                      const dayKeyMap: Record<string, string> = { 'Mon':'monday', 'Tue':'tuesday', 'Wed':'wednesday', 'Thu':'thursday', 'Fri':'friday', 'Sat':'saturday', 'Sun':'sunday' };
                      const dbDayKey = dayKeyMap[day];
                      const shiftsForDay = scheduleData.filter(emp => emp.schedule && emp.schedule[dbDayKey] !== null);

                      return (
                        <div key={day} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '15px', minHeight: '300px' }}>
                          <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px', marginBottom: '10px', textAlign: 'center', fontWeight: 600, color: 'var(--accent-cyan)' }}>{day}</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {schedLoading ? (
                               <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center' }}>Loading...</div>
                            ) : shiftsForDay.length === 0 ? (
                               <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center' }}>No shifts.</div>
                            ) : (
                               shiftsForDay.map(emp => (
                                  <div 
                                    key={emp.user_id} className="glass-card" 
                                    style={{ padding: '10px', margin: 0, cursor: 'pointer', transition: 'all 0.2s', border: '1px solid transparent' }}
                                    onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = 'var(--accent-gold)'; }}
                                    onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'transparent'; }}
                                    onClick={() => setEditShiftModal({ show: true, empId: emp.user_id, empName: emp.name, day: day, currentShift: emp.schedule[dbDayKey].shift_name, newShiftId: "" })}
                                  >
                                     <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{emp.name}</div>
                                     <div style={{ color: 'var(--accent-gold)', fontSize: '0.75rem', marginTop: '4px' }}>{emp.schedule[dbDayKey].shift_name}</div>
                                     <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{emp.schedule[dbDayKey].time}</div>
                                  </div>
                               ))
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-muted)' }}>Monthly view coming soon...</div>
                )}
              </div>
            </div>
          )}

          {/* ANALYTICS VIEW */}
          {hasClockedIn && activeSection === 'analytics' && (
            <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%', overflowY: 'auto' }}>
              {analyticsLoading || !analyticsData ? (
                 <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1, color: 'var(--accent-gold)' }}>Loading Department Analytics...</div>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
                    <div className="hud-card">
                      <div className="hud-bg-icon">📊</div>
                      <div className="hud-label">THIS WEEK</div>
                      <div className="hud-val" style={{ color: 'var(--accent-cyan)' }}>{analyticsData.weeklyHours.toFixed(1)} <span style={{fontSize:'1rem', color:'var(--text-muted)'}}>hrs</span></div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '5px' }}>Target: {analyticsData.targetWeeklyHours} hrs</div>
                    </div>
                    <div className="hud-card">
                      <div className="hud-bg-icon">📅</div>
                      <div className="hud-label">THIS MONTH</div>
                      <div className="hud-val">{analyticsData.monthlyHours.toFixed(1)} <span style={{fontSize:'1rem', color:'var(--text-muted)'}}>hrs</span></div>
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><div style={{ width: '12px', height: '12px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px' }}></div> Target</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'flex-end', flex: 1, gap: '15px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px' }}>
                        {analyticsData.weeklyChart.map((data: any, idx: number) => {
                          const targetHeight = data.target > 0 ? 100 : 0;
                          const actualHeight = data.target > 0 ? Math.min((data.actual / data.target) * 100, 100) : 0;
                          return (
                            <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, gap: '8px', height: '100%' }}>
                              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '4px', height: '100%', width: '100%' }}>
                                <div title={`Target: ${data.target}h`} style={{ height: `${targetHeight}%`, width: '40%', background: 'rgba(255,255,255,0.1)', borderRadius: '4px 4px 0 0', minHeight: '5px' }}></div>
                                <div title={`Actual: ${data.actual.toFixed(1)}h`} style={{ height: `${actualHeight}%`, width: '40%', background: 'var(--accent-cyan)', borderRadius: '4px 4px 0 0', minHeight: '5px', opacity: data.actual === 0 ? 0.3 : 1 }}></div>
                              </div>
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{data.day}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      <div className="glass-card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <div className="section-title" style={{ padding: 0, border: 'none', marginBottom: '15px' }}>Project Status</div>
                        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', overflowX: 'auto', paddingBottom: '5px', borderBottom: '1px solid var(--border-subtle)' }}>
                          {analyticsData.teams.map((team: any) => (
                            <button key={team.team_name} onClick={() => setActiveProjectTab(team.team_name)} className="btn-view" style={{ background: activeProjectTab === team.team_name ? 'var(--accent-gold)' : 'transparent', color: activeProjectTab === team.team_name ? '#000' : 'var(--text-main)', border: 'none', padding: '8px 16px', fontWeight: activeProjectTab === team.team_name ? 700 : 400 }}>{team.team_name}</button>
                          ))}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto', flex: 1 }}>
                          {(() => {
                            const currentTeam = analyticsData.teams.find((t: any) => t.team_name === activeProjectTab);
                            if (!currentTeam || !currentTeam.projects || currentTeam.projects.length === 0) return <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '20px' }}>No Project</div>;
                            return currentTeam.projects.map((project: any) => (
                              <div key={project.id}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                  <span style={{ fontWeight: 600 }}>{project.name}</span><span style={{ color: 'var(--accent-gold)' }}>{project.hours.toFixed(1)}h logged</span>
                                </div>
                                <div style={{ height: '8px', background: 'rgba(0,0,0,0.3)', borderRadius: '4px', overflow: 'hidden' }}><div style={{ height: '100%', width: `${project.progress}%`, background: 'var(--accent-gold)' }}></div></div>
                              </div>
                            ));
                          })()}
                        </div>
                      </div>

                      <div className="glass-card" style={{ background: 'rgba(0, 210, 106, 0.05)', borderColor: 'rgba(0, 210, 106, 0.2)' }}>
                        <div className="section-title" style={{ padding: 0, border: 'none', marginBottom: '15px', color: 'var(--color-go)' }}>Generate Reports</div>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '15px' }}>Export historical hours and activity data.</p>
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <select className="input-rounded" style={{ flex: 1, padding: '10px', backgroundColor: '#1e1e1e', color: '#ffffff', border: '1px solid var(--border-subtle)' }} value={reportTarget} onChange={(e) => setReportTarget(e.target.value)}>
                              <option value="ALL" style={{ backgroundColor: '#1e1e1e', color: '#ffffff' }}>All Direct Reports</option>
                              {roster.map(emp => ( <option key={`report-${emp.user_id}`} value={emp.user_id} style={{ backgroundColor: '#1e1e1e', color: '#ffffff' }}>{emp.name}</option> ))}
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
      </main>

      {/* --- ALL MODALS --- */}
      
      {/* SETTINGS & PASSWORD CHANGE MODAL */}
      {showSettingsModal && (
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
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px' }}>Update your account password using identity verification.</div>
                          <button className="btn-action btn-standard" onClick={handleStartPasswordChange} style={{ alignSelf: 'flex-start' }} disabled={pwLoading}>
                              {pwLoading ? "Loading..." : "Update Password"}
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
                                  style={{ width: '45px', height: '55px', textAlign: 'center', fontSize: '1.5rem', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-main)', borderRadius: '8px' }}
                              />
                          ))}
                      </div>

                      {pwError && <div style={{ color: 'var(--color-urgent)', fontSize: '0.85rem', textAlign: 'center' }}>{pwError}</div>}
                      
                      <button className="btn-action btn-go" onClick={handleVerifyOtp} disabled={pwLoading || otp.join('').length < 6}>
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
                          type="text" placeholder="Your Answer" className="input-rounded"
                          value={secAnswer} onChange={(e) => setSecAnswer(e.target.value)}
                      />

                      {pwError && <div style={{ color: 'var(--color-urgent)', fontSize: '0.85rem', textAlign: 'center' }}>{pwError}</div>}

                      <button className="btn-action btn-go" onClick={handleAnswerQuestion} disabled={pwLoading || !secAnswer.trim()}>
                          {pwLoading ? "Verifying..." : "Submit Answer"}
                      </button>
                  </div>
              )}

              {/* STEP 3: NEW PASSWORD */}
              {pwStep === 3 && (
                  <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                      <h4 style={{ color: 'var(--accent-gold)' }}>Create New Password</h4>
                      
                      <input 
                          type="password" placeholder="New Password" className="input-rounded"
                          value={newPassword} onChange={(e) => setNewPassword(e.target.value.slice(0,20))}
                      />
                      <input 
                          type="password" placeholder="Confirm Password" className="input-rounded"
                          value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value.slice(0,20))}
                      />

                      <div style={{ fontSize: '0.75rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: 'var(--bg-input)', padding: '15px', borderRadius: '8px' }}>
                          <div style={{ color: pwValidation.lengthOk ? 'var(--color-go)' : 'var(--text-muted)' }}>• 15-20 characters</div>
                          <div style={{ color: pwValidation.upperOk ? 'var(--color-go)' : 'var(--text-muted)' }}>• Uppercase letter</div>
                          <div style={{ color: pwValidation.lowerOk ? 'var(--color-go)' : 'var(--text-muted)' }}>• Lowercase letter</div>
                          <div style={{ color: pwValidation.numberOk ? 'var(--color-go)' : 'var(--text-muted)' }}>• Number</div>
                          <div style={{ color: pwValidation.symbolOk ? 'var(--color-go)' : 'var(--text-muted)' }}>• Symbol (! @ ? _ -)</div>
                          <div style={{ color: passwordsMatch ? 'var(--color-go)' : 'var(--text-muted)' }}>• Passwords match</div>
                      </div>

                      {pwError && <div style={{ color: 'var(--color-urgent)', fontSize: '0.85rem', textAlign: 'center' }}>{pwError}</div>}

                      <button className="btn-action btn-go" onClick={handleResetPassword} disabled={pwLoading || !pwValidation.strongOk || !passwordsMatch}>
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
      )}

      {/* 1. APPROVE TIMESHEET CONFIRMATION MODAL */}
      {approveModal.show && (
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
      )}

      {/* 2. REJECT TIMESHEET REASON MODAL */}
      {rejectModal.show && (
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
                    <label className="hud-label" style={{marginBottom:'5px', display:'block'}}>Reason (Letters, numbers, and .,?! only)</label>
                    <textarea 
                        className="input-rounded" rows={4}
                        style={{ width: '100%', resize: 'none', background: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border-subtle)', padding: '15px', borderRadius: '8px' }}
                        value={rejectModal.reason}
                        onChange={(e) => setRejectModal({...rejectModal, reason: e.target.value})}
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
      )}

      {/* 3. REJECT TIMESHEET CONFIRMATION MODAL */}
      {rejectConfirmModal && (
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
      )}

      {/* 4. EDIT SHIFT MODAL */}
      {editShiftModal.show && (
        <div className="modal-overlay">
            <div className="modal-card">
                <div className="modal-header">
                    <span className="modal-title" style={{ color: 'var(--accent-gold)' }}>Edit Shift</span>
                    <span onClick={() => setEditShiftModal({ ...editShiftModal, show: false })} style={{ cursor: 'pointer' }}>✕</span>
                </div>
                <div className="modal-body">
                    <p style={{ color: 'var(--text-muted)', marginBottom: '15px', fontSize: '0.9rem' }}>
                        Updating schedule for <strong style={{color: 'var(--text-main)'}}>{editShiftModal.empName}</strong> on <strong>{editShiftModal.day}</strong>.
                    </p>
                    
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px', marginBottom: '15px' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Current Shift</div>
                        <div style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>{editShiftModal.currentShift}</div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <label className="hud-label" style={{ marginBottom: '-5px' }}>Assign New Shift</label>
                        <select 
                            className="input-rounded" 
                            style={{ width: '100%', padding: '10px', backgroundColor: '#1e1e1e', color: '#ffffff', border: '1px solid var(--border-subtle)' }}
                            value={editShiftModal.newShiftId}
                            onChange={(e) => setEditShiftModal({...editShiftModal, newShiftId: e.target.value})}
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
      )}

      {/* 5. SHIFT SAVE CONFIRMATION MODAL */}
      {saveShiftConfirmModal && (
          <div className="modal-overlay" style={{ zIndex: 9999 }}>
            <div className="modal-card" style={{ maxWidth: '400px', textAlign: 'center' }}>
              <div className="modal-body" style={{ padding: '30px 20px' }}>
                <div style={{ fontSize: '3rem', marginBottom: '15px', color: 'var(--accent-gold)' }}>⚠️</div>
                <h3 style={{ color: 'var(--text-main)', marginBottom: '10px' }}>Confirm Shift Change</h3>
                <p style={{ color: 'var(--text-muted)' }}>
                  Are you sure you want to change the shift for <strong style={{color:'var(--text-main)'}}>{editShiftModal.empName}</strong> on <strong>{editShiftModal.day}</strong>?
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
      )}

      {/* 6. LOGOUT CONFIRMATION MODAL */}
      {logoutModal && (
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
      )}

      {/* OTHER EXISTING MODALS (Schedule Override, Activity) */}
      {showScheduleModal && (
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
                    
                    <div style={{ display:'flex', flexDirection:'column', gap:'15px' }}>
                        <div style={{ position: 'relative' }}>
                            <label className="hud-label" style={{marginBottom:'5px', display:'block'}}>Search Employee</label>
                            <input 
                                type="text" 
                                className="input-rounded" 
                                placeholder="Type name (e.g. John)..." 
                                value={selectedEmp ? `${selectedEmp.first_name} ${selectedEmp.last_name}` : schedSearch}
                                onChange={(e) => {
                                    setSchedSearch(e.target.value);
                                    setSelectedEmp(null); 
                                }}
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

                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                            <div>
                                <label className="hud-label" style={{marginBottom:'5px', display:'block'}}>Date</label>
                                <input type="date" className="input-rounded" value={schedForm.date} onChange={(e) => setSchedForm({...schedForm, date: e.target.value})} />
                            </div>
                            <div>
                                <label className="hud-label" style={{marginBottom:'5px', display:'block'}}>Time Slot (Start - End)</label>
                                <div style={{ display:'flex', gap:'5px' }}>
                                    <input type="time" className="input-rounded" value={schedForm.start} onChange={(e) => setSchedForm({...schedForm, start: e.target.value})} />
                                    <input type="time" className="input-rounded" value={schedForm.end} onChange={(e) => setSchedForm({...schedForm, end: e.target.value})} />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="hud-label" style={{marginBottom:'5px', display:'block'}}>Assigned Task</label>
                            <input type="text" className="input-rounded" placeholder="e.g. Emergency Room Support" value={schedForm.task} onChange={(e) => setSchedForm({...schedForm, task: e.target.value})} />
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
      )}

      {showActivityModal && (
        <div className="modal-overlay">
            <div className="modal-card">
                <div className="modal-header">
                    <span className="modal-title" style={{ color: 'var(--accent-gold)' }}>Manage Activities</span>
                    <span onClick={() => setShowActivityModal(false)} style={{ cursor: 'pointer' }}>✕</span>
                </div>
                <div className="modal-body">
                    <div style={{ display: 'flex', gap: '10px' }}>
                         <input type="text" className="input-rounded" placeholder="New Activity Code" />
                         <button className="btn-view" style={{ color: 'var(--color-go)', borderColor: 'var(--color-go)' }}>Add</button>
                    </div>
                </div>
                <div className="modal-footer">
                    <button className="btn-view" style={{ width: '100%', padding: '12px', fontSize: '1rem' }} onClick={() => setShowActivityModal(false)}>Done</button>
                </div>
            </div>
        </div>
      )}

    </div>
  );
}