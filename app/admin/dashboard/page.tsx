'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Sun, Moon } from 'lucide-react';
import '../../styles/dashboard.css';
import '../../styles/admin.css';
import AdminUserManagement from '../../components/AdminUserManagement';
import ExcelImportExport from '../../components/ExcelImportExport';
import AnalyticsView from '../../components/AnalyticsView';

const THEME_KEY = 'orasync_theme';

export default function AdminDashboard() {
  const [activeSection, setActiveSection] = useState('users');
  const [lightMode, setLightMode] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [iconSpin, setIconSpin] = useState(false);

  // Admin Data State
  const [adminName, setAdminName] = useState('Loading...');
  const [adminInitials, setAdminInitials] = useState('AD');

  // Dropdown and Logout States
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuWrapRef = useRef<HTMLDivElement | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  // LOGOUT CONFIRMATION STATE
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Load theme from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === 'light') {
        setLightMode(true);
      } else if (saved === 'dark') {
        setLightMode(false);
      } else {
        const prefersLight = window.matchMedia?.('(prefers-color-scheme: light)')?.matches ?? false;
        setLightMode(prefersLight);
      }
    } catch { /* ignore */ } finally {
      setMounted(true);
    }
  }, []);

  // Persist theme when it changes
  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(THEME_KEY, lightMode ? 'light' : 'dark');
    } catch { /* ignore */ }
  }, [lightMode, mounted]);

  // Fetch the user data when the dashboard mounts
  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => {
        if (!res.ok) throw new Error('Not logged in');
        return res.json();
      })
      .then(data => {
        if (data && data.first_name) {
          const fullName = `${data.first_name} ${data.last_name || ''}`.trim();
          setAdminName(fullName);

          const firstInit = data.first_name.charAt(0).toUpperCase();
          const lastInit = data.last_name ? data.last_name.charAt(0).toUpperCase() : '';
          setAdminInitials(`${firstInit}${lastInit}`);
        } else {
          setAdminName('Admin User');
        }
      })
      .catch(err => {
        console.error('Failed to fetch admin profile:', err);
        setAdminName('Admin User');
      });
  }, []);

  // Debounced toggle handler with spin animation
  const handleThemeToggle = useCallback(() => {
    if (isToggling) return;
    setIsToggling(true);
    setIconSpin(true);
    setLightMode(prev => !prev);
    setTimeout(() => {
      setIconSpin(false);
      setIsToggling(false);
    }, 600);
  }, [isToggling]);

  // Actual Logout Function
  const doLogout = useCallback(async () => {
    try {
      setActionBusy(true);
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore errors
    } finally {
      setActionBusy(false);
      window.location.href = "/login";
    }
  }, []);

  // Close profile menu on outside click + ESC
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

  // Don't render until theme is loaded to prevent flash
  if (!mounted) return null;

  return (
    <div className={`dashboard-container admin-theme ${lightMode ? 'light-mode' : ''}`}>
      <div className="tech-mesh"></div>

      <aside className="info-panel" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="bg-decor bg-sq-outline sq-top-left"></div>
        <div className="brand-logo">ORASync</div>

        <ul className="nav-links">
          {['users', 'import', 'audit-logs'].map(section => (
            <li
              key={section}
              className={`nav-item ${activeSection === section ? 'active' : ''}`}
              onClick={() => setActiveSection(section)}
              style={{ textTransform: 'uppercase' }}
            >
              {section === 'import' ? 'Import Data' :
                section === 'audit-logs' ? 'Audit Logs' :
                  section.charAt(0).toUpperCase() + section.slice(1)}
            </li>
          ))}
        </ul>

        <div className="widget-box">
          <div className="label-sm">System Status</div>
          <div className="status-badge go">
            <span className="dot"></span>
            OPERATIONAL
          </div>
        </div>

        <div className="profile-menu-wrap" ref={profileMenuWrapRef} style={{ marginTop: 'auto', marginBottom: '1rem', width: '100%' }}>
          {profileMenuOpen && (
            <div className="profile-menu-card" role="menu" aria-label="Profile menu">
              <button
                className="profile-menu-item"
                onClick={() => {
                  setProfileMenuOpen(false);
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
                  setShowLogoutConfirm(true);
                }}
                type="button"
                disabled={actionBusy}
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
            style={{ width: '100%', padding: 0, background: 'none', border: 'none', textAlign: 'left' }}
          >
            <div className="profile-card" style={{ padding: '20px 16px', display: 'flex', alignItems: 'center', gap: '14px', position: 'relative' }}>
              <div className="avatar" style={{ width: '46px', height: '46px', flexShrink: 0, margin: 0 }}>{adminInitials}</div>
              <div className="profile-info" style={{ textAlign: 'left', overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{adminName}</div>
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em' }}>SYSTEM ADMIN</div>
              </div>
            </div>
          </button>
        </div>

      </aside >

      <main className="workspace-panel">
        <div className="top-bar">
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>
            {activeSection === 'audit-logs' ? 'System Audit Logs' : 'Admin Dashboard'}
          </h1>
          <button
            className="theme-btn"
            onClick={handleThemeToggle}
            disabled={isToggling}
            aria-label="Toggle theme"
            style={{ opacity: isToggling ? 0.7 : 1, cursor: isToggling ? 'not-allowed' : 'pointer' }}
          >
            <span className={`theme-icon ${iconSpin ? 'spinning' : ''}`}>
              {lightMode ? <Moon size={20} /> : <Sun size={20} />}
            </span>
          </button>
        </div>

        <div className="content-area">
          {activeSection === 'users' && (
            <div className="section-view active fade-in">
              <AdminUserManagement lightMode={lightMode} />
            </div>
          )}

          {activeSection === 'import' && (
            <div className="section-view active fade-in">
              <ExcelImportExport />
            </div>
          )}

          {activeSection === 'audit-logs' && (
            <div className="section-view active fade-in">
              <AnalyticsView />
            </div>
          )}
        </div>
      </main>

      {
        showLogoutConfirm && (
          <div className="modal-overlay" style={{ zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.8)' }}>
            <div className="glass-card" style={{ width: '350px', textAlign: 'center', border: '1px solid #444', background: '#1a1a1a' }}>
              <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⎋</div>
              <h3 style={{ marginBottom: '1rem', color: '#fff' }}>Confirm Logout</h3>
              <p style={{ marginBottom: '2rem', color: '#aaa', fontSize: '0.9rem' }}>
                Are you sure you want to end your secure admin session?
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
                <button
                  className="btn-action"
                  onClick={() => setShowLogoutConfirm(false)}
                  style={{ background: '#333', flex: 1, padding: '10px', borderRadius: '6px', cursor: 'pointer', border: 'none', color: '#fff', fontWeight: 'bold' }}
                >
                  Cancel
                </button>
                <button
                  className="btn-action"
                  onClick={doLogout}
                  disabled={actionBusy}
                  style={{ background: '#ef4444', flex: 1, padding: '10px', borderRadius: '6px', cursor: 'pointer', border: 'none', color: '#fff', fontWeight: 'bold' }}
                >
                  {actionBusy ? 'Logging out...' : 'Log Out'}
                </button>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
}