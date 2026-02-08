'use client';

import { useState } from 'react';
import '../../styles/dashboard.css';
import '../../styles/supervisor.css';
import SupervisorScheduleManagement from '@/app/components/SupervisorScheduleManagement';
import TeamStatusMonitor from '@/app/components/TeamStatusMonitor';

export default function SupervisorDashboard() {
  const [activeSection, setActiveSection] = useState('team');
  const [lightMode, setLightMode] = useState(false);

  return (
    <div className={`dashboard-container supervisor-theme ${lightMode ? 'light-mode' : ''}`}>
      <div className="tech-mesh"></div>
      
      {/* Sidebar */}
      <aside className="info-panel">
        <div className="bg-decor bg-sq-outline sq-top-left"></div>
        <div className="bg-decor bg-sq-outline sq-mid-left"></div>
        <div className="bg-decor bg-sq-solid sq-bot-left"></div>

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
            <span className="dot"></span>
            8 PENDING
          </div>
        </div>

        <div className="profile-card">
          <div className="streak-badge">👔 SUPERVISOR</div>
          <div className="avatar">SM</div>
          <div className="profile-info">
            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Sarah Manager</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>SUPERVISOR</div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="workspace-panel">
        <div className="top-bar">
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Supervisor Dashboard</h1>
          <button 
            className="theme-btn" 
            onClick={() => setLightMode(!lightMode)}
            aria-label="Toggle theme"
          >
            {lightMode ? '☾' : '☀'}
          </button>
        </div>

        <div className="content-area">
          {/* Team Overview */}
          {activeSection === 'team' && (
            <div className="section-view active fade-in">
              <TeamStatusMonitor />
            </div>
          )}

          {/* Timesheet Approval */}
          {activeSection === 'approval' && (
            <div className="section-view active fade-in">
              <div className="glass-card">
                <div className="section-title">
                  <span>Pending Timesheet Approvals</span>
                  <span style={{ color: 'var(--color-warn)', fontSize: '1rem' }}>8 Waiting</span>
                </div>
                <div className="approval-grid">
                  {[
                    { employee: 'John Doe', date: '2024-02-05', hours: 8.0, activities: 3, status: 'pending' },
                    { employee: 'Jane Smith', date: '2024-02-05', hours: 7.5, activities: 4, status: 'pending' },
                    { employee: 'Mike Johnson', date: '2024-02-05', hours: 8.5, activities: 2, status: 'pending' }
                  ].map((timesheet, i) => (
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
                          <span className="stat-value">{timesheet.hours}</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-label">Activities</span>
                          <span className="stat-value">{timesheet.activities}</span>
                        </div>
                      </div>
                      <div className="approval-actions">
                        <button className="btn-approve">✓ Approve</button>
                        <button className="btn-reject">✗ Reject</button>
                        <button className="btn-view">View Details</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Team Schedule */}
          {activeSection === 'schedule' && (
            <div className="section-view active fade-in">
              <SupervisorScheduleManagement />
            </div>
          )}

          {/* Team Analytics */}
          {activeSection === 'analytics' && (
            <div className="section-view active fade-in">
              <div className="stats-row">
                <div className="stat-box">
                  <div className="label-sm">Team Hours (Week)</div>
                  <div className="stat-big supervisor-accent">342.5</div>
                </div>
                <div className="stat-box">
                  <div className="label-sm">Avg Hours/Person</div>
                  <div className="stat-big supervisor-accent">38.1</div>
                </div>
                <div className="stat-box">
                  <div className="label-sm">Productivity Rate</div>
                  <div className="stat-big" style={{ color: 'var(--color-go)' }}>94%</div>
                </div>
              </div>
              <div className="glass-card">
                <div className="section-title">Team Performance Overview</div>
                <div className="graph-container">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((day, i) => (
                    <div key={day} className="bar-group">
                      <div className="bar bar-actual supervisor-bar" style={{ height: `${70 + i * 5}%` }}></div>
                      <div className="bar-label">{day}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Settings */}
          {activeSection === 'settings' && (
            <div className="section-view active fade-in">
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
                      onChange={() => setLightMode(!lightMode)} 
                    />
                    <span className="slider"></span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
