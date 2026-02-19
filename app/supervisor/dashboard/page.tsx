'use client';

import { useState, useEffect, useRef } from 'react';
import '../../styles/dashboard.css';
import '../../styles/supervisor.css';
import SupervisorScheduleManagement from '@/app/components/SupervisorScheduleManagement';
import TeamStatusMonitor from '@/app/components/TeamStatusMonitor';

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
                            <button className="btn-reject" onClick={() => openRejectModal(timesheet)}>✗ Reject</button>
                            <button className="btn-view" onClick={() => openDetailsModal(timesheet)}>View Details</button>
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
                            {day.hours > 0 && (
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
                </div>
              </div>
            )}

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
                          checked={!lightMode}
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

      {/* Rejection Reason Modal */}
      {showRejectionModal && (
        <div className="modal-overlay" onClick={() => setShowRejectionModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-title">Reject Timesheet</div>
            <div style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>
              Please provide a reason for rejecting this timesheet (required):
            </div>
            <textarea
              className="input-rounded"
              rows={4}
              placeholder="Enter rejection reason..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-input)', color: 'var(--text-main)', resize: 'vertical' }}
            />
            <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
              <button className="modal-btn ghost" onClick={() => setShowRejectionModal(false)}>Cancel</button>
              <button className="modal-btn ok" onClick={handleRejectSubmit}>Submit Rejection</button>
            </div>
          </div>
        </div>
      )}

      {/* View Details Modal */}
      {showDetailsModal && selectedTimesheet && (
        <div className="modal-overlay" onClick={() => setShowDetailsModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px', maxHeight: '80vh', overflow: 'auto' }}>
            <div className="modal-title">Timesheet Details</div>
            <div style={{ marginTop: '1.5rem' }}>
              <div className="detail-row">
                <span className="detail-label">Employee:</span>
                <span className="detail-value">{selectedTimesheet.employee}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Date:</span>
                <span className="detail-value">{selectedTimesheet.date}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Total Hours:</span>
                <span className="detail-value">{selectedTimesheet.hours.toFixed(2)}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Activities:</span>
                <span className="detail-value">{selectedTimesheet.activities}</span>
              </div>
              {selectedTimesheet.details && (
                <div style={{ marginTop: '1.5rem' }}>
                  <h4 style={{ marginBottom: '1rem', color: 'var(--accent-primary)' }}>Activity Breakdown:</h4>
                  <div className="activity-list">
                    {selectedTimesheet.details.map((detail: any, idx: number) => (
                      <div key={idx} className="activity-item">
                        <div style={{ fontWeight: 600 }}>{detail.activity_name}</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          {detail.start_time} - {detail.end_time} ({detail.hours}h)
                        </div>
                        {detail.is_billable && <span className="billable-badge">💰 Billable</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
              <button className="modal-btn ok" onClick={() => setShowDetailsModal(false)}>Close</button>
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
      `}</style>
    </>
  );
}
