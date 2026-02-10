'use client';

import { useState, useEffect } from 'react';
import '../../styles/manager.css'; 

export default function ManagerDashboard() {
  // --- STATE ---
  const [hasClockedIn, setHasClockedIn] = useState(false);
  const [activeSection, setActiveSection] = useState('dashboard');
  const [lightMode, setLightMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Roster Data State
  const [roster, setRoster] = useState<any[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [teamFilter, setTeamFilter] = useState("all");

  // Modals
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  
  // Clock State
  const [currentTime, setCurrentTime] = useState('');
  const [sessionStart, setSessionStart] = useState<number | null>(null);
  const [sessionDuration, setSessionDuration] = useState('00:00:00');

  // Schedule Assignment State
  const [schedSearch, setSchedSearch] = useState("");
  const [schedResults, setSchedResults] = useState<any[]>([]);
  const [selectedEmp, setSelectedEmp] = useState<any>(null);
  const [schedForm, setSchedForm] = useState({ date: "", start: "", end: "", task: "" });

  // --- 1. INITIAL LOAD (Status & Roster) ---
  useEffect(() => {
    const initDashboard = async () => {
      try {
        // Check Clock Status
        const statusRes = await fetch('/api/manager/clock/in'); 
        if (statusRes.ok) {
          const data = await statusRes.json();
          if (data.isClockedIn) {
            setHasClockedIn(true);
            setSessionStart(new Date(data.startTime).getTime());
          }
        }
        
        // Fetch Roster Data
        setRosterLoading(true);
        const rosterRes = await fetch('/api/manager/roster');
        if (rosterRes.ok) {
          const data = await rosterRes.json();
          setRoster(data.roster || []);
        }
      } catch (e) {
        console.error("Initialization failed", e);
      } finally {
        setIsLoading(false);
        setRosterLoading(false);
      }
    };
    initDashboard();
  }, []);

  // --- 2. TIMERS ---
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
        setSessionDuration(
          `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        );
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [hasClockedIn, sessionStart]);

  // --- 3. SEARCH & FILTER LOGIC ---
  const filteredRoster = roster.filter(emp => {
    const matchesSearch = 
      emp.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      emp.user_id.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesTeam = teamFilter === "all" || emp.team === teamFilter;

    return matchesSearch && matchesTeam;
  });

  // Extract unique teams for the dropdown
  const uniqueTeams = Array.from(new Set(roster.map(r => r.team).filter(Boolean)));

  // --- 4. SCHEDULE SEARCH EFFECT ---
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (schedSearch.length >= 2) {
        try {
          const res = await fetch(`/api/manager/employees/search?q=${schedSearch}`);
          const data = await res.json();
          setSchedResults(data.employees || []);
        } catch (e) { console.error(e); }
      } else {
        setSchedResults([]);
      }
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [schedSearch]);

  // --- HANDLERS ---
  const handleClockIn = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/manager/clock/in', { method: 'POST' });
      const data = await res.json(); 
      if (res.ok) {
        setSessionStart(new Date(data.startTime).getTime());
        setHasClockedIn(true);
      } else {
        alert(`Failed: ${data.message}`); 
      }
    } catch (e) {
      alert("Connection Error.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClockOut = async () => {
    if (!confirm("End Management Session?")) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/manager/clock/out', { method: 'POST' });
      if (res.ok) {
        setHasClockedIn(false);
        setSessionStart(null);
        setSessionDuration('00:00:00');
        window.location.reload(); 
      } else {
        alert("Failed to end session.");
      }
    } catch (e) {
      alert("Connection error.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssignSchedule = async () => {
    if (!selectedEmp || !schedForm.date || !schedForm.start || !schedForm.end) {
      alert("Please fill in all required fields.");
      return;
    }
    
    setIsLoading(true);
    try {
      const res = await fetch('/api/manager/schedule/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId: selectedEmp.user_id,
          date: schedForm.date,
          startTime: schedForm.start,
          endTime: schedForm.end,
          task: schedForm.task
        })
      });

      if (res.ok) {
        alert("Schedule Assigned Successfully!");
        setShowScheduleModal(false);
        setSelectedEmp(null);
        setSchedSearch("");
        setSchedForm({ date: "", start: "", end: "", task: "" });
      } else {
        alert("Failed to assign schedule.");
      }
    } catch (e) {
      alert("Connection error.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleNavClick = (section: string) => {
    if (!hasClockedIn) return;
    setActiveSection(section);
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

      <aside className="info-panel">
        <div className="bg-decor bg-sq-outline sq-top-left"></div>
        <div className="bg-decor bg-sq-solid sq-bot-left"></div>

        <div className="brand-logo">
          ORASYNC 
          <span style={{ fontSize: '0.8rem', color: 'var(--accent-gold)', display: 'block', letterSpacing: '4px', marginTop: '-5px' }}>MANAGER</span>
        </div>

        <ul className="nav-links">
          <li className={`nav-item ${activeSection === 'dashboard' ? 'active' : ''} ${!hasClockedIn ? 'locked' : ''}`} onClick={() => handleNavClick('dashboard')}>Dashboard</li>
          <li className={`nav-item ${activeSection === 'timesheets' ? 'active' : ''} ${!hasClockedIn ? 'locked' : ''}`} onClick={() => handleNavClick('timesheets')}>Approvals (Timesheets)</li>
          <li className={`nav-item ${activeSection === 'calendar' ? 'active' : ''} ${!hasClockedIn ? 'locked' : ''}`} onClick={() => handleNavClick('calendar')}>Schedule / Calendar</li>
          <li className={`nav-item ${activeSection === 'analytics' ? 'active' : ''} ${!hasClockedIn ? 'locked' : ''}`} onClick={() => handleNavClick('analytics')}>Reports / Analytics</li>
        </ul>

        <div className="profile-card">
          <div className="avatar">RM</div>
          <div>
             <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-main)' }}>Robert Manager</div>
             <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>Operations | Lead</div>
             <div className="status-badge go" style={{ fontSize: '0.75rem', marginTop: '8px' }}>🟢 Executive Access</div>
          </div>
        </div>
      </aside>

      <main className="workspace-panel">
        <div className="top-bar">
          <div className="status-badge go"><span className="dot"></span> SYSTEM SECURE</div>
          <button className="theme-btn" onClick={() => setLightMode(!lightMode)}>
            {lightMode ? '☾' : '☀'}
          </button>
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
                
                <p style={{ color: 'var(--text-muted)', marginBottom: '30px' }}>
                  Executive access enabled. Click below to begin session.
                </p>

                <button className="btn-action btn-go" style={{ padding: '20px', fontSize: '1.3rem', boxShadow: '0 0 30px rgba(0, 210, 106, 0.3)' }} onClick={handleClockIn} disabled={isLoading}>
                  {isLoading ? "Starting..." : "CLOCK IN"}
                </button>
              </div>
            </div>
          )}

          {/* ACTIVE DASHBOARD */}
          {hasClockedIn && activeSection === 'dashboard' && (
            <div className="fade-in" style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* HUD */}
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
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '5px' }}>Productivity Target: 6.5 / 8h</div>
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

                {/* WORKSPACE GRID */}
                <div className="workspace-grid">
                    {/* LEFT: ROSTER */}
                    <div className="logs-panel">
                        <div className="section-title" style={{ padding: '20px 25px', margin: 0, border: 'none', background: 'rgba(0,0,0,0.1)', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <span>Department Roster</span>
                                <select 
                                    className="btn-view" 
                                    style={{ marginLeft: '10px' }} 
                                    value={teamFilter}
                                    onChange={(e) => setTeamFilter(e.target.value)}
                                >
                                    <option value="all">View: All Teams</option>
                                    {uniqueTeams.map(t => (
                                        <option key={t} value={t}>{t}</option>
                                    ))}
                                </select>
                            </div>
                            <input 
                                type="text" 
                                placeholder="Search by ID or Name..." 
                                className="btn-view" 
                                style={{ width: '250px', textAlign: 'left', cursor: 'text' }}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className="table-container">
                            {rosterLoading ? (
                                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading Roster...</div>
                            ) : (
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Emp ID</th><th>Name</th><th>Team</th><th>Position</th><th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredRoster.length === 0 && (
                                            <tr><td colSpan={5} style={{textAlign:'center', color:'var(--text-muted)'}}>No employees found.</td></tr>
                                        )}
                                        {filteredRoster.map(emp => (
                                            <tr key={emp.user_id}>
                                                <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-gold)' }}>{emp.user_id}</td>
                                                <td style={{ fontWeight: 700 }}>{emp.name}</td>
                                                <td>{emp.team ? `Team ${emp.team}` : '—'}</td>
                                                <td>
                                                    {emp.role_id === 4 && <span className="tag tag-sup">HEAD</span>} 
                                                    {emp.position || (emp.role_id === 4 ? 'Supervisor' : 'Employee')}
                                                </td>
                                                <td>
                                                    {emp.status === 'in' ? (
                                                        <span className="tag tag-in">Clocked In</span>
                                                    ) : (
                                                        <span className="tag tag-out">Clocked Out</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>

                    {/* RIGHT: CONTROLS */}
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

          {/* Placeholder Views for Other Sections */}
          {hasClockedIn && activeSection !== 'dashboard' && (
              <div className="glass-card fade-in">
                  <h2>{activeSection.charAt(0).toUpperCase() + activeSection.slice(1)} View</h2>
                  <p style={{color:'var(--text-muted)'}}>Coming soon...</p>
              </div>
          )}

        </div>
      </main>

      {/* --- SCHEDULE OVERRIDE MODAL --- */}
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
                        {/* Employee Search */}
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
                            {/* Dropdown Results */}
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

                        {/* Date & Time */}
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                            <div>
                                <label className="hud-label" style={{marginBottom:'5px', display:'block'}}>Date</label>
                                <input 
                                    type="date" 
                                    className="input-rounded" 
                                    value={schedForm.date}
                                    onChange={(e) => setSchedForm({...schedForm, date: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="hud-label" style={{marginBottom:'5px', display:'block'}}>Time Slot (Start - End)</label>
                                <div style={{ display:'flex', gap:'5px' }}>
                                    <input 
                                        type="time" 
                                        className="input-rounded" 
                                        value={schedForm.start}
                                        onChange={(e) => setSchedForm({...schedForm, start: e.target.value})}
                                    />
                                    <input 
                                        type="time" 
                                        className="input-rounded" 
                                        value={schedForm.end}
                                        onChange={(e) => setSchedForm({...schedForm, end: e.target.value})}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Task */}
                        <div>
                            <label className="hud-label" style={{marginBottom:'5px', display:'block'}}>Assigned Task</label>
                            <input 
                                type="text" 
                                className="input-rounded" 
                                placeholder="e.g. Emergency Room Support" 
                                value={schedForm.task}
                                onChange={(e) => setSchedForm({...schedForm, task: e.target.value})}
                            />
                        </div>

                    </div>
                </div>
                <div className="modal-footer">
                    <button className="btn-view" onClick={() => setShowScheduleModal(false)}>Cancel</button>
                    <button 
                        className="btn-action btn-standard" 
                        style={{ width: 'auto', padding: '10px 20px' }}
                        onClick={handleAssignSchedule}
                        disabled={isLoading}
                    >
                        {isLoading ? "Saving..." : "Assign Schedule"}
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* --- ACTIVITY MODAL --- */}
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
                    <button className="btn-view" onClick={() => setShowActivityModal(false)}>Done</button>
                </div>
            </div>
        </div>
      )}

    </div>
  );
}