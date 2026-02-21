"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import styles from './Analyst.module.css';

// Types for API responses
interface SummaryData {
    totalLogs: number;
    totalLogsChange: number;
    avgEfficiency: number;
    efficiencyStatus: string;
    activePersonnel: number;
}

interface WeeklyActivityData {
    day: string;
    logs: number;
    isCurrentDay: boolean;
}

interface SystemEvent {
    id: string;
    type: string;
    message: string;
    timestamp: string;
    status: 'green' | 'yellow' | 'blue';
}

interface LogRow {
    id: string;
    userName: string;
    department: string;
    hours: string;
    status: 'OK' | 'HIGH' | 'LOW';
}

// Mock team data (no API for this yet)
const MOCK_TEAM = [
    { name: 'Sarah Miller', role: 'Marketing Lead', dept: 'MKT', status: 'online', task: 'Client Presentation', eff: 92 },
    { name: 'John Doe', role: 'Sales rep', dept: 'SAL', status: 'busy', task: 'Call with Lead', eff: 88 },
    { name: 'Emily White', role: 'Backend Dev', dept: 'ENG', status: 'online', task: 'API Optimization', eff: 95 },
    { name: 'Mike Brown', role: 'Account Exec', dept: 'SAL', status: 'offline', task: '-', eff: 78 },
    { name: 'Jessica Lee', role: 'UI Designer', dept: 'ENG', status: 'online', task: 'Dashboard Mockups', eff: 91 },
    { name: 'David Kim', role: 'QA Engineer', dept: 'ENG', status: 'busy', task: 'Regression Testing', eff: 85 },
];

const EXPORT_OPTIONS = [
    { id: 'activity', title: 'Daily Activity Log', desc: 'Detailed logs of all employee actions' },
    { id: 'summary', title: 'Department Summary', desc: 'Aggregated stats by department' },
    { id: 'billing', title: 'Billable Hours', desc: 'Breakdown of billable vs non-billable time' },
];

function AnimatedValue({ value, suffix = '', duration = 800 }: { value: number, suffix?: string, duration?: number }) {
    const [displayValue, setDisplayValue] = useState(0);

    useEffect(() => {
        let startTimestamp: number | null = null;
        const startValue = displayValue;

        const step = (timestamp: number) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            const easeOutQuart = 1 - Math.pow(1 - progress, 4);
            const current = Math.floor(easeOutQuart * (value - startValue) + startValue);

            setDisplayValue(current);

            if (progress < 1) {
                window.requestAnimationFrame(step);
            } else {
                setDisplayValue(value);
            }
        };

        window.requestAnimationFrame(step);
    }, [value, duration]);

    return <>{displayValue.toLocaleString()}{suffix}</>;
}

export default function AnalystDashboard() {
    const [activeView, setActiveView] = useState<'home' | 'reports' | 'team'>('home');
    const [dept, setDept] = useState<string>('ALL');
    const [period, setPeriod] = useState<'week' | 'month' | 'year'>('week');
    const [lightMode, setLightMode] = useState(false);
    const [profileMenuOpen, setProfileMenuOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [exportModalOpen, setExportModalOpen] = useState(false);

    const [exportType, setExportType] = useState('activity');
    const [exportFormat, setExportFormat] = useState('csv');

    const profileRef = useRef<HTMLDivElement>(null);

    // API data state
    const [departments, setDepartments] = useState<string[]>([]);
    const [summary, setSummary] = useState<SummaryData | null>(null);
    const [weeklyActivity, setWeeklyActivity] = useState<WeeklyActivityData[]>([]);
    const [systemEvents, setSystemEvents] = useState<SystemEvent[]>([]);
    const [logs, setLogs] = useState<LogRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch departments
    const fetchDepartments = useCallback(async () => {
        try {
            const res = await fetch('/api/analyst/departments');
            const data = await res.json();
            if (data.success) {
                setDepartments(data.data);
            }
        } catch (err) {
            console.error('Failed to fetch departments:', err);
        }
    }, []);

    // Fetch summary data
    const fetchSummary = useCallback(async () => {
        try {
            const res = await fetch(`/api/analyst/summary?period=${period}`);
            const data = await res.json();
            if (data.success) {
                setSummary(data.data);
            }
        } catch (err) {
            console.error('Failed to fetch summary:', err);
        }
    }, [period]);

    // Fetch weekly activity
    const fetchWeeklyActivity = useCallback(async () => {
        try {
            const res = await fetch(`/api/analyst/weekly-activity?period=${period}`);
            const data = await res.json();
            if (data.success) {
                setWeeklyActivity(data.data);
            }
        } catch (err) {
            console.error('Failed to fetch weekly activity:', err);
        }
    }, [period]);

    // Fetch system events
    const fetchSystemEvents = useCallback(async () => {
        try {
            const res = await fetch(`/api/analyst/system-events?limit=5&period=${period}`);
            const data = await res.json();
            if (data.success) {
                setSystemEvents(data.data);
            }
        } catch (err) {
            console.error('Failed to fetch system events:', err);
        }
    }, [period]);

    // Fetch logs
    const fetchLogs = useCallback(async (department: string) => {
        try {
            const url = department === 'ALL'
                ? `/api/analyst/logs?limit=20&period=${period}`
                : `/api/analyst/logs?department=${encodeURIComponent(department)}&limit=20&period=${period}`;
            const res = await fetch(url);
            const data = await res.json();
            if (data.success) {
                setLogs(data.data);
            }
        } catch (err) {
            console.error('Failed to fetch logs:', err);
        }
    }, [period]);

    // Refresh all data
    const refreshData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            await Promise.all([
                fetchSummary(),
                fetchWeeklyActivity(),
                fetchSystemEvents(),
                fetchLogs(dept),
            ]);
        } catch (err) {
            setError('Failed to refresh data');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [dept, period, fetchSummary, fetchWeeklyActivity, fetchSystemEvents, fetchLogs]);

    // Initial load
    useEffect(() => {
        fetchDepartments();
        refreshData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [period]);

    // Refetch logs when department changes
    useEffect(() => {
        fetchLogs(dept);
    }, [dept, fetchLogs]);

    useEffect(() => {
        const saved = localStorage.getItem('analyst_theme');
        if (saved === 'light') {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setLightMode(true);
        }
    }, []);

    useEffect(() => {
        localStorage.setItem('analyst_theme', lightMode ? 'light' : 'dark');
    }, [lightMode]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
                setProfileMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Calculate max bar height for chart scaling
    const maxLogs = Math.max(...weeklyActivity.map(d => d.logs), 1);

    const generateReport = () => {
        alert(`Mock generated report for type: ${exportType}`);
    };

    const exportData = (fmt: string) => {
        alert(`Simulated output: Exporting ${exportType} report as ${fmt.toUpperCase()}`);
        setExportModalOpen(false);
    };

    return (
        <div className={`${styles.analystPortal} ${lightMode ? styles.lightMode : ''}`}>
            <div className={styles['split-layout']}>
                {/* SIDEBAR */}
                <aside className={styles['info-panel']}>
                    <div className={`${styles['bg-decor']} ${styles['sq-top-left']} ${styles['bg-sq-outline']}`}></div>
                    <div className={`${styles['bg-decor']} ${styles['sq-mid-left']} ${styles['bg-sq-outline']}`}></div>
                    <div className={`${styles['bg-decor']} ${styles['sq-bot-left']} ${styles['bg-sq-solid']}`}></div>

                    <div className={styles['brand-logo']}>
                        <div style={{ width: 24, height: 24, background: 'var(--accent-primary)', borderRadius: 6 }}></div>
                        ORASYNC
                    </div>

                    <nav className={styles['nav-links']}>
                        <div
                            className={`${styles['nav-item']} ${activeView === 'home' ? styles.active : ''}`}
                            onClick={() => setActiveView('home')}
                        >
                            <svg className={styles['nav-icon']} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                            </svg>
                            Analyst Home
                        </div>
                        <div
                            className={`${styles['nav-item']} ${activeView === 'reports' ? styles.active : ''}`}
                            onClick={() => setActiveView('reports')}
                        >
                            <svg className={styles['nav-icon']} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                            </svg>
                            Reports
                        </div>
                        <div
                            className={`${styles['nav-item']} ${activeView === 'team' ? styles.active : ''}`}
                            onClick={() => setActiveView('team')}
                        >
                            <svg className={styles['nav-icon']} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path>
                            </svg>
                            Team View
                        </div>
                    </nav>

                    <div ref={profileRef} style={{ marginTop: 'auto', position: 'relative' }}>
                        <div className={`${styles['profile-menu']} ${profileMenuOpen ? styles.active : ''}`} id="profile-menu">
                            <div className={styles['menu-item']} onClick={() => { setSettingsOpen(true); setProfileMenuOpen(false); }}>
                                <div className={styles['menu-icon']}>⚙️</div>
                                Configuration
                            </div>
                            <div className={styles['menu-divider']}></div>
                            <div className={`${styles['menu-item']} ${styles.danger}`} onClick={() => alert('Logged out (Simulated)')}>
                                <div className={styles['menu-icon']}>🚪</div>
                                Log Out
                            </div>
                        </div>

                        <div className={`${styles['user-widget']} ${styles['profile-card']}`} onClick={() => setProfileMenuOpen(!profileMenuOpen)}>
                            <div className={styles['avatar-box']} style={{ background: 'linear-gradient(135deg, var(--accent-blue), #2a5298)', boxShadow: '0 5px 15px rgba(15, 52, 166, 0.4)' }}>
                                AR
                            </div>
                            <div>
                                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)' }}>Alex R.</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Senior Analyst</div>
                            </div>
                            <div style={{ marginLeft: 'auto', color: 'var(--text-muted)', opacity: 0.5 }}>
                                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35z"></path>
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                                </svg>
                            </div>
                        </div>
                    </div>
                </aside>

                {/* ANALYST HOME */}
                {activeView === 'home' && (
                    <main className={`${styles['main-view']} ${styles['view-section']}`}>
                        <header className={styles['view-header']}>
                            <div>
                                <div className={styles['page-title']}>Department Analytics</div>
                                <div className={styles['page-subtitle']}>
                                    Viewing data for: <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{dept === 'ALL' ? 'All Departments' : `${dept} Section`}</span>
                                </div>
                            </div>
                            <div className={styles.controls}>
                                <select className={styles['select-pro']} value={dept} onChange={(e) => setDept(e.target.value)}>
                                    <option value="ALL">All Departments</option>
                                    {departments.map((d) => (
                                        <option key={d} value={d}>{d}</option>
                                    ))}
                                </select>
                                <select className={styles['select-pro']} value={period} onChange={e => setPeriod(e.target.value as 'week' | 'month' | 'year')} style={{ marginLeft: 12 }}>
                                    <option value="week">Weekly</option>
                                    <option value="month">Monthly</option>
                                    <option value="year">Yearly</option>
                                </select>
                                <button className={styles['btn-pro']} onClick={refreshData} disabled={loading}>
                                    {loading ? 'Loading...' : 'Refresh'}
                                </button>
                                <button className={`${styles['btn-pro']} ${styles['btn-primary']}`} onClick={() => setExportModalOpen(true)}>Export Report</button>
                            </div>
                        </header>

                        <div className={styles['dashboard-grid']}>
                            <div className={`${styles['widget-box']} ${styles['stat-card']}`} style={{ '--card-accent': 'var(--accent-primary)' } as React.CSSProperties}>
                                <svg className={styles['bg-icon']} fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z"></path>
                                </svg>
                                <div className={styles['widget-title']}>Total Logs</div>
                                <div className={styles['stat-value']}><AnimatedValue value={summary?.totalLogs || 0} /></div>
                                <div className={`${styles['stat-trend']} ${(summary?.totalLogsChange || 0) >= 0 ? styles['trend-up'] : styles['trend-down']}`}>
                                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path>
                                    </svg>
                                    {Math.abs(summary?.totalLogsChange || 0).toFixed(1)}% <span className={styles['trend-neutral']} style={{ marginLeft: 4 }}>vs last week</span>
                                </div>
                            </div>

                            <div className={`${styles['widget-box']} ${styles['stat-card']}`} style={{ '--card-accent': 'var(--status-success)' } as React.CSSProperties}>
                                <svg className={styles['bg-icon']} fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd"></path>
                                </svg>
                                <div className={styles['widget-title']}>Avg Efficiency</div>
                                <div className={styles['stat-value']} style={{ color: 'var(--status-success)' }}><AnimatedValue value={Math.round(summary?.avgEfficiency || 0)} suffix="%" /></div>
                                <div className={`${styles['stat-trend']} ${styles['trend-up']}`}>
                                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                    </svg>
                                    {summary?.efficiencyStatus || 'Loading...'}
                                </div>
                            </div>

                            <div className={`${styles['widget-box']} ${styles['stat-card']}`} style={{ '--card-accent': 'var(--color-warn)' } as React.CSSProperties}>
                                <svg className={styles['bg-icon']} fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"></path>
                                </svg>
                                <div className={styles['widget-title']}>Active Personnel</div>
                                <div className={styles['stat-value']}><AnimatedValue value={summary?.activePersonnel || 0} /></div>
                                <div className={styles['stat-trend']} style={{ color: 'var(--color-warn)' }}>
                                    <span style={{ display: 'inline-block', width: 8, height: 8, background: 'currentColor', borderRadius: '50%', marginRight: 6 }}></span>
                                    Users Online
                                </div>
                            </div>

                            {/* CHART */}
                            <div className={styles['widget-box']} style={{ gridColumn: 'span 2' }}>
                                <div className={styles['widget-title']}>
                                    Weekly Activity
                                    <span style={{ fontSize: '0.7rem', background: 'var(--bg-hover)', padding: '2px 8px', borderRadius: 4, color: 'var(--text-main)' }}>LIVE</span>
                                </div>
                                <div className={styles['chart-container']}>
                                    {weeklyActivity.map((dayData, i) => {
                                        const barHeight = maxLogs > 0 ? (dayData.logs / maxLogs) * 100 : 0;
                                        return (
                                            <div key={i} className={styles['bar-col']}>
                                                <div style={{ textAlign: 'center', marginBottom: '8px', fontSize: '0.8rem', fontWeight: 600, opacity: dayData.logs > 0 ? 1 : 0, transition: '0.4s', color: 'var(--text-main)' }}>
                                                    {dayData.logs}
                                                </div>
                                                <div
                                                    className={styles.bar}
                                                    style={{
                                                        height: `${barHeight}%`,
                                                        transition: 'height 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
                                                        width: '100%',
                                                        opacity: dayData.isCurrentDay ? 1 : 0.7,
                                                    }}
                                                />
                                                <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '0.75rem', color: dayData.isCurrentDay ? 'var(--accent-primary)' : 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.5px' }}>
                                                    {dayData.day.toUpperCase()}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* FEED */}
                            <div className={styles['widget-box']}>
                                <div className={styles['widget-title']}>System Events</div>
                                <div className={styles['feed-list']}>
                                    {systemEvents.length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                                            No recent events
                                        </div>
                                    ) : (
                                        systemEvents.map((event) => {
                                            const statusColors: Record<string, string> = {
                                                green: 'var(--status-success)',
                                                yellow: 'var(--status-warning)',
                                                blue: 'var(--accent-primary)',
                                            };
                                            return (
                                                <div key={event.id} className={styles['feed-item']}>
                                                    <div className={styles['feed-icon']} style={{ background: statusColors[event.status] || 'var(--accent-primary)' }}></div>
                                                    <div className={styles['feed-content']}>
                                                        <h4>{event.type.replace(/_/g, ' ')}</h4>
                                                        <p>{event.message}</p>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>

                            {/* TABLE */}
                            <div className={styles['widget-box']} style={{ gridColumn: 'span 3' }}>
                                <div className={styles['widget-title']} style={{ marginBottom: 0, paddingBottom: 16, borderBottom: '1px solid var(--border-subtle)' }}>Detailed Logs</div>
                                <div className={styles['table-responsive']} style={{ maxHeight: 400, overflowY: 'auto' }}>
                                    <table className={styles['data-table']}>
                                        <thead>
                                            <tr>
                                                <th>ID</th>
                                                <th>User Name</th>
                                                <th>Department</th>
                                                <th>Hours Logged</th>
                                                <th>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {logs.length === 0 ? (
                                                <tr>
                                                    <td colSpan={5} style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                                                        {loading ? 'Loading...' : 'No logs found'}
                                                    </td>
                                                </tr>
                                            ) : (
                                                logs.map((r) => {
                                                    let badgeStyle = { background: 'rgba(16, 185, 129, 0.1)', color: 'var(--status-success)' };
                                                    if (r.status === 'HIGH') badgeStyle = { background: 'rgba(245, 158, 11, 0.1)', color: 'var(--status-warning)' };
                                                    if (r.status === 'LOW') badgeStyle = { background: 'rgba(239, 68, 68, 0.1)', color: 'var(--status-danger)' };

                                                    return (
                                                        <tr key={r.id}>
                                                            <td style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>{r.id}</td>
                                                            <td style={{ fontWeight: 500 }}>{r.userName}</td>
                                                            <td style={{ color: 'var(--text-dim)' }}>{r.department}</td>
                                                            <td>{r.hours}h</td>
                                                            <td><span className={styles['status-badge']} style={badgeStyle}>{r.status}</span></td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </main>
                )}

                {/* REPORTS VIEW */}
                {activeView === 'reports' && (
                    <main className={`${styles['main-view']} ${styles['view-section']}`}>
                        <header className={styles['view-header']}>
                            <div>
                                <div className={styles['page-title']}>Generate Reports</div>
                                <div className={styles['page-subtitle']}>Export data based on Entity Relationship criteria</div>
                            </div>
                        </header>

                        <div className={styles['dashboard-grid']}>
                            <div className={styles['widget-box']} style={{ gridColumn: 'span 3', overflow: 'visible' }}>
                                <div className={styles['widget-title']} style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: 15 }}>
                                    Report Configuration
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, paddingTop: 15 }}>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: 8, color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 600 }}>Report Type</label>
                                        <select className={styles['select-pro']} style={{ width: '100%' }} value={exportType} onChange={e => setExportType(e.target.value)}>
                                            <option value="activity">Daily Activity Log</option>
                                            <option value="summary">Department Summary</option>
                                            <option value="billing">Billable vs Non-Billable</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: 8, color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 600 }}>Time Period</label>
                                        <select className={styles['select-pro']} style={{ width: '100%' }}>
                                            <option>Last 7 Days</option>
                                            <option>This Month</option>
                                            <option>Last Quarter</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: 8, color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 600 }}>Filter Entity</label>
                                        <select className={styles['select-pro']} style={{ width: '100%' }}>
                                            <option value="ALL">All Departments</option>
                                            <option value="ENG">Engineering</option>
                                            <option value="SAL">Sales</option>
                                        </select>
                                    </div>
                                </div>
                                <div style={{ marginTop: 25, display: 'flex', justifyContent: 'flex-end', gap: 15 }}>
                                    <button className={`${styles['btn-action']} ${styles.secondary}`}>Reset</button>
                                    <button className={`${styles['btn-action']} ${styles.primary}`} onClick={generateReport}>Generate Report</button>
                                </div>
                            </div>
                        </div>
                    </main>
                )}

                {/* TEAM VIEW */}
                {activeView === 'team' && (
                    <main className={`${styles['main-view']} ${styles['view-section']}`}>
                        <header className={styles['view-header']}>
                            <div>
                                <div className={styles['page-title']}>Team Overview</div>
                                <div className={styles['page-subtitle']}>Monitor real-time status and assignment of personnel</div>
                            </div>
                            <div className={styles.controls}>
                                <input type="text" className={styles['select-pro']} placeholder="Search Employee..." style={{ width: 200, padding: '10px 15px', border: '1px solid var(--border-subtle)', background: 'var(--bg-input)', color: 'var(--text-main)', borderRadius: 4 }} />
                                <select className={styles['select-pro']} style={{ width: 'auto' }}>
                                    <option value="ALL">All Statuses</option>
                                    <option value="ONLINE">Online</option>
                                    <option value="OFFLINE">Offline</option>
                                    <option value="BUSY">In Meeting</option>
                                </select>
                            </div>
                        </header>

                        <div className={styles['dashboard-grid']} style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                            {MOCK_TEAM.map((emp, i) => {
                                let statusColor = 'var(--text-muted)';
                                let statusText = 'Offline';
                                if (emp.status === 'online') { statusColor = 'var(--color-go)'; statusText = 'Online'; }
                                if (emp.status === 'busy') { statusColor = 'var(--color-warn)'; statusText = 'In Meeting'; }

                                return (
                                    <div key={i} className={styles['widget-box']} style={{ padding: 20, gap: 10 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                                <div className={styles['avatar-box']} style={{ background: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border-subtle)', width: 45, height: 45, fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    {emp.name.split(' ').map(n => n[0]).join('')}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 700, color: 'var(--text-main)', fontFamily: 'var(--font-brand)', fontSize: '1rem' }}>{emp.name}</div>
                                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>{emp.role}</div>
                                                </div>
                                            </div>
                                            <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>{emp.dept}</span>
                                        </div>

                                        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 6 }}>
                                                <span style={{ color: 'var(--text-muted)' }}>Status</span>
                                                <span style={{ color: statusColor, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <span style={{ width: 6, height: 6, background: statusColor, borderRadius: '50%' }}></span>
                                                    {statusText}
                                                </span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                                                <span style={{ color: 'var(--text-muted)' }}>Current Task</span>
                                                <span style={{ color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px', textAlign: 'right' }}>{emp.task}</span>
                                            </div>
                                        </div>

                                        <div style={{ marginTop: 15 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: 4 }}>
                                                <span style={{ color: 'var(--text-dim)' }}>Daily Efficiency</span>
                                                <span style={{ color: 'var(--text-main)', fontWeight: 700 }}>{emp.eff}%</span>
                                            </div>
                                            <div style={{ height: 4, width: '100%', background: 'var(--bg-input)', borderRadius: 2, overflow: 'hidden' }}>
                                                <div style={{ height: '100%', width: `${emp.eff}%`, background: 'var(--accent-primary)', borderRadius: 2 }}></div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </main>
                )}
            </div>

            {/* SETTINGS MODAL */}
            {settingsOpen && (
                <div className={styles['modal-overlay']} style={{ display: 'flex' }} onClick={() => setSettingsOpen(false)}>
                    <div className={styles['modal-card']} onClick={e => e.stopPropagation()}>
                        <div className={`${styles['modal-header']} ${styles['header-normal']}`}>
                            <span className={styles['modal-title']} style={{ color: 'var(--accent-cyan)' }}>Configuration</span>
                        </div>
                        <div className={styles['modal-body']}>
                            <div className={styles['settings-row']}>
                                <div>
                                    <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>Theme Preference</div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Switch between light and dark mode</div>
                                </div>
                                <label className={styles['toggle-switch']}>
                                    <input type="checkbox" checked={lightMode} onChange={() => setLightMode(!lightMode)} />
                                    <span className={styles.slider}></span>
                                </label>
                            </div>
                        </div>
                        <div className={styles['modal-footer']}>
                            <button className={`${styles['btn-action']} ${styles.primary}`} onClick={() => setSettingsOpen(false)}>Save Changes</button>
                        </div>
                    </div>
                </div>
            )}

            {/* EXPORT MODAL */}
            {exportModalOpen && (
                <div className={styles['modal-overlay']} style={{ display: 'flex' }} onClick={() => setExportModalOpen(false)}>
                    <div className={styles['modal-card']} style={{ width: 480 }} onClick={e => e.stopPropagation()}>
                        <div className={`${styles['modal-header']} ${styles['header-normal']}`}>
                            <span className={styles['modal-title']} style={{ color: 'var(--text-main)' }}>Export Data</span>
                        </div>

                        <div className={styles['modal-body']}>
                            <div style={{ marginBottom: 25 }}>
                                <label style={{ display: 'block', marginBottom: 12, color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 500 }}>
                                    Select Report Types (Multiple)
                                </label>
                                <div className={styles['export-list']}>
                                    {EXPORT_OPTIONS.map(opt => (
                                        <div
                                            key={opt.id}
                                            className={`${styles['export-option']} ${exportType === opt.id ? styles.selected : ''}`}
                                            onClick={() => setExportType(opt.id)}
                                        >
                                            <div className={styles['check-box']}></div>
                                            <div className={styles['export-option-content']}>
                                                <span className={styles['export-option-title']}>{opt.title}</span>
                                                <span className={styles['export-option-desc']}>{opt.desc}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div style={{ marginBottom: 10 }}>
                                <label style={{ display: 'block', marginBottom: 12, color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 500 }}>
                                    Export Format
                                </label>
                                <div style={{ display: 'flex', gap: 15 }}>
                                    <button
                                        className={`${styles['btn-action']} ${styles.secondary}`}
                                        style={{ flex: 1, justifyContent: 'center', borderColor: exportFormat === 'csv' ? 'var(--accent-primary)' : 'var(--border-subtle)', color: exportFormat === 'csv' ? 'var(--accent-primary)' : 'var(--text-muted)', background: exportFormat === 'csv' ? 'rgba(99,102,241,0.05)' : 'transparent' }}
                                        onClick={() => setExportFormat('csv')}
                                    >
                                        CSV Spreadsheet
                                    </button>
                                    <button
                                        className={`${styles['btn-action']} ${styles.secondary}`}
                                        style={{ flex: 1, justifyContent: 'center', borderColor: exportFormat === 'pdf' ? 'var(--accent-primary)' : 'var(--border-subtle)', color: exportFormat === 'pdf' ? 'var(--accent-primary)' : 'var(--text-muted)', background: exportFormat === 'pdf' ? 'rgba(99,102,241,0.05)' : 'transparent' }}
                                        onClick={() => setExportFormat('pdf')}
                                    >
                                        PDF Document
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className={styles['modal-footer']}>
                            <button className={`${styles['btn-action']} ${styles.secondary}`} onClick={() => setExportModalOpen(false)}>Cancel</button>
                            <button className={`${styles['btn-action']} ${styles.primary}`} onClick={() => exportData(exportFormat)}>Export Data</button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
