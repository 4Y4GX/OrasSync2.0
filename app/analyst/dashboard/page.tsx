"use client";

import React, { useState, useEffect, useRef } from 'react';
import styles from './Analyst.module.css';

// Type definitions
interface KPIData {
  totalLogs: number;
  totalHours: number;
  billableHours: number;
  billableRatio: number;
  attendanceRate: number;
  activeStaff: number;
}

interface DepartmentData {
  dept_id: number;
  dept_name: string;
  total_hours: number;
  billable_hours: number;
  billable_ratio: number;
  active_staff: number;
}

interface ReportData {
  reportType: string;
  period: string;
  headers: string[];
  data: any[];
  count: number;
}

interface AuditLog {
  audit_id: number;
  changed_by: string | null;
  user_name: string;
  user_email: string;
  action_type: string | null;
  table_affected: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: Date | null;
}

interface SentimentData {
  period: string;
  summary: {
    total: number;
    counts: {
      GREAT: number;
      OKAY: number;
      NOT_GOOD: number;
    };
    percentages: {
      GREAT: number;
      OKAY: number;
      NOT_GOOD: number;
    };
    avg_morale_score: number;
  };
  burnoutRisks: Array<{
    user_id: string;
    name: string;
    department: string;
    team: string;
    not_good_count: number;
    latest_sentiment: string;
    risk_level: string;
  }>;
}

interface PerformerData {
  topPerformers: Array<any>;
  bottomPerformers: Array<any>;
  performanceDistribution: {
    excellent: number;
    good: number;
    average: number;
    below_average: number;
  };
}

interface OvertimeData {
  summary: {
    total_ot_requests: number;
    total_early_clockouts: number;
  };
  flags: Array<{
    user_id: string;
    name: string;
    department: string;
    flag_type: string;
    flag_reason: string;
    severity: string;
  }>;
}

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
    const [activeView, setActiveView] = useState<'home' | 'reports' | 'audit' | 'sentiment' | 'performers' | 'overtime'>('home');
    const [dept, setDept] = useState<string>('ALL');
    const [period, setPeriod] = useState<string>('week');
    const [lightMode, setLightMode] = useState(false);
    const [profileMenuOpen, setProfileMenuOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [exportModalOpen, setExportModalOpen] = useState(false);
    
    // Data states
    const [kpiData, setKpiData] = useState<KPIData | null>(null);
    const [weeklyActivity, setWeeklyActivity] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
    const [deptBreakdown, setDeptBreakdown] = useState<DepartmentData[]>([]);
    const [reportData, setReportData] = useState<ReportData | null>(null);
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
    const [auditPage, setAuditPage] = useState(1);
    const [auditTotalPages, setAuditTotalPages] = useState(1);
    const [auditFilters, setAuditFilters] = useState<any>({});
    const [sentimentData, setSentimentData] = useState<SentimentData | null>(null);
    const [performerData, setPerformerData] = useState<PerformerData | null>(null);
    const [overtimeData, setOvertimeData] = useState<OvertimeData | null>(null);
    const [loading, setLoading] = useState(false);
    
    // Report generation states
    const [reportType, setReportType] = useState('attendance');
    const [reportFormat, setReportFormat] = useState('json');

    const profileRef = useRef<HTMLDivElement>(null);

    // Load theme from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('analyst_theme');
        if (saved === 'light') {
            setLightMode(true);
        }
    }, []);

    useEffect(() => {
        localStorage.setItem('analyst_theme', lightMode ? 'light' : 'dark');
    }, [lightMode]);

    // Click outside handler for profile menu
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
                setProfileMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Fetch KPI data
    useEffect(() => {
        if (activeView === 'home') {
            fetchKPIs();
        }
    }, [dept, period, activeView]);

    // Fetch audit logs
    useEffect(() => {
        if (activeView === 'audit') {
            fetchAuditLogs();
        }
    }, [auditPage, activeView]);

    // Fetch sentiment data
    useEffect(() => {
        if (activeView === 'sentiment') {
            fetchSentimentData();
        }
    }, [dept, period, activeView]);

    // Fetch performer data
    useEffect(() => {
        if (activeView === 'performers') {
            fetchPerformerData();
        }
    }, [dept, period, activeView]);

    // Fetch overtime data
    useEffect(() => {
        if (activeView === 'overtime') {
            fetchOvertimeData();
        }
    }, [dept, period, activeView]);

    const fetchKPIs = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ period });
            if (dept !== 'ALL') params.append('dept_id', dept);
            
            const response = await fetch(`/api/analyst/kpis?${params}`);
            if (response.ok) {
                const data = await response.json();
                setKpiData(data.kpis);
                setWeeklyActivity(data.weeklyActivity);
                setDeptBreakdown(data.departmentBreakdown);
            }
        } catch (error) {
            console.error('Failed to fetch KPIs:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchAuditLogs = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ 
                page: auditPage.toString(),
                limit: '50',
            });
            
            const response = await fetch(`/api/analyst/audit?${params}`);
            if (response.ok) {
                const data = await response.json();
                setAuditLogs(data.logs);
                setAuditTotalPages(data.pagination.totalPages);
                setAuditFilters(data.filters);
            }
        } catch (error) {
            console.error('Failed to fetch audit logs:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchSentimentData = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ period });
            if (dept !== 'ALL') params.append('dept_id', dept);
            
            const response = await fetch(`/api/analyst/sentiment?${params}`);
            if (response.ok) {
                const data = await response.json();
                setSentimentData(data);
            }
        } catch (error) {
            console.error('Failed to fetch sentiment data:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchPerformerData = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ period, top_n: '10' });
            if (dept !== 'ALL') params.append('dept_id', dept);
            
            const response = await fetch(`/api/analyst/performers?${params}`);
            if (response.ok) {
                const data = await response.json();
                setPerformerData(data);
            }
        } catch (error) {
            console.error('Failed to fetch performer data:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchOvertimeData = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ period });
            if (dept !== 'ALL') params.append('dept_id', dept);
            
            const response = await fetch(`/api/analyst/overtime?${params}`);
            if (response.ok) {
                const data = await response.json();
                setOvertimeData(data);
            }
        } catch (error) {
            console.error('Failed to fetch overtime data:', error);
        } finally {
            setLoading(false);
        }
    };

    const generateReport = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ 
                type: reportType,
                period,
                format: 'json',
            });
            if (dept !== 'ALL') params.append('dept_id', dept);
            
            const response = await fetch(`/api/analyst/reports?${params}`);
            if (response.ok) {
                const data = await response.json();
                setReportData(data);
            }
        } catch (error) {
            console.error('Failed to generate report:', error);
            alert('Failed to generate report');
        } finally {
            setLoading(false);
        }
    };

    const exportReport = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ 
                type: reportType,
                period,
                format: 'csv',
            });
            if (dept !== 'ALL') params.append('dept_id', dept);
            
            const response = await fetch(`/api/analyst/reports?${params}`);
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${reportType}_report_${period}.csv`;
                a.click();
                setExportModalOpen(false);
            }
        } catch (error) {
            console.error('Failed to export report:', error);
            alert('Failed to export report');
        } finally {
            setLoading(false);
        }
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
                            KPI Overview
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
                            className={`${styles['nav-item']} ${activeView === 'sentiment' ? styles.active : ''}`}
                            onClick={() => setActiveView('sentiment')}
                        >
                            <svg className={styles['nav-icon']} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                            Sentiment
                        </div>
                        <div
                            className={`${styles['nav-item']} ${activeView === 'performers' ? styles.active : ''}`}
                            onClick={() => setActiveView('performers')}
                        >
                            <svg className={styles['nav-icon']} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path>
                            </svg>
                            Performers
                        </div>
                        <div
                            className={`${styles['nav-item']} ${activeView === 'overtime' ? styles.active : ''}`}
                            onClick={() => setActiveView('overtime')}
                        >
                            <svg className={styles['nav-icon']} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                            OT & Early
                        </div>
                        <div
                            className={`${styles['nav-item']} ${activeView === 'audit' ? styles.active : ''}`}
                            onClick={() => setActiveView('audit')}
                        >
                            <svg className={styles['nav-icon']} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                            </svg>
                            Audit Logs
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
                                AN
                            </div>
                            <div>
                                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)' }}>Analyst</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Data Analyst</div>
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

                {/* KPI OVERVIEW */}
                {activeView === 'home' && (
                    <main className={`${styles['main-view']} ${styles['view-section']}`}>
                        <header className={styles['view-header']}>
                            <div>
                                <div className={styles['page-title']}>KPI Overview</div>
                                <div className={styles['page-subtitle']}>
                                    Viewing data for: <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{dept === 'ALL' ? 'All Departments' : dept}</span>
                                </div>
                            </div>
                            <div className={styles.controls}>
                                <select className={styles['select-pro']} value={dept} onChange={(e) => setDept(e.target.value)}>
                                    <option value="ALL">All Departments</option>
                                    {deptBreakdown.map(d => (
                                        <option key={d.dept_id} value={d.dept_id.toString()}>{d.dept_name}</option>
                                    ))}
                                </select>
                                <select className={styles['select-pro']} value={period} onChange={(e) => setPeriod(e.target.value)}>
                                    <option value="week">This Week</option>
                                    <option value="month">This Month</option>
                                    <option value="year">This Year</option>
                                </select>
                                <button className={styles['btn-pro']} onClick={fetchKPIs}>Refresh</button>
                            </div>
                        </header>

                        {loading ? (
                            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
                        ) : kpiData && (
                            <div className={styles['dashboard-grid']}>
                                <div className={`${styles['widget-box']} ${styles['stat-card']}`} style={{ '--card-accent': 'var(--accent-primary)' } as React.CSSProperties}>
                                    <svg className={styles['bg-icon']} fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z"></path>
                                    </svg>
                                    <div className={styles['widget-title']}>Total Hours</div>
                                    <div className={styles['stat-value']}><AnimatedValue value={kpiData.totalHours} /></div>
                                    <div className={`${styles['stat-trend']} ${styles['trend-up']}`}>
                                        <span className={styles['trend-neutral']} style={{ marginLeft: 4 }}>{kpiData.totalLogs} logs</span>
                                    </div>
                                </div>

                                <div className={`${styles['widget-box']} ${styles['stat-card']}`} style={{ '--card-accent': 'var(--status-success)' } as React.CSSProperties}>
                                    <svg className={styles['bg-icon']} fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd"></path>
                                    </svg>
                                    <div className={styles['widget-title']}>Billable Ratio</div>
                                    <div className={styles['stat-value']} style={{ color: 'var(--status-success)' }}><AnimatedValue value={kpiData.billableRatio} suffix="%" /></div>
                                    <div className={`${styles['stat-trend']} ${styles['trend-up']}`}>
                                        {kpiData.billableHours}h / {kpiData.totalHours}h
                                    </div>
                                </div>

                                <div className={`${styles['widget-box']} ${styles['stat-card']}`} style={{ '--card-accent': 'var(--color-warn)' } as React.CSSProperties}>
                                    <svg className={styles['bg-icon']} fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"></path>
                                    </svg>
                                    <div className={styles['widget-title']}>Active Staff</div>
                                    <div className={styles['stat-value']}><AnimatedValue value={kpiData.activeStaff} /></div>
                                    <div className={styles['stat-trend']} style={{ color: 'var(--status-success)' }}>
                                        {kpiData.attendanceRate}% attendance
                                    </div>
                                </div>

                                {/* Weekly Activity Chart */}
                                <div className={styles['widget-box']} style={{ gridColumn: 'span 3' }}>
                                    <div className={styles['widget-title']}>
                                        Weekly Activity
                                        <span style={{ fontSize: '0.7rem', background: 'var(--bg-hover)', padding: '2px 8px', borderRadius: 4, color: 'var(--text-main)' }}>LIVE</span>
                                    </div>
                                    <div className={styles['chart-container']}>
                                        {weeklyActivity.map((val, i) => (
                                            <div key={i} className={styles['bar-col']}>
                                                <div style={{ textAlign: 'center', marginBottom: '8px', fontSize: '0.8rem', fontWeight: 600, opacity: val > 0 ? 1 : 0, transition: '0.4s', color: 'var(--text-main)' }}>
                                                    {val}%
                                                </div>
                                                <div
                                                    className={styles.bar}
                                                    style={{
                                                        height: `${val}%`,
                                                        transition: 'height 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
                                                        width: '100%',
                                                    }}
                                                />
                                                <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.5px' }}>
                                                    {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'][i]}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Department Breakdown Table */}
                                <div className={styles['widget-box']} style={{ gridColumn: 'span 3' }}>
                                    <div className={styles['widget-title']} style={{ marginBottom: 0, paddingBottom: 16, borderBottom: '1px solid var(--border-subtle)' }}>Department Breakdown</div>
                                    <div className={styles['table-responsive']} style={{ maxHeight: 400, overflowY: 'auto' }}>
                                        <table className={styles['data-table']}>
                                            <thead>
                                                <tr>
                                                    <th>Department</th>
                                                    <th>Total Hours</th>
                                                    <th>Billable Hours</th>
                                                    <th>Billable Ratio</th>
                                                    <th>Active Staff</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {deptBreakdown.map((dept) => {
                                                    const ratioColor = dept.billable_ratio >= 70 ? 'var(--status-success)' : 
                                                                      dept.billable_ratio >= 50 ? 'var(--status-warning)' : 
                                                                      'var(--status-danger)';
                                                    return (
                                                        <tr key={dept.dept_id}>
                                                            <td style={{ fontWeight: 600 }}>{dept.dept_name}</td>
                                                            <td>{dept.total_hours}h</td>
                                                            <td>{dept.billable_hours}h</td>
                                                            <td>
                                                                <span style={{ color: ratioColor, fontWeight: 700 }}>
                                                                    {dept.billable_ratio}%
                                                                </span>
                                                            </td>
                                                            <td>{dept.active_staff}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}
                    </main>
                )}

                {/* REPORTS VIEW */}
                {activeView === 'reports' && (
                    <main className={`${styles['main-view']} ${styles['view-section']}`}>
                        <header className={styles['view-header']}>
                            <div>
                                <div className={styles['page-title']}>Reports</div>
                                <div className={styles['page-subtitle']}>Generate and export organizational reports</div>
                            </div>
                            <div className={styles.controls}>
                                <select className={styles['select-pro']} value={dept} onChange={(e) => setDept(e.target.value)}>
                                    <option value="ALL">All Departments</option>
                                    {deptBreakdown.map(d => (
                                        <option key={d.dept_id} value={d.dept_id.toString()}>{d.dept_name}</option>
                                    ))}
                                </select>
                                <select className={styles['select-pro']} value={period} onChange={(e) => setPeriod(e.target.value)}>
                                    <option value="week">This Week</option>
                                    <option value="month">This Month</option>
                                    <option value="year">This Year</option>
                                </select>
                            </div>
                        </header>

                        <div className={styles['dashboard-grid']} style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                            {/* Report Type Selection */}
                            <div className={styles['widget-box']} style={{ gridColumn: 'span 2' }}>
                                <div className={styles['widget-title']}>Select Report Type</div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', marginTop: '15px' }}>
                                    {[
                                        { value: 'attendance', label: 'Attendance', icon: '📅' },
                                        { value: 'productivity', label: 'Productivity', icon: '📊' },
                                        { value: 'billable', label: 'Billable Hours', icon: '💰' },
                                        { value: 'sentiment', label: 'Sentiment', icon: '😊' },
                                        { value: 'overtime', label: 'Overtime', icon: '⏰' },
                                        { value: 'dept_summary', label: 'Department Summary', icon: '🏢' },
                                    ].map(type => (
                                        <div
                                            key={type.value}
                                            className={`${styles['config-card']} ${reportType === type.value ? styles.selected : ''}`}
                                            onClick={() => setReportType(type.value)}
                                            style={{ cursor: 'pointer', padding: '20px' }}
                                        >
                                            <div style={{ fontSize: '2rem', marginBottom: '10px' }}>{type.icon}</div>
                                            <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{type.label}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Generate Report Button */}
                            <div className={styles['widget-box']} style={{ gridColumn: 'span 2', padding: '30px', textAlign: 'center' }}>
                                <button 
                                    className={`${styles['btn-pro']} ${styles['btn-primary']}`} 
                                    onClick={generateReport}
                                    disabled={loading}
                                    style={{ fontSize: '1.1rem', padding: '15px 40px' }}
                                >
                                    {loading ? 'Generating...' : 'Generate Report'}
                                </button>
                                {reportData && (
                                    <button 
                                        className={styles['btn-pro']} 
                                        onClick={() => setExportModalOpen(true)}
                                        style={{ marginLeft: '15px', fontSize: '1.1rem', padding: '15px 40px' }}
                                    >
                                        Export CSV
                                    </button>
                                )}
                            </div>

                            {/* Report Results */}
                            {reportData && (
                                <div className={styles['widget-box']} style={{ gridColumn: 'span 2' }}>
                                    <div className={styles['widget-title']}>
                                        {reportData.reportType.replace('_', ' ').toUpperCase()} Report - {reportData.period}
                                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '10px' }}>
                                            ({reportData.count} records)
                                        </span>
                                    </div>
                                    <div className={styles['table-responsive']} style={{ maxHeight: 500, overflowY: 'auto', marginTop: '15px' }}>
                                        <table className={styles['data-table']}>
                                            <thead>
                                                <tr>
                                                    {reportData.headers.map((header: string) => (
                                                        <th key={header}>{header}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {reportData.data.slice(0, 50).map((row: any, idx: number) => (
                                                    <tr key={idx}>
                                                        {reportData.headers.map((header: string) => {
                                                            const key = header.toLowerCase().replace(/ /g, '_').replace(/%/g, '');
                                                            return <td key={header}>{row[key] ?? 'N/A'}</td>;
                                                        })}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        {reportData.data.length > 50 && (
                                            <div style={{ padding: '15px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                                Showing 50 of {reportData.count} records. Export to CSV to view all.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </main>
                )}

                {/* SENTIMENT VIEW */}
                {activeView === 'sentiment' && (
                    <main className={`${styles['main-view']} ${styles['view-section']}`}>
                        <header className={styles['view-header']}>
                            <div>
                                <div className={styles['page-title']}>Sentiment Analysis</div>
                                <div className={styles['page-subtitle']}>Employee morale and burnout risk monitoring</div>
                            </div>
                            <div className={styles.controls}>
                                <select className={styles['select-pro']} value={dept} onChange={(e) => setDept(e.target.value)}>
                                    <option value="ALL">All Departments</option>
                                    {deptBreakdown.map(d => (
                                        <option key={d.dept_id} value={d.dept_id.toString()}>{d.dept_name}</option>
                                    ))}
                                </select>
                                <select className={styles['select-pro']} value={period} onChange={(e) => setPeriod(e.target.value)}>
                                    <option value="week">This Week</option>
                                    <option value="month">This Month</option>
                                    <option value="year">This Year</option>
                                </select>
                                <button className={styles['btn-pro']} onClick={fetchSentimentData}>Refresh</button>
                            </div>
                        </header>

                        {loading ? (
                            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
                        ) : sentimentData && (
                            <div className={styles['dashboard-grid']}>
                                {/* Overall Sentiment Cards */}
                                <div className={`${styles['widget-box']} ${styles['stat-card']}`} style={{ '--card-accent': 'var(--status-success)' } as React.CSSProperties}>
                                    <div className={styles['widget-title']}>GREAT Sentiment</div>
                                    <div className={styles['stat-value']} style={{ color: 'var(--status-success)' }}>
                                        <AnimatedValue value={sentimentData.summary.percentages.GREAT} suffix="%" />
                                    </div>
                                    <div className={styles['stat-trend']}>
                                        {sentimentData.summary.counts.GREAT} employees
                                    </div>
                                </div>

                                <div className={`${styles['widget-box']} ${styles['stat-card']}`} style={{ '--card-accent': 'var(--status-warning)' } as React.CSSProperties}>
                                    <div className={styles['widget-title']}>OKAY Sentiment</div>
                                    <div className={styles['stat-value']} style={{ color: 'var(--status-warning)' }}>
                                        <AnimatedValue value={sentimentData.summary.percentages.OKAY} suffix="%" />
                                    </div>
                                    <div className={styles['stat-trend']}>
                                        {sentimentData.summary.counts.OKAY} employees
                                    </div>
                                </div>

                                <div className={`${styles['widget-box']} ${styles['stat-card']}`} style={{ '--card-accent': 'var(--status-danger)' } as React.CSSProperties}>
                                    <div className={styles['widget-title']}>NOT GOOD Sentiment</div>
                                    <div className={styles['stat-value']} style={{ color: 'var(--status-danger)' }}>
                                        <AnimatedValue value={sentimentData.summary.percentages.NOT_GOOD} suffix="%" />
                                    </div>
                                    <div className={styles['stat-trend']}>
                                        {sentimentData.summary.counts.NOT_GOOD} employees
                                    </div>
                                </div>

                                {/* Burnout Risks */}
                                <div className={styles['widget-box']} style={{ gridColumn: 'span 3' }}>
                                    <div className={styles['widget-title']} style={{ color: 'var(--status-danger)' }}>
                                        ⚠️ Burnout Risk Alerts
                                    </div>
                                    <div className={styles['table-responsive']} style={{ maxHeight: 400, overflowY: 'auto' }}>
                                        <table className={styles['data-table']}>
                                            <thead>
                                                <tr>
                                                    <th>Employee</th>
                                                    <th>Department</th>
                                                    <th>Team</th>
                                                    <th>NOT GOOD Count</th>
                                                    <th>Latest Sentiment</th>
                                                    <th>Risk Level</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {sentimentData.burnoutRisks.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={6} style={{ textAlign: 'center', padding: '20px', color: 'var(--status-success)' }}>
                                                            ✅ No burnout risks detected
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    sentimentData.burnoutRisks.map((risk: any) => (
                                                        <tr key={risk.user_id}>
                                                            <td style={{ fontWeight: 600 }}>{risk.name}</td>
                                                            <td>{risk.department}</td>
                                                            <td>{risk.team}</td>
                                                            <td style={{ fontWeight: 700, color: 'var(--status-danger)' }}>{risk.not_good_count}</td>
                                                            <td>
                                                                <span className={styles['status-badge']} style={{ 
                                                                    background: risk.latest_sentiment === 'GREAT' ? 'var(--status-success)' : 
                                                                               risk.latest_sentiment === 'OKAY' ? 'var(--status-warning)' : 'var(--status-danger)',
                                                                    color: 'white',
                                                                }}>
                                                                    {risk.latest_sentiment}
                                                                </span>
                                                            </td>
                                                            <td>
                                                                <span className={styles['status-badge']} style={{ 
                                                                    background: risk.risk_level === 'HIGH' ? 'var(--status-danger)' : 'var(--status-warning)',
                                                                    color: 'white',
                                                                }}>
                                                                    {risk.risk_level}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}
                    </main>
                )}

                {/* PERFORMERS VIEW */}
                {activeView === 'performers' && (
                    <main className={`${styles['main-view']} ${styles['view-section']}`}>
                        <header className={styles['view-header']}>
                            <div>
                                <div className={styles['page-title']}>Performance Analysis</div>
                                <div className={styles['page-subtitle']}>Top and bottom performers ranking</div>
                            </div>
                            <div className={styles.controls}>
                                <select className={styles['select-pro']} value={dept} onChange={(e) => setDept(e.target.value)}>
                                    <option value="ALL">All Departments</option>
                                    {deptBreakdown.map(d => (
                                        <option key={d.dept_id} value={d.dept_id.toString()}>{d.dept_name}</option>
                                    ))}
                                </select>
                                <select className={styles['select-pro']} value={period} onChange={(e) => setPeriod(e.target.value)}>
                                    <option value="week">This Week</option>
                                    <option value="month">This Month</option>
                                    <option value="year">This Year</option>
                                </select>
                                <button className={styles['btn-pro']} onClick={fetchPerformerData}>Refresh</button>
                            </div>
                        </header>

                        {loading ? (
                            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
                        ) : performerData && (
                            <div className={styles['dashboard-grid']} style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                                {/* Performance Distribution */}
                                <div className={`${styles['widget-box']} ${styles['stat-card']}`} style={{ '--card-accent': 'var(--status-success)' } as React.CSSProperties}>
                                    <div className={styles['widget-title']}>Excellent (90+)</div>
                                    <div className={styles['stat-value']} style={{ color: 'var(--status-success)' }}>
                                        <AnimatedValue value={performerData.performanceDistribution.excellent} />
                                    </div>
                                </div>

                                <div className={`${styles['widget-box']} ${styles['stat-card']}`} style={{ '--card-accent': 'var(--color-go)' } as React.CSSProperties}>
                                    <div className={styles['widget-title']}>Good (70-89)</div>
                                    <div className={styles['stat-value']} style={{ color: 'var(--color-go)' }}>
                                        <AnimatedValue value={performerData.performanceDistribution.good} />
                                    </div>
                                </div>

                                <div className={`${styles['widget-box']} ${styles['stat-card']}`} style={{ '--card-accent': 'var(--status-warning)' } as React.CSSProperties}>
                                    <div className={styles['widget-title']}>Average (50-69)</div>
                                    <div className={styles['stat-value']} style={{ color: 'var(--status-warning)' }}>
                                        <AnimatedValue value={performerData.performanceDistribution.average} />
                                    </div>
                                </div>

                                <div className={`${styles['widget-box']} ${styles['stat-card']}`} style={{ '--card-accent': 'var(--status-danger)' } as React.CSSProperties}>
                                    <div className={styles['widget-title']}>Below Avg (&lt;50)</div>
                                    <div className={styles['stat-value']} style={{ color: 'var(--status-danger)' }}>
                                        <AnimatedValue value={performerData.performanceDistribution.below_average} />
                                    </div>
                                </div>

                                {/* Top Performers */}
                                <div className={styles['widget-box']} style={{ gridColumn: 'span 2' }}>
                                    <div className={styles['widget-title']} style={{ color: 'var(--status-success)' }}>🏆 Top Performers</div>
                                    <div className={styles['table-responsive']} style={{ maxHeight: 450, overflowY: 'auto' }}>
                                        <table className={styles['data-table']}>
                                            <thead>
                                                <tr>
                                                    <th>#</th>
                                                    <th>Name</th>
                                                    <th>Department</th>
                                                    <th>Score</th>
                                                    <th>Total Hours</th>
                                                    <th>Billable %</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {performerData.topPerformers.map((performer: any, idx: number) => (
                                                    <tr key={performer.user_id}>
                                                        <td style={{ fontWeight: 700 }}>{idx + 1}</td>
                                                        <td style={{ fontWeight: 600 }}>{performer.name}</td>
                                                        <td>{performer.department}</td>
                                                        <td>
                                                            <span style={{ 
                                                                fontWeight: 700, 
                                                                color: performer.productivity_score >= 90 ? 'var(--status-success)' : 
                                                                       performer.productivity_score >= 70 ? 'var(--color-go)' : 'var(--status-warning)'
                                                            }}>
                                                                {performer.productivity_score}
                                                            </span>
                                                        </td>
                                                        <td>{performer.total_hours}h</td>
                                                        <td>{performer.billable_ratio}%</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Bottom Performers */}
                                <div className={styles['widget-box']} style={{ gridColumn: 'span 2' }}>
                                    <div className={styles['widget-title']} style={{ color: 'var(--status-danger)' }}>⚠️ Needs Improvement</div>
                                    <div className={styles['table-responsive']} style={{ maxHeight: 450, overflowY: 'auto' }}>
                                        <table className={styles['data-table']}>
                                            <thead>
                                                <tr>
                                                    <th>Name</th>
                                                    <th>Department</th>
                                                    <th>Score</th>
                                                    <th>Total Hours</th>
                                                    <th>Billable %</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {performerData.bottomPerformers.map((performer: any) => (
                                                    <tr key={performer.user_id}>
                                                        <td style={{ fontWeight: 600 }}>{performer.name}</td>
                                                        <td>{performer.department}</td>
                                                        <td>
                                                            <span style={{ 
                                                                fontWeight: 700, 
                                                                color: performer.productivity_score < 50 ? 'var(--status-danger)' : 'var(--status-warning)'
                                                            }}>
                                                                {performer.productivity_score}
                                                            </span>
                                                        </td>
                                                        <td>{performer.total_hours}h</td>
                                                        <td>{performer.billable_ratio}%</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}
                    </main>
                )}

                {/* OVERTIME VIEW */}
                {activeView === 'overtime' && (
                    <main className={`${styles['main-view']} ${styles['view-section']}`}>
                        <header className={styles['view-header']}>
                            <div>
                                <div className={styles['page-title']}>OT & Early Clockouts</div>
                                <div className={styles['page-subtitle']}>Overtime requests and early departure monitoring</div>
                            </div>
                            <div className={styles.controls}>
                                <select className={styles['select-pro']} value={dept} onChange={(e) => setDept(e.target.value)}>
                                    <option value="ALL">All Departments</option>
                                    {deptBreakdown.map(d => (
                                        <option key={d.dept_id} value={d.dept_id.toString()}>{d.dept_name}</option>
                                    ))}
                                </select>
                                <select className={styles['select-pro']} value={period} onChange={(e) => setPeriod(e.target.value)}>
                                    <option value="week">This Week</option>
                                    <option value="month">This Month</option>
                                    <option value="year">This Year</option>
                                </select>
                                <button className={styles['btn-pro']} onClick={fetchOvertimeData}>Refresh</button>
                            </div>
                        </header>

                        {loading ? (
                            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
                        ) : overtimeData && (
                            <div className={styles['dashboard-grid']}>
                                {/* Summary Cards */}
                                <div className={`${styles['widget-box']} ${styles['stat-card']}`} style={{ '--card-accent': 'var(--accent-blue)' } as React.CSSProperties}>
                                    <div className={styles['widget-title']}>OT Requests</div>
                                    <div className={styles['stat-value']}>
                                        <AnimatedValue value={overtimeData.summary.total_ot_requests} />
                                    </div>
                                </div>

                                <div className={`${styles['widget-box']} ${styles['stat-card']}`} style={{ '--card-accent': 'var(--status-warning)' } as React.CSSProperties}>
                                    <div className={styles['widget-title']}>Early Clockouts</div>
                                    <div className={styles['stat-value']}>
                                        <AnimatedValue value={overtimeData.summary.total_early_clockouts} />
                                    </div>
                                </div>

                                <div className={`${styles['widget-box']} ${styles['stat-card']}`} style={{ '--card-accent': 'var(--status-danger)' } as React.CSSProperties}>
                                    <div className={styles['widget-title']}>Flagged Issues</div>
                                    <div className={styles['stat-value']} style={{ color: 'var(--status-danger)' }}>
                                        <AnimatedValue value={overtimeData.flags.length} />
                                    </div>
                                </div>

                                {/* Flags Table */}
                                <div className={styles['widget-box']} style={{ gridColumn: 'span 3' }}>
                                    <div className={styles['widget-title']}>⚠️ Flagged Employees</div>
                                    <div className={styles['table-responsive']} style={{ maxHeight: 400, overflowY: 'auto' }}>
                                        <table className={styles['data-table']}>
                                            <thead>
                                                <tr>
                                                    <th>Employee</th>
                                                    <th>Department</th>
                                                    <th>Flag Type</th>
                                                    <th>Reason</th>
                                                    <th>Severity</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {overtimeData.flags.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={5} style={{ textAlign: 'center', padding: '20px', color: 'var(--status-success)' }}>
                                                            ✅ No issues detected
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    overtimeData.flags.map((flag: any, idx: number) => (
                                                        <tr key={idx}>
                                                            <td style={{ fontWeight: 600 }}>{flag.name}</td>
                                                            <td>{flag.department}</td>
                                                            <td>
                                                                <span className={styles['status-badge']} style={{ 
                                                                    background: flag.flag_type === 'HIGH_OT' ? 'var(--accent-blue)' : 'var(--status-warning)',
                                                                    color: 'white',
                                                                }}>
                                                                    {flag.flag_type.replace('_', ' ')}
                                                                </span>
                                                            </td>
                                                            <td>{flag.flag_reason}</td>
                                                            <td>
                                                                <span className={styles['status-badge']} style={{ 
                                                                    background: flag.severity === 'HIGH' ? 'var(--status-danger)' : 'var(--status-warning)',
                                                                    color: 'white',
                                                                }}>
                                                                    {flag.severity}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}
                    </main>
                )}

                {/* AUDIT LOGS VIEW */}
                {activeView === 'audit' && (
                    <main className={`${styles['main-view']} ${styles['view-section']}`}>
                        <header className={styles['view-header']}>
                            <div>
                                <div className={styles['page-title']}>Audit Logs</div>
                                <div className={styles['page-subtitle']}>System-wide change tracking</div>
                            </div>
                            <div className={styles.controls}>
                                <button className={styles['btn-pro']} onClick={fetchAuditLogs}>Refresh</button>
                            </div>
                        </header>

                        {loading ? (
                            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
                        ) : (
                            <div className={styles['widget-box']}>
                                <div className={styles['table-responsive']} style={{ maxHeight: 600, overflowY: 'auto' }}>
                                    <table className={styles['data-table']}>
                                        <thead>
                                            <tr>
                                                <th>ID</th>
                                                <th>User</th>
                                                <th>Action</th>
                                                <th>Table</th>
                                                <th>Old Value</th>
                                                <th>New Value</th>
                                                <th>Timestamp</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {auditLogs.map((log) => (
                                                <tr key={log.audit_id}>
                                                    <td>{log.audit_id}</td>
                                                    <td style={{ fontWeight: 600 }}>
                                                        {log.user_name}
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{log.user_email}</div>
                                                    </td>
                                                    <td>
                                                        <span className={styles['status-badge']} style={{ 
                                                            background: log.action_type === 'CREATE' ? 'var(--status-success)' : 
                                                                       log.action_type === 'UPDATE' ? 'var(--accent-blue)' : 
                                                                       log.action_type === 'DELETE' ? 'var(--status-danger)' : 'var(--bg-input)',
                                                            color: 'white',
                                                        }}>
                                                            {log.action_type}
                                                        </span>
                                                    </td>
                                                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>{log.table_affected}</td>
                                                    <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                                        {log.old_value ? (log.old_value.length > 30 ? log.old_value.substring(0, 30) + '...' : log.old_value) : '-'}
                                                    </td>
                                                    <td style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>
                                                        {log.new_value ? (log.new_value.length > 30 ? log.new_value.substring(0, 30) + '...' : log.new_value) : '-'}
                                                    </td>
                                                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                        {log.created_at ? new Date(log.created_at).toLocaleString() : 'N/A'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Pagination */}
                                {auditTotalPages > 1 && (
                                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', marginTop: '20px' }}>
                                        <button 
                                            className={styles['btn-pro']} 
                                            onClick={() => setAuditPage(Math.max(1, auditPage - 1))}
                                            disabled={auditPage === 1}
                                        >
                                            Previous
                                        </button>
                                        <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>
                                            Page {auditPage} of {auditTotalPages}
                                        </span>
                                        <button 
                                            className={styles['btn-pro']} 
                                            onClick={() => setAuditPage(Math.min(auditTotalPages, auditPage + 1))}
                                            disabled={auditPage === auditTotalPages}
                                        >
                                            Next
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </main>
                )}
                
            </div>

            {/* EXPORT MODAL */}
            {exportModalOpen && (
                <div className={styles['modal-overlay']} style={{ display: 'flex' }} onClick={() => setExportModalOpen(false)}>
                    <div className={styles['modal-card']} onClick={e => e.stopPropagation()}>
                        <div className={`${styles['modal-header']} ${styles['header-normal']}`}>
                            <span className={styles['modal-title']}>Export Report</span>
                        </div>
                        <div className={styles['modal-body']}>
                            <p style={{ color: 'var(--text-main)', marginBottom: '15px' }}>
                                Export {reportType.replace('_', ' ')} report for {period}?
                            </p>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                This will download a CSV file with all {reportData?.count} records.
                            </p>
                        </div>
                        <div className={styles['modal-footer']}>
                            <button className={`${styles['btn-action']} ${styles.secondary}`} onClick={() => setExportModalOpen(false)}>
                                Cancel
                            </button>
                            <button className={`${styles['btn-action']} ${styles.primary}`} onClick={exportReport} disabled={loading}>
                                {loading ? 'Exporting...' : 'Download CSV'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
        </div>
    );
}
