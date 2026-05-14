import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import ThemeToggle from "../context/ThemeToggle";
import "./Dashboard.css"; // Reuse dashboard styles

export default function Transactions() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  const CATEGORIES = [
    "Food & Dining", "Transportation", "Utilities", "Shopping", 
    "Entertainment", "Healthcare", "Financial & Obligations", 
    "Savings & Investments", "Housing", "Personal Care", 
    "Income", "Bank Charges", "Uncategorized"
  ];

  const fetchTransactions = async () => {
      try {
        const token = localStorage.getItem("pp_token");
        // Fetch a larger limit for the all transactions view
        const response = await axios.get("http://localhost:5000/api/transactions/?limit=1000", {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (response.data.success) {
          setTransactions(response.data.transactions);
        }
      } catch (error) {
        console.error("Error fetching transactions:", error);
      } finally {
        setLoading(false);
      }
    };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const handleCategoryChange = async (txnId, newCategory) => {
    try {
      const token = localStorage.getItem("pp_token");
      await axios.put(`http://localhost:5000/api/transactions/${txnId}/category`, 
        { category: newCategory },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      // Update local state without full refetch for better UX
      setTransactions(transactions.map(txn => 
        txn.id === txnId ? { ...txn, category: newCategory } : txn
      ));
    } catch (error) {
      console.error("Failed to update category:", error);
      alert("Failed to update category. Please try again.");
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const initials = user?.name
    ? user.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  return (
    <div className="dash-layout">
      <header className="dash-header">
        <div className="dash-header-left" onClick={() => navigate("/dashboard")} style={{ cursor: "pointer" }}>
          <div className="dash-logo-mark">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 17l10-5 10 5M2 12l10-5 10 5" />
            </svg>
          </div>
          <span className="dash-logo-text">PlainPocket</span>
        </div>
        
        <div className="dash-nav" style={{ flex: 1, marginLeft: "40px", display: "flex", gap: "20px" }}>
          <span onClick={() => navigate("/dashboard")} style={{ cursor: "pointer", color: "var(--color-text-secondary)", fontWeight: 500 }}>Dashboard</span>
          <span onClick={() => navigate("/statements")} style={{ cursor: "pointer", color: "var(--color-text-secondary)", fontWeight: 500 }}>Statements</span>
          <span style={{ cursor: "pointer", color: "var(--color-text)", fontWeight: 600 }}>Transactions</span>
        </div>

        <div className="dash-header-right">
          <ThemeToggle />
          <div className="dash-avatar" title={user?.name}>{initials}</div>
          <button onClick={handleLogout} className="dash-logout-btn">Sign out</button>
        </div>
      </header>

      <main className="dash-main">
        <div className="dash-welcome">
          <h1>All Transactions</h1>
          <p>Review and search through all your parsed bank transactions.</p>
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
            <h2>No transactions yet</h2>
            <p>Upload a statement to begin tracking.</p>
            <button className="dash-upload-btn" onClick={() => navigate("/upload")}>
              Upload statement
            </button>
          </div>
        ) : (
          <div className="dash-transactions">
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
      </main>
    </div>
  );
}
