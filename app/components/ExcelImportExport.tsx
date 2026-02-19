"use client";

import { useState } from "react";

type ImportResult = {
  success: number;
  failed: number;
  errors: string[];
};

export default function ExcelImportExport() {
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState("");
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);

  const handleImportUsers = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setMessage("");
    setImportResult(null);

    try {
      const text = await file.text();
      const lines = text.split("\n").filter((line) => line.trim());
      
      if (lines.length < 2) {
        setMessage("CSV file is empty or invalid");
        setImporting(false);
        return;
      }

      const dataLines = lines.slice(1);
      const users = dataLines.map((line, index) => {
        const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
        if (values.length < 11) throw new Error(`Row ${index + 2}: Invalid columns`);

        return {
          user_id: values[0],
          first_name: values[1],
          last_name: values[2],
          email: values[3],
          role_id: values[4],
          pos_id: values[5],
          dept_id: values[6],
          team_id: values[7] || null,
          supervisor_id: values[8] || null,
          manager_id: values[9] || null,
          hire_date: values[10],
          password: values[11] || "Welcome123!",
        };
      });

      const res = await fetch("/api/import/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ users }),
      });

      const data = await res.json();
      if (res.ok) {
        setImportResult(data.results);
        setMessage(data.message);
      } else {
        setMessage(data.message || "Failed to import users");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to import users");
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  return (
    <div className="excel-import-export">
      {message && (
        <div style={{ 
          padding: "1rem", 
          marginBottom: "1.5rem", 
          background: message.includes("success") ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", 
          border: `1px solid ${message.includes("success") ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`, 
          borderRadius: "8px", 
          color: message.includes("success") ? "#22c55e" : "#ef4444" 
        }}>
          {message}
        </div>
      )}

      {importResult && (
        <div className="glass-card" style={{ marginBottom: "1.5rem" }}>
          <div className="section-title">IMPORT RESULTS</div>
          <div style={{ padding: "1.5rem" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
              <div style={{ textAlign: "center", padding: "1rem", background: "rgba(34,197,94,0.1)", borderRadius: "8px" }}>
                <div style={{ fontSize: "2rem", fontWeight: 700, color: "#22c55e" }}>{importResult.success}</div>
                <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>SUCCESSFUL</div>
              </div>
              <div style={{ textAlign: "center", padding: "1rem", background: "rgba(239,68,68,0.1)", borderRadius: "8px" }}>
                <div style={{ fontSize: "2rem", fontWeight: 700, color: "#ef4444" }}>{importResult.failed}</div>
                <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>FAILED</div>
              </div>
            </div>
            {importResult.errors.length > 0 && (
              <div style={{ maxHeight: "200px", overflow: "auto", background: "rgba(0,0,0,0.2)", padding: "1rem", borderRadius: "4px" }}>
                {importResult.errors.map((err, idx) => <div key={idx} style={{ fontSize: "0.85rem", color: "#ef4444" }}>• {err}</div>)}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="glass-card">
        <div className="section-title" style={{ textTransform: 'uppercase', letterSpacing: '1px' }}>
          Bulk User Import
        </div>
        
        <div style={{ padding: "1.5rem" }}>
          <div>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "1.5rem", color: 'var(--text-main)' }}>
              UPLOAD CSV DATA
            </h3>
            
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <button
                className="btn-action"
                onClick={() => setShowInstructions(!showInstructions)}
                style={{ 
                  backgroundColor: '#444', 
                  padding: '10px 20px',
                  fontSize: '0.85rem',
                  fontWeight: 'bold',
                  border: '1px solid #555'
                }}
              >
                {showInstructions ? "HIDE" : "SHOW"} CSV FORMAT INSTRUCTIONS
              </button>

              <label
                htmlFor="csv-import"
                className="btn-action admin-btn"
                style={{ 
                  display: "inline-flex", 
                  alignItems: 'center', 
                  gap: '8px', 
                  cursor: "pointer",
                  padding: '10px 20px',
                  fontSize: '0.85rem',
                  fontWeight: 'bold',
                  backgroundColor: '#3b82f6'
                }}
              >
                📥 SELECT CSV FILE
              </label>
              <input
                id="csv-import"
                type="file"
                accept=".csv"
                onChange={handleImportUsers}
                disabled={importing}
                style={{ display: "none" }}
              />
            </div>

            {showInstructions && (
              <div style={{ 
                padding: "1.25rem", 
                background: "rgba(255,255,255,0.03)", 
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: "8px", 
                marginTop: "1.5rem", 
                fontSize: "0.9rem",
                lineHeight: '1.6'
              }}>
                <div style={{ fontWeight: 800, marginBottom: "0.75rem", color: 'var(--color-go)' }}>
                  CSV FORMAT REQUIREMENTS:
                </div>
                <ol style={{ marginLeft: "1.2rem", color: '#ccc' }}>
                  <li>user_id, first_name, last_name, email, role_id, pos_id, dept_id, team_id, supervisor_id, manager_id, hire_date, password</li>
                </ol>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}