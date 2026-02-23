'use client';

import { useState, useEffect, useRef } from 'react';
import '../../styles/dashboard.css';
import '../../styles/supervisor.css';
import SupervisorScheduleManagement from '@/app/components/SupervisorScheduleManagement';
import TeamStatusMonitor from '@/app/components/TeamStatusMonitor';

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
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedTimesheet, setSelectedTimesheet] = useState<any>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [weekOffset, setWeekOffset] = useState(0);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeSection === 'approval') {
      loadApprovals();
    }
  }, [activeSection]);

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
    try {
      const res = await fetch('/api/supervisor/approvals/list');
      if (res.ok) {
        setApprovals(await res.json());
      }
    } catch (err) {
      console.error("Failed to load approvals", err);
    }
  };

  const handleApprovalAction = async (log_ids: number[], action: 'APPROVE' | 'REJECT', reason?: string) => {
    try {
      const res = await fetch('/api/supervisor/approvals/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ log_ids, action, rejection_reason: reason })
      });
      if (res.ok) {
        loadApprovals();
        loadStats();
      }
    } catch (err) {
      console.error("Failed to process approval", err);
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
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (res.ok) {
        window.location.href = '/';
      }
    } catch (err) {
      console.error('Logout failed', err);
    }
  };

  const [userProfile, setUserProfile] = useState({
    name: 'Loading...',
    role: ' Supervisor',
    initials: '...'
  });

  // For showing temporary messages in settings
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
      console.log('Loading stats with offset:', offset);
      const res = await fetch(`/api/supervisor/stats?weekOffset=${offset}`);
      if (res.ok) {
        const data = await res.json();
        console.log('Stats loaded:', data);
        setStats(data);
      } else {
        console.error('Failed to load stats:', res.status, await res.text());
      }
    } catch (err) {
      console.error("Failed to load supervisor stats", err);
    }
  };

  useEffect(() => {
    loadStats(weekOffset);
    const interval = setInterval(() => loadStats(weekOffset), 30000);
    return () => clearInterval(interval);
  }, [weekOffset]);

  const handleRefreshNow = () => {
    loadStats(weekOffset);
    if (activeSection === 'approval') {
      loadApprovals();
    }
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

            {/* Profile Dropdown Menu */}
            {showProfileMenu && (
              <div className="profile-dropdown">
                <button className="dropdown-item" onClick={(e) => { e.stopPropagation(); handleLogout(); }}>
                  <span>🚪</span> Logout
                </button>
              </div>
            )}
          </div>
        </aside>

        <main className="workspace-panel">
          <div className="top-bar" style={{ position: 'absolute', top: 20, right: 30, padding: 0, zIndex: 10, display: 'flex', gap: '10px' }}>
            <button 
              className="theme-btn" 
              onClick={handleRefreshNow} 
              title="Refresh Data" 
              style={{ width: 32, height: 32, fontSize: '1rem' }}
            >
              🔄
            </button>
            <button className="theme-btn" onClick={toggleTheme} title="Toggle Theme" style={{ width: 32, height: 32, fontSize: '1rem' }}>
              {lightMode ? '☀' : '🌙'}
            </button>
          </div>

          <div className="content-area">
            {activeSection === 'team' && (
              <div className="section-view fade-in">
                <div className="section-animate">
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
                              <span className="stat-label">Total Time</span>
                              <span className="stat-value">{formatHoursToHHMM(timesheet.hours)}</span>
                            </div>
                            <div className="stat-item">
                              <span className="stat-label">Activities</span>
                              <span className="stat-value">{timesheet.activities}</span>
                            </div>
                          </div>
                          <div className="approval-actions">
                            <button className="btn-view" onClick={() => openDetailsModal(timesheet)}>View Details</button>
                            <button className="btn-approve" onClick={() => handleApprovalAction(timesheet.log_ids, 'APPROVE')}>✓ Approve</button>
                            <button className="btn-reject" onClick={() => openRejectModal(timesheet)}>✗ Reject</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'schedule' && (
              <div className="section-view active fade-in">
                <div className="section-animate">
                  <SupervisorScheduleManagement />
                </div>
              </div>
            )}

            {activeSection === 'analytics' && (
              <div className="section-view active fade-in">
                <div className="section-animate">
                  {/* Top Three Panels - Improved Alignment */}
                  <div className="analytics-top-row">
                    <div className="analytics-card">
                      <div className="analytics-icon">📊</div>
                      <div className="analytics-content">
                        <div className="analytics-label">TEAM HOURS (WEEK)</div>
                        <div className="analytics-value accent-cyan">{stats.teamPerformance?.weeklyTotal || '0.0'}</div>
                        <div className="analytics-sub">Total Hours Logged</div>
                      </div>
                    </div>
                    <div className="analytics-card">
                      <div className="analytics-icon">📈</div>
                      <div className="analytics-content">
                        <div className="analytics-label">AVG HOURS/PERSON</div>
                        <div className="analytics-value">{stats.teamPerformance?.avgPerPerson || '0.0'}</div>
                        <div className="analytics-sub">Per Team Member</div>
                      </div>
                    </div>
                    <div className="analytics-card">
                      <div className="analytics-icon">🎯</div>
                      <div className="analytics-content">
                        <div className="analytics-label">PRODUCTIVITY RATE</div>
                        <div className="analytics-value success">{stats.teamPerformance?.productivity || '0%'}</div>
                        <div className="analytics-sub">Overall Efficiency</div>
                      </div>
                    </div>
                  </div>

                  {/* Team Performance Graph */}
                  <div className="glass-card">
                    <div className="section-title">
                      <span>Team Performance Overview</span>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button 
                          className="week-nav-btn" 
                          onClick={() => setWeekOffset(weekOffset - 1)}
                          title="Previous Week"
                        >
                          ← Prev Week
                        </button>
                        <button 
                          className="week-nav-btn" 
                          onClick={() => setWeekOffset(0)}
                          disabled={weekOffset === 0}
                          title="Current Week"
                        >
                          Current Week
                        </button>
                        <button 
                          className="week-nav-btn" 
                          onClick={() => setWeekOffset(weekOffset + 1)}
                          disabled={weekOffset >= 0}
                          title="Next Week"
                        >
                          Next Week →
                        </button>
                      </div>
                    </div>
                    <div className="graph-container">
                      {!stats.graphData || stats.graphData.length === 0 ? (
                        <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>
                          Loading graph data...
                          <div style={{ fontSize: '0.85rem', marginTop: '10px' }}>If this persists, check console for errors</div>
                        </div>
                      ) : stats.graphData.map((day, i) => (
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
                                position: 'absolute',
                                top: '-25px',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                color: 'var(--accent-primary)',
                                whiteSpace: 'nowrap'
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
                  <div className="glass-card" style={{ marginTop: '1.5rem' }}>
                    <div className="section-title">Team Member Compliance</div>
                    <div className="compliance-info" style={{ 
                      padding: '1rem', 
                      marginBottom: '1rem',
                      background: 'rgba(167, 139, 250, 0.1)',
                      border: '1px solid rgba(167, 139, 250, 0.3)',
                      borderRadius: '8px',
                      color: 'var(--text-main)',
                      fontSize: '0.9rem'
                    }}>
                      <strong>Daily Limit:</strong> 8 hours per day | <strong>Weekly Limit:</strong> 40 hours per week
                    </div>
                    <div className="table-container" style={{ maxHeight: '400px' }}>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Employee</th>
                            <th>Today's Hours</th>
                            <th>Daily Limit</th>
                            <th>Status</th>
                            <th>Weekly Total</th>
                            <th>Weekly Limit</th>
                            <th>Compliance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stats.totalMembers > 0 ? (
                            // Placeholder data - In production, this would come from API
                            Array.from({ length: Math.min(stats.totalMembers, 5) }, (_, i) => {
                              const todayHours = (Math.random() * 10).toFixed(1);
                              const weeklyHours = (parseFloat(todayHours) * 5 + Math.random() * 5).toFixed(1);
                              const isOverDaily = parseFloat(todayHours) > 8;
                              const isOverWeekly = parseFloat(weeklyHours) > 40;
                              
                              return (
                                <tr key={i}>
                                  <td style={{ fontWeight: 600 }}>Team Member {i + 1}</td>
                                  <td style={{ fontFamily: 'var(--font-mono)' }}>{todayHours} hrs</td>
                                  <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>8.0 hrs</td>
                                  <td>
                                    <span className={`status-badge ${isOverDaily ? 'warn' : 'ok'}`}>
                                      {isOverDaily ? '⚠ OVERTIME' : '✓ OK'}
                                    </span>
                                  </td>
                                  <td style={{ fontFamily: 'var(--font-mono)' }}>{weeklyHours} hrs</td>
                                  <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>40.0 hrs</td>
                                  <td>
                                    <div className="compliance-bar">
                                      <div 
                                        className={`compliance-fill ${isOverWeekly ? 'over' : 'ok'}`}
                                        style={{ width: `${Math.min((parseFloat(weeklyHours) / 40) * 100, 100)}%` }}
                                      />
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                                No team members to display
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'settings' && (
              <div className="section-view active fade-in">
                <div className="section-animate">
                  {/* Profile Settings Card */}
                  <div className="glass-card" style={{ marginBottom: '1.5rem' }}>
                    <div className="section-title">Profile Settings</div>
                    
                    <div className="settings-section">
                      <div className="settings-header">
                        <div>
                          <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.25rem' }}>Change Password</h4>
                          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Update your account password</p>
                        </div>
                        <button 
                          className="btn-settings-action"
                          onClick={() => window.location.href = '/auth/change-password'}
                        >
                          🔑 Change Password
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Appearance Settings Card */}
                  <div className="glass-card" style={{ marginBottom: '1.5rem' }}>
                    <div className="section-title">Appearance</div>
                    
                    <div className="settings-row">
                      <div>
                        <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Theme Mode</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          Switch between light and dark theme
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

                    <div className="settings-row">
                      <div>
                        <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Lock Theme</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          Prevent theme from changing accidentally
                        </div>
                      </div>
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          onChange={(e) => {
                            try {
                              localStorage.setItem("orasync-theme-locked", e.target.checked ? "true" : "false");
                              if (e.target.checked) {
                                setMessage('Theme locked. Unlock to change theme.');
                                setTimeout(() => setMessage(''), 3000);
                              }
                            } catch { }
                          }}
                        />
                        <span className="slider"></span>
                      </label>
                    </div>
                    {message && (
                      <div style={{ marginTop: '1rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
                        {message}
                      </div>
                    )}
                  </div>

                  {/* Notification Settings Card */}
                  <div className="glass-card" style={{ marginBottom: '1.5rem' }}>
                    <div className="section-title">Notifications</div>
                    
                    <div className="settings-row">
                      <div>
                        <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Email Notifications</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          Receive email alerts for important events
                        </div>
                      </div>
                      <label className="toggle-switch">
                        <input type="checkbox" defaultChecked />
                        <span className="slider"></span>
                      </label>
                    </div>

                    <div className="settings-row">
                      <div>
                        <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Timesheet Reminders</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          Get notified about pending timesheet approvals
                        </div>
                      </div>
                      <label className="toggle-switch">
                        <input type="checkbox" defaultChecked />
                        <span className="slider"></span>
                      </label>
                    </div>
                  </div>

                  {/* Workflow Settings Card */}
                  <div className="glass-card">
                    <div className="section-title">Workflow Automation</div>
                    
                    <div className="settings-row">
                      <div>
                        <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Auto-Approve Under 8 Hours</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          Automatically approve timesheets with less than 8 hours
                        </div>
                      </div>
                      <label className="toggle-switch">
                        <input type="checkbox" />
                        <span className="slider"></span>
                      </label>
                    </div>

                    <div className="settings-row">
                      <div>
                        <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Require Notes for Overtime</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          Team members must add notes when logging overtime
                        </div>
                      </div>
                      <label className="toggle-switch">
                        <input type="checkbox" defaultChecked />
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
                    // Only allow letters, numbers, periods, commas, and spaces
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

      {/* View Details Modal */}
      {showDetailsModal && selectedTimesheet && (
        <div className="modal-overlay-improved" onClick={() => setShowDetailsModal(false)}>
          <div className="modal-card-improved details-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-improved">
              <div className="modal-icon-wrapper view-icon">👁</div>
              <div className="modal-title-improved">Timesheet Details</div>
              <div className="modal-subtitle">Complete breakdown of work activities</div>
            </div>
            <div className="modal-body-improved">
              <div className="details-grid">
                <div className="detail-card-improved">
                  <div className="detail-icon">👤</div>
                  <div className="detail-content">
                    <div className="detail-label-improved">Employee</div>
                    <div className="detail-value-improved">{selectedTimesheet.employee}</div>
                  </div>
                </div>
                <div className="detail-card-improved">
                  <div className="detail-icon">📅</div>
                  <div className="detail-content">
                    <div className="detail-label-improved">Date</div>
                    <div className="detail-value-improved">{selectedTimesheet.date}</div>
                  </div>
                </div>
                <div className="detail-card-improved">
                  <div className="detail-icon">⏱</div>
                  <div className="detail-content">
                    <div className="detail-label-improved">Total Hours</div>
                    <div className="detail-value-improved">{selectedTimesheet.hours.toFixed(2)} hrs</div>
                  </div>
                </div>
                <div className="detail-card-improved">
                  <div className="detail-icon">📋</div>
                  <div className="detail-content">
                    <div className="detail-label-improved">Activities</div>
                    <div className="detail-value-improved">{selectedTimesheet.activities}</div>
                  </div>
                </div>
              </div>
              {selectedTimesheet.details && selectedTimesheet.details.length > 0 && (
                <div className="activity-breakdown">
                  <h4 className="breakdown-title">Activity Breakdown</h4>
                  <div className="activity-list-improved">
                    {selectedTimesheet.details.map((detail: any, idx: number) => (
                      <div key={idx} className="activity-item-improved">
                        <div className="activity-header">
                          <div className="activity-name">{detail.activity_name}</div>
                          {detail.is_billable && (
                            <span className="badge-billable">💰 Billable</span>
                          )}
                        </div>
                        <div className="activity-time">
                          <span className="time-badge">📅 {detail.log_date}</span>
                          <span className="time-badge">🕐 {detail.start_time}</span>
                          <span className="time-arrow">→</span>
                          <span className="time-badge">🕐 {detail.end_time}</span>
                          <span className="duration-badge">{detail.hours} hrs</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="modal-actions-improved">
              <button className="btn-improved btn-primary" onClick={() => setShowDetailsModal(false)}>
                <span>✓</span> Close
              </button>
            </div>
          </div>
        </div>
      )}

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

        .modal-card-improved {
          background: #232136;
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

        .modal-card-improved.rejection-modal {
          max-width: 550px;
        }

        .modal-card-improved.details-modal {
          max-width: 750px;
          background: #232136;
        }

        .modal-header-improved {
          padding: 30px 30px 20px 30px;
          border-bottom: 1px solid var(--border-subtle);
          text-align: center;
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
