"use client";

import { useState } from "react";

type ImportResult = {
  success: number;
  failed: number;
  errors: string[];
};

export default function ExcelImportExport() {
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState("");
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);

  const handleExportUsers = async () => {
    setExporting(true);
    setMessage("");
    try {
      const res = await fetch("/api/export/users");
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `users_export_${new Date().toISOString().split("T")[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        setMessage("Users exported successfully!");
      } else {
        setMessage("Failed to export users");
      }
    } catch (error) {
      setMessage("Failed to export users");
      console.error(error);
    } finally {
      setExporting(false);
    }
  };

  const handleExportTimesheets = async () => {
    const startDate = prompt("Enter start date (YYYY-MM-DD):");
    const endDate = prompt("Enter end date (YYYY-MM-DD):");

    if (!startDate || !endDate) {
      setMessage("Export cancelled");
      return;
    }

    setExporting(true);
    setMessage("");
    try {
      const res = await fetch(`/api/export/timesheets?start_date=${startDate}&end_date=${endDate}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `timesheets_${startDate}_to_${endDate}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        setMessage("Timesheets exported successfully!");
      } else {
        const data = await res.json();
        setMessage(data.message || "Failed to export timesheets");
      }
    } catch (error) {
      setMessage("Failed to export timesheets");
      console.error(error);
    } finally {
      setExporting(false);
    }
  };

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

      // Skip header row
      const dataLines = lines.slice(1);
      
      // Parse CSV (simple parser - doesn't handle quotes with commas inside)
      const users = dataLines.map((line, index) => {
        const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
        
        if (values.length < 11) {
          throw new Error(`Row ${index + 2}: Invalid number of columns`);
        }

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
          password: values[11] || "Welcome123!", // Default password if not provided
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
      console.error(error);
    } finally {
      setImporting(false);
      // Reset file input
      e.target.value = "";
    }
  };

  return (
    <div className="excel-import-export">
      {message && (
        <div
          style={{
            padding: "1rem",
            marginBottom: "1.5rem",
            background: message.includes("success") ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
            border: `1px solid ${message.includes("success") ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
            borderRadius: "8px",
            color: message.includes("success") ? "#22c55e" : "#ef4444",
          }}
        >
          {message}
        </div>
      )}

      {importResult && (
        <div className="glass-card" style={{ marginBottom: "1.5rem" }}>
          <div className="section-title">Import Results</div>
          <div style={{ padding: "1.5rem" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
              <div style={{ textAlign: "center", padding: "1rem", background: "rgba(34,197,94,0.1)", borderRadius: "8px" }}>
                <div style={{ fontSize: "2rem", fontWeight: 700, color: "#22c55e" }}>
                  {importResult.success}
                </div>
                <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Successful</div>
              </div>
              <div style={{ textAlign: "center", padding: "1rem", background: "rgba(239,68,68,0.1)", borderRadius: "8px" }}>
                <div style={{ fontSize: "2rem", fontWeight: 700, color: "#ef4444" }}>
                  {importResult.failed}
                </div>
                <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Failed</div>
              </div>
            </div>

            {importResult.errors.length > 0 && (
              <div>
                <div style={{ fontWeight: 600, marginBottom: "0.5rem" }}>Errors:</div>
                <div
                  style={{
                    maxHeight: "200px",
                    overflow: "auto",
                    background: "rgba(0,0,0,0.2)",
                    padding: "1rem",
                    borderRadius: "4px",
                  }}
                >
                  {importResult.errors.map((error, idx) => (
                    <div key={idx} style={{ fontSize: "0.85rem", marginBottom: "0.25rem", color: "#ef4444" }}>
                      • {error}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="glass-card">
        <div className="section-title">Excel Import/Export</div>
        
        <div style={{ padding: "1.5rem" }}>
          {/* Export Section */}
          <div style={{ marginBottom: "2rem" }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "1rem" }}>Export Data</h3>
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
              <button
                className="btn-action btn-standard admin-btn"
                onClick={handleExportUsers}
                disabled={exporting}
              >
                {exporting ? "Exporting..." : "📥 Export All Users"}
              </button>
              <button
                className="btn-action btn-standard admin-btn"
                onClick={handleExportTimesheets}
                disabled={exporting}
              >
                {exporting ? "Exporting..." : "📥 Export Timesheets"}
              </button>
            </div>
          </div>

          {/* Import Section */}
          <div>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "1rem" }}>Import Users</h3>
            
            <button
              className="btn-action btn-standard"
              onClick={() => setShowInstructions(!showInstructions)}
              style={{ marginBottom: "1rem" }}
            >
              {showInstructions ? "Hide" : "Show"} CSV Format Instructions
            </button>

            {showInstructions && (
              <div
                style={{
                  padding: "1rem",
                  background: "rgba(255,255,255,0.05)",
                  borderRadius: "8px",
                  marginBottom: "1rem",
                  fontSize: "0.9rem",
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: "0.5rem" }}>CSV Format Requirements:</div>
                <div style={{ marginBottom: "0.5rem" }}>
                  The CSV file must have the following columns in order:
                </div>
                <ol style={{ marginLeft: "1.5rem", marginBottom: "0.5rem" }}>
                  <li>user_id (e.g., EMP001)</li>
                  <li>first_name</li>
                  <li>last_name</li>
                  <li>email</li>
                  <li>role_id (1=Employee, 2=Supervisor, 3=Manager, 4=Admin)</li>
                  <li>pos_id (position ID from system)</li>
                  <li>dept_id (department ID from system)</li>
                  <li>team_id (optional, leave empty if none)</li>
                  <li>supervisor_id (optional)</li>
                  <li>manager_id (optional)</li>
                  <li>hire_date (YYYY-MM-DD format)</li>
                  <li>password (optional, defaults to "Welcome123!")</li>
                </ol>
                <div style={{ color: "var(--color-warn)" }}>
                  ⚠️ First row should be headers and will be skipped.
                </div>
              </div>
            )}

            <div>
              <label
                htmlFor="csv-import"
                className="btn-action btn-standard admin-btn"
                style={{ display: "inline-block", cursor: "pointer" }}
              >
                {importing ? "Importing..." : "📤 Select CSV File to Import"}
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
          </div>
        </div>
      </div>
    </div>
  );
}
