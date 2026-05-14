import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "./Dashboard.css";

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState({ total_transactions: 0, current_balance: 0, total_spent: 0 });
  const [budget, setBudget] = useState({ limit: 0, spent: 0 });
  const [loading, setLoading] = useState(true);

  const CATEGORIES = [
    "Food & Dining", "Transportation", "Utilities", "Shopping",
    "Entertainment", "Healthcare", "Financial & Obligations",
    "Savings & Investments", "Housing", "Personal Care",
    "Income", "Bank Charges", "Uncategorized"
  ];

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem("pp_token");
        const headers = { Authorization: `Bearer ${token}` };

        // Fetch summary
        const summaryRes = await axios.get("http://localhost:5000/api/transactions/summary", { headers });
        if (summaryRes.data.success) {
          setSummary(summaryRes.data.summary);
        }

        // Fetch budget
        const budgetRes = await axios.get("http://localhost:5000/api/budget/", { headers });
        if (budgetRes.data.success) {
          setBudget(budgetRes.data.budget);
        }

        // Fetch recent transactions (limit to 5)
        const txnsRes = await axios.get("http://localhost:5000/api/transactions/?limit=5", { headers });
        if (txnsRes.data.success) {
          setTransactions(txnsRes.data.transactions);
        }
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleCategoryChange = async (txnId, newCategory) => {
    try {
      const token = localStorage.getItem("pp_token");
      await axios.put(`http://localhost:5000/api/transactions/${txnId}/category`,
        { category: newCategory },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      // Update local state without full refetch
      setTransactions(transactions.map(txn =>
        txn.id === txnId ? { ...txn, category: newCategory } : txn
      ));
    } catch (error) {
      console.error("Failed to update category:", error);
      alert("Failed to update category. Please try again.");
    }
  };

  const budgetPercentage = budget.limit > 0 ? Math.min((budget.spent / budget.limit) * 100, 100) : 0;

  return (
    <div className="dash-content-wrapper">
      <div className="dash-welcome">
        <h1>Good {getGreeting()}, {user?.name?.split(" ")[0] || "there"}</h1>
        <p>Here's what's happening with your finances today.</p>
      </div>

      <div className="dash-grid">
        <div className="dash-card">
          <div className="dash-card-label">Total balance</div>
          <div className="dash-card-value">₹{summary.current_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          <div className="dash-card-note">{summary.total_transactions > 0 ? 'Current available balance' : 'Connect a bank to get started'}</div>
        </div>
        <div className="dash-card">
          <div className="dash-card-label">Remaining Amount</div>
          <div className="dash-card-value">₹{Math.max(budget.limit - budget.spent, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          <div className="dash-card-note">Of your ₹{budget.limit.toLocaleString('en-IN')} monthly limit</div>
        </div>
        <div className="dash-card budget-summary-card" onClick={() => navigate("/budget")} style={{ cursor: "pointer" }}>
          <div className="dash-card-label">Budget Progress</div>
          <div className="dash-card-value">₹{budget.spent.toLocaleString('en-IN')} / ₹{budget.limit.toLocaleString('en-IN')}</div>
          <div className="dash-progress-container">
            <div className="dash-progress-bg">
              <div
                className={`dash-progress-fill ${budget.spent > budget.limit ? 'danger' : ''}`}
                style={{ width: `${budgetPercentage}%` }}
              ></div>
            </div>
            <span className="dash-progress-text">{budgetPercentage.toFixed(0)}% used</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="dash-empty-state">
          <p>Loading transactions...</p>
        </div>
      ) : transactions.length === 0 ? (
        <div className="dash-empty-state">
          <div className="dash-empty-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="18" x2="12" y2="12" />
              <line x1="9" y1="15" x2="15" y2="15" />
            </svg>
          </div>
          <h2>Upload your first statement</h2>
          <p>Drop a CSV bank statement and we'll parse it into a clean, categorized view of your spending.</p>
          <button className="dash-upload-btn" onClick={() => navigate("/upload")}>
            Upload statement
            <span className="dash-badge">New</span>
          </button>
        </div>
      ) : (
        <div className="dash-transactions">
          <div className="dash-transactions-header">
            <h2>Recent Transactions</h2>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                className="dash-upload-btn"
                style={{ background: 'transparent', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}
                onClick={() => navigate("/all-transactions")}
              >
                View All
              </button>
              <button className="dash-upload-btn" onClick={() => navigate("/upload")}>
                Upload More
              </button>
            </div>
          </div>
          <div className="table-container">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Merchant / Description</th>
                  <th>Category</th>
                  <th className="align-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map(txn => (
                  <tr key={txn.id}>
                    <td>{new Date(txn.txn_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    <td className="merchant-cell">{txn.description}</td>
                    <td>
                      <select
                        className="category-badge"
                        value={txn.category || "Uncategorized"}
                        onChange={(e) => handleCategoryChange(txn.id, e.target.value)}
                        style={{ cursor: 'pointer', border: '1px solid var(--color-border)', outline: 'none' }}
                      >
                        {!CATEGORIES.includes(txn.category) && txn.category && (
                          <option value={txn.category}>{txn.category}</option>
                        )}
                        {CATEGORIES.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </td>
                    <td className={`align-right amount-${txn.txn_type}`}>
                      {txn.txn_type === 'debit' ? '-' : '+'}₹{parseFloat(txn.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

