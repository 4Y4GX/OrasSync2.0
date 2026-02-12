'use client';

import { useState, useEffect } from 'react';
import '../../styles/dashboard.css';
import '../../styles/supervisor.css';
import SupervisorScheduleManagement from '@/app/components/SupervisorScheduleManagement';
import TeamStatusMonitor from '@/app/components/TeamStatusMonitor';

export default function SupervisorDashboard() {
  const [activeSection, setActiveSection] = useState('team');
  const [lightMode, setLightMode] = useState(false);
  const [stats, setStats] = useState({
    totalMembers: 0,
    currentlyWorking: 0,
    totalHours: '0.0',
    offline: 0,
    graphData: [] as { day: string; hours: string; percentage: number }[],
    teamPerformance: {
      weeklyTotal: '0.0',
      avgPerPerson: '0.0',
      productivity: '0%'
    }
  });

  const [approvals, setApprovals] = useState<any[]>([]);

  useEffect(() => {
    if (activeSection === 'approval') {
      loadApprovals();
    }
  }, [activeSection]);

  const loadApprovals = async () => {
    try {
      const res = await fetch('/api/supervisor/approvals/list');
      if (res.ok) {
        setApprovals(await res.json());
      }
    } catch (err) {
      console.error("Failed to load approvals", err);
    }
  };

  const handleApprovalAction = async (log_ids: number[], action: 'APPROVE' | 'REJECT') => {
    try {
      const res = await fetch('/api/supervisor/approvals/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ log_ids, action })
      });
      if (res.ok) {
        loadApprovals(); // Refresh list
        // Optionally update stats too
      }
    } catch (err) {
      console.error("Failed to process approval", err);
    }
  };

  const [userProfile, setUserProfile] = useState({
    name: 'Loading...',
    role: ' Supervisor',
    initials: '...'
  });

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

  // Set body background to match employee dashboard
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

  useEffect(() => {
    async function loadStats() {
      try {
        const res = await fetch('/api/supervisor/stats');
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (err) {
        console.error("Failed to load supervisor stats", err);
      }
    }
    loadStats();
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <div className={`split-layout supervisor-theme ${lightMode ? 'light-mode' : ''}`}>
        <div className="tech-mesh" />
        {/* Sidebar — mirrors Employee layout */}
        <aside className="info-panel">
          <div className="bg-decor bg-sq-outline sq-top-left" />
          <div className="bg-decor bg-sq-outline sq-mid-left" />
          <div className="bg-decor bg-sq-solid sq-bot-left" />

          <div className="brand-logo">ORASync</div>

          <ul className="nav-links">
            <li
              className={`nav-item ${activeSection === 'team' ? 'active' : ''}`}
              onClick={() => setActiveSection('team')}
            >
              Team Overview
            </li>
            <li
              className={`nav-item ${activeSection === 'approval' ? 'active' : ''}`}
              onClick={() => setActiveSection('approval')}
            >
              Timesheet Approval
            </li>
            <li
              className={`nav-item ${activeSection === 'schedule' ? 'active' : ''}`}
              onClick={() => setActiveSection('schedule')}
            >
              Team Schedule
            </li>
            <li
              className={`nav-item ${activeSection === 'analytics' ? 'active' : ''}`}
              onClick={() => setActiveSection('analytics')}
            >
              Team Analytics
            </li>
            <li
              className={`nav-item ${activeSection === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveSection('settings')}
            >
              Settings
            </li>
          </ul>

          <div className="widget-box">
            <div className="label-sm">Pending Approvals</div>
            <div className="status-badge warn">
              <span className="dot" />
              <span style={{ marginLeft: 8 }}>8 PENDING</span>
            </div>
          </div>

          <div className="profile-card">
            <div className="streak-badge">👔 {userProfile.role.toUpperCase()}</div>
            <div className="avatar">{userProfile.initials}</div>
            <div className="profile-info">
              <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-main)' }}>{userProfile.name}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{userProfile.role}</div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="workspace-panel">
          <div className="top-bar" style={{ position: 'absolute', top: 20, right: 30, padding: 0, zIndex: 10 }}>
            <button className="theme-btn" onClick={toggleTheme} title="Toggle Theme" style={{ width: 32, height: 32, fontSize: '1rem' }}>
              {lightMode ? '☀' : '🌙'}
            </button>
          </div>

          <div className="content-area">
            {/* Team Overview */}
            {activeSection === 'team' && (
              <div className="section-view fade-in">
                <div className="section-animate">
                  {/* HUD Stats Row — matches Employee .hud-row/.hud-card pattern */}
                  <div className="hud-row">
                    <div className="hud-card">
                      <div className="hud-bg-icon">👥</div>
                      <div className="hud-label">TEAM MEMBERS</div>
                      <div className="hud-val">{stats.totalMembers}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 5, textTransform: 'uppercase', letterSpacing: 2 }}>
                        ACTIVE EMPLOYEES
                      </div>
                    </div>
                    <div className="hud-card">
                      <div className="hud-bg-icon">⚡</div>
                      <div className="hud-label">CURRENTLY WORKING</div>
                      <div className="hud-val">{stats.currentlyWorking}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 5 }}>
                        Clocked In Today
                      </div>
                    </div>
                    <div className="hud-card">
                      <div className="hud-bg-icon">🔥</div>
                      <div className="hud-label">TOTAL HOURS TODAY</div>
                      <div className="hud-val warn">{stats.totalHours}</div>
                      <div className="status-badge warn" style={{ marginTop: 5, alignSelf: 'flex-start', fontSize: '0.7rem' }}>
                        Team Hours
                      </div>
                    </div>
                    <div className="hud-card">
                      <div className="hud-bg-icon">💤</div>
                      <div className="hud-label">OFFLINE</div>
                      <div className="hud-val" style={{ color: 'var(--text-muted)' }}>{stats.offline}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 5, textTransform: 'uppercase', letterSpacing: 2 }}>
                        NOT CLOCKED IN
                      </div>
                    </div>
                  </div>

                  <TeamStatusMonitor />
                </div>
              </div>
            )}

            {/* Timesheet Approval */}
            {activeSection === 'approval' && (
              <div className="section-view active fade-in">
                <div className="section-animate">
                  <div className="glass-card">
                    <div className="section-title">
                      <span>Pending Timesheet Approvals</span>
                      <span style={{ color: 'var(--color-warn)', fontSize: '1rem' }}>{approvals.length} Waiting</span>
                    </div>
                    <div className="approval-grid">
                      {approvals.length === 0 ? (
                        <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                          No pending approvals found.
                        </div>
                      ) : approvals.map((timesheet, i) => (
                        <div key={i} className="approval-card">
                          <div className="approval-header">
                            <div>
                              <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{timesheet.employee}</div>
                              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Date: {timesheet.date}</div>
                            </div>
                            <div className="approval-badge pending">PENDING</div>
                          </div>
                          <div className="approval-stats">
                            <div className="stat-item">
                              <span className="stat-label">Total Hours</span>
                              <span className="stat-value">{timesheet.hours.toFixed(1)}</span>
                            </div>
                            <div className="stat-item">
                              <span className="stat-label">Activities</span>
                              <span className="stat-value">{timesheet.activities}</span>
                            </div>
                          </div>
                          <div className="approval-actions">
                            <button className="btn-approve" onClick={() => handleApprovalAction(timesheet.log_ids, 'APPROVE')}>✓ Approve</button>
                            <button className="btn-reject" onClick={() => handleApprovalAction(timesheet.log_ids, 'REJECT')}>✗ Reject</button>
                            <button className="btn-view">View Details</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Team Schedule */}
            {activeSection === 'schedule' && (
              <div className="section-view active fade-in">
                <div className="section-animate">
                  <SupervisorScheduleManagement />
                </div>
              </div>
            )}

            {/* Team Analytics */}
            {activeSection === 'analytics' && (
              <div className="section-view active fade-in">
                <div className="section-animate">
                  <div className="hud-row">
                    <div className="hud-card">
                      <div className="hud-bg-icon">📊</div>
                      <div className="hud-label">TEAM HOURS (WEEK)</div>
                      <div className="hud-val accent-cyan">{stats.teamPerformance?.weeklyTotal || '0.0'}</div>
                    </div>
                    <div className="hud-card">
                      <div className="hud-bg-icon">📈</div>
                      <div className="hud-label">AVG HOURS/PERSON</div>
                      <div className="hud-val">{stats.teamPerformance?.avgPerPerson || '0.0'}</div>
                    </div>
                    <div className="hud-card">
                      <div className="hud-bg-icon">🎯</div>
                      <div className="hud-label">PRODUCTIVITY RATE</div>
                      <div className="hud-val" style={{ color: 'var(--color-go)' }}>{stats.teamPerformance?.productivity || '0%'}</div>
                    </div>
                  </div>
                  <div className="glass-card">
                    <div className="section-title">Team Performance Overview</div>
                    <div className="graph-container">
                      {!stats.graphData || stats.graphData.length === 0 ? (
                        <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>Loading graph data...</div>
                      ) : stats.graphData.map((day, i) => (
                        <div key={day.day} className="bar-group">
                          <div
                            className="bar bar-actual supervisor-bar"
                            style={{ height: `${day.percentage}%` }}
                            title={`${day.hours} hours`}
                          ></div>
                          <div className="bar-label">{day.day}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Settings */}
            {activeSection === 'settings' && (
              <div className="section-view active fade-in">
                <div className="section-animate">
                  <div className="glass-card">
                    <div className="section-title">Supervisor Settings</div>
                    <div className="settings-row">
                      <span>Auto-Approve Under 8 Hours</span>
                      <label className="toggle-switch">
                        <input type="checkbox" />
                        <span className="slider"></span>
                      </label>
                    </div>
                    <div className="settings-row">
                      <span>Email Notifications</span>
                      <label className="toggle-switch">
                        <input type="checkbox" defaultChecked />
                        <span className="slider"></span>
                      </label>
                    </div>
                    <div className="settings-row">
                      <span>Dark Mode</span>
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={lightMode}
                          onChange={toggleTheme}
                        />
                        <span className="slider"></span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
}
