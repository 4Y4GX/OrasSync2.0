"use client";

import { useState, useEffect } from "react";

type AuditLog = {
  audit_id: number;
  changed_by: string;
  action_type: string;
  created_at: string;
  // We fetch these but don't show them
  table_affected?: string; 
};

export default function AnalyticsView() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/audit");
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs);
      }
    } catch (error) {
      console.error("Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  return (
    <div className="glass-card">
      <div className="section-title" style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <span>Audit Analytics</span>
        <button className="btn-mini" onClick={loadLogs}>Refresh</button>
      </div>

      <div className="table-container" style={{ maxHeight: "600px", overflowY: "auto" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Admin / User</th>
              <th>Action Type</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} style={{textAlign:'center', padding:'2rem'}}>Loading Audit Data...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={4} style={{textAlign:'center', padding:'2rem'}}>No activity recorded</td></tr>
            ) : (
              logs.map((log) => (
                <tr key={log.audit_id}>
                  <td style={{fontFamily:'var(--font-mono)', fontSize:'0.9rem'}}>
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td style={{fontWeight:600}}>{log.changed_by}</td>
                  <td>
                    <span className="status-badge-admin active" style={{background: 'rgba(255,255,255,0.1)'}}>
                        {log.action_type}
                    </span>
                  </td>
                  <td>
                      <span style={{color:'var(--color-go)'}}>Completed</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}