"use client";

import { useState } from "react";
import * as XLSX from "xlsx";

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
      const data = await file.arrayBuffer();
      
      // cellDates: true forces the library to recognize Excel serial numbers as Dates
      const workbook = XLSX.read(data, { type: "array", cellDates: true });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // raw: false ensures cells output as formatted strings instead of raw integers
      // dateNF ensures any recognized dates are strictly formatted for the database
      const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { 
          header: 1, 
          defval: "",
          raw: false,
          dateNF: "yyyy-mm-dd"
      });
      
      // Filter out completely empty rows
      const validRows = rows.filter(row => row.some(cell => String(cell).trim() !== ""));

      if (validRows.length < 2) {
        setMessage("File is empty or missing data rows.");
        setImporting(false);
        return;
      }

      // Skip the header row (index 0)
      const dataLines = validRows.slice(1);
      
      const users = dataLines.map((row, index) => {
        // Safely extract values, allowing for missing trailing columns
        const safeVal = (idx: number) => (row[idx] !== undefined ? String(row[idx]).trim() : "");
        
        if (!safeVal(0)) throw new Error(`Row ${index + 2}: Missing User ID`);

        // Extra safeguard to ensure the date isn't empty after formatting
        let hireDateStr = safeVal(10);
        if (!hireDateStr) {
           throw new Error(`Row ${index + 2}: Missing or invalid Hire Date`);
        }

        return {
          user_id: safeVal(0),
          first_name: safeVal(1),
          last_name: safeVal(2),
          email: safeVal(3),
          role_id: safeVal(4),
          pos_id: safeVal(5),
          dept_id: safeVal(6),
          team_id: safeVal(7) || null,
          supervisor_id: safeVal(8) || null,
          manager_id: safeVal(9) || null,
          hire_date: hireDateStr,
          password: safeVal(11) || "Welcome123!",
        };
      });

      const res = await fetch("/api/import/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ users }),
      });

      const responseData = await res.json();
      if (res.ok) {
        setImportResult(responseData.results);
        setMessage(responseData.message);
      } else {
        setMessage(responseData.message || "Failed to import users");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to parse file. Please check the format.");
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
              UPLOAD EMPLOYEE DATA
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
                {showInstructions ? "HIDE" : "SHOW"} IMPORT INSTRUCTIONS
              </button>

              <label
                htmlFor="excel-import"
                className="btn-action admin-btn"
                style={{
                  display: "inline-flex",
                  alignItems: 'center',
                  gap: '8px',
                  cursor: importing ? "not-allowed" : "pointer",
                  padding: '10px 20px',
                  fontSize: '0.85rem',
                  fontWeight: 'bold',
                  backgroundColor: '#3b82f6',
                  opacity: importing ? 0.7 : 1
                }}
              >
                {importing ? (
                  <>
                    <svg style={{ animation: 'spin 1s linear infinite', height: '1.2rem', width: '1.2rem' }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    IMPORTING...
                  </>
                ) : (
                  <>
                    📥 IMPORT (.csv, .xlsx, .xls)
                  </>
                )}
              </label>
              <input
                id="excel-import"
                type="file"
                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
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
                  IMPORT REQUIREMENTS:
                </div>
                <ul style={{ color: '#ccc', paddingLeft: '1.2rem', marginBottom: '1rem' }}>
                    <li>Files must be saved in <strong>.csv</strong>, <strong>.xlsx</strong>, or <strong>.xls</strong> format.</li>
                    <li>The first row (Row 1) is reserved for headers and will be ignored during import.</li>
                    <li>Data should strictly begin on Row 2.</li>
                </ul>
                <div style={{ fontWeight: 800, marginBottom: "0.5rem", color: 'var(--color-go)' }}>
                  COLUMN ORDER (A to L):
                </div>
                <ol style={{ marginLeft: "1.2rem", color: '#ccc', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                  <li>user_id (Required)</li>
                  <li>first_name (Required)</li>
                  <li>last_name (Required)</li>
                  <li>email (Required)</li>
                  <li>role_id (Required - Number)</li>
                  <li>pos_id (Required - Number)</li>
                  <li>dept_id (Required - Number)</li>
                  <li>team_id (Optional)</li>
                  <li>supervisor_id (Optional)</li>
                  <li>manager_id (Optional)</li>
                  <li>hire_date (YYYY-MM-DD)</li>
                  <li>password (Required - Raw Text)</li>
                </ol>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}