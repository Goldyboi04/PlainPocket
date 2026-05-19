import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "./Statements.css";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function Statements() {
  const [monthlySummary, setMonthlySummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [collapsedMonths, setCollapsedMonths] = useState({});
  const navigate = useNavigate();

  const fetchMonthlySummary = async () => {
    try {
      const token = localStorage.getItem("pp_token");
      const response = await axios.get("http://localhost:5000/api/statements/monthly-summary", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        let summary = response.data.monthly_summary || [];
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;
        
        if (summary.length > 0) {
          const hasCurrentMonth = summary.some(m => m.year === currentYear && m.month === currentMonth);
          if (!hasCurrentMonth) {
            summary = [
              {
                year: currentYear,
                month: currentMonth,
                txn_count: 0,
                total_debit: 0,
                total_income: 0,
                statements: []
              },
              ...summary
            ];
          }
        }
        
        setMonthlySummary(summary);
      }
    } catch (error) {
      console.error("Error fetching monthly summary:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonthlySummary();
  }, []);

  const toggleMonth = (key) => {
    setCollapsedMonths(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this statement? All its transactions will be removed.")) return;

    try {
      const token = localStorage.getItem("pp_token");
      const response = await axios.delete(`http://localhost:5000/api/statements/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setMessage({ type: "success", text: response.data.message });
        fetchMonthlySummary();
      }
    } catch (error) {
      setMessage({ type: "error", text: error.response?.data?.message || "Failed to delete statement" });
    }
    setTimeout(() => setMessage(null), 3500);
  };

  const totalStatements = new Set(
    monthlySummary.flatMap(m => m.statements.map(s => s.id))
  ).size;

  return (
    <div className="stmts-page">
      <div className="stmts-header">
        <div>
          <h1>Statements</h1>
          <p>Your uploaded bank statements organised by month.</p>
        </div>
        <button className="stmts-upload-btn" onClick={() => navigate("/upload")}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          Upload Statement
        </button>
      </div>

      {message && (
        <div className={`stmts-toast ${message.type}`}>
          {message.type === "success" ? (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
          )}
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="stmts-loading">
          <div className="stmts-spinner"></div>
          <span>Loading statements...</span>
        </div>
      ) : monthlySummary.length === 0 ? (
        <div className="stmts-empty">
          <div className="stmts-empty-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
              <polyline points="13 2 13 9 20 9" />
            </svg>
          </div>
          <h2>No statements uploaded yet</h2>
          <p>Upload a CSV bank statement to start tracking your finances.</p>
          <button className="stmts-upload-btn" onClick={() => navigate("/upload")}>
            Upload your first statement
          </button>
        </div>
      ) : (
        <>
          {/* Summary strip */}
          <div className="stmts-summary-strip">
            <div className="stmts-summary-item">
              <span className="stmts-summary-val">{totalStatements}</span>
              <span className="stmts-summary-label">Statements</span>
            </div>
            <div className="stmts-summary-divider" />
            <div className="stmts-summary-item">
              <span className="stmts-summary-val">{monthlySummary.length}</span>
              <span className="stmts-summary-label">Months covered</span>
            </div>
            <div className="stmts-summary-divider" />
            <div className="stmts-summary-item">
              <span className="stmts-summary-val">
                ₹{monthlySummary.reduce((s, m) => s + m.total_debit, 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </span>
              <span className="stmts-summary-label">Total spent (all time)</span>
            </div>
          </div>

          {/* Month groups */}
          <div className="stmts-months">
            {monthlySummary.map(monthData => {
              const key = `${monthData.year}-${monthData.month}`;
              const isCollapsed = collapsedMonths[key];
              const now = new Date();
              const isCurrent = monthData.month === now.getMonth() + 1 && monthData.year === now.getFullYear();

              return (
                <div key={key} className="stmts-month-group">
                  {/* Month header row */}
                  <button
                    className="stmts-month-header"
                    onClick={() => toggleMonth(key)}
                    aria-expanded={!isCollapsed}
                  >
                    <div className="stmts-month-title">
                      <div className="stmts-month-dot" />
                      <span className="stmts-month-name">
                        {MONTH_NAMES[monthData.month - 1]} {monthData.year}
                      </span>
                      {isCurrent && <span className="stmts-current-badge">Current</span>}
                    </div>

                    <div className="stmts-month-stats">
                      <div className="stmts-stat-chip debit">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" />
                        </svg>
                        ₹{monthData.total_debit.toLocaleString('en-IN', { maximumFractionDigits: 0 })} spent
                      </div>
                      <div className="stmts-stat-chip income">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
                        </svg>
                        ₹{monthData.total_income.toLocaleString('en-IN', { maximumFractionDigits: 0 })} income
                      </div>
                      <div className="stmts-stat-chip neutral">
                        {monthData.txn_count} txns
                      </div>
                      <svg
                        className={`stmts-chevron ${isCollapsed ? '' : 'open'}`}
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </div>
                  </button>

                  {/* Statement cards inside month */}
                  {!isCollapsed && (
                    <div className="stmts-month-body">
                      {monthData.statements.length === 0 ? (
                        <div style={{ padding: '24px 20px', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                          No statements uploaded for this month.
                        </div>
                      ) : (
                        monthData.statements.map(stmt => (
                        <div key={stmt.id} className="stmts-card">
                          <div className="stmts-card-left">
                            <div className="stmts-bank-icon">
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                                <polyline points="13 2 13 9 20 9" />
                              </svg>
                            </div>
                            <div className="stmts-card-info">
                              <span className="stmts-card-name">{stmt.file_name}</span>
                              <span className="stmts-card-meta">
                                <span className="stmts-bank-tag">{stmt.bank_name}</span>
                                <span className="stmts-dot-sep">·</span>
                                {stmt.txn_count_in_month} transactions this month
                              </span>
                            </div>
                          </div>
                          <div className="stmts-card-right">
                            <div className="stmts-card-amounts">
                              <span className="stmts-amount debit">−₹{stmt.debit_in_month.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                              <span className="stmts-amount income">+₹{stmt.credit_in_month.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                            </div>
                            <button
                              className="stmts-delete-btn"
                              onClick={() => handleDelete(stmt.id)}
                              title="Remove statement"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                <path d="M10 11v6M14 11v6" />
                                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                              </svg>
                            </button>
                          </div>
                        </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
