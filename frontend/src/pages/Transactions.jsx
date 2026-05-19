import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "./Transactions.css";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [collapsedMonths, setCollapsedMonths] = useState({});
  const [selectedMonthKey, setSelectedMonthKey] = useState("all");
  const navigate = useNavigate();

  const CATEGORIES = [
    "Food & Dining", "Transportation", "Utilities", "Shopping", 
    "Entertainment", "Healthcare", "Financial & Obligations", 
    "Savings & Investments", "Housing", "Personal Care", 
    "Income", "Bank Charges", "Uncategorized"
  ];

  const fetchTransactions = async () => {
    try {
      const token = localStorage.getItem("pp_token");
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
      const response = await axios.put(`http://localhost:5000/api/transactions/${txnId}/category`, 
        { category: newCategory },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const description = response.data.description;
      // Update local state for all matching transactions
      setTransactions(transactions.map(txn => 
        txn.description === description ? { ...txn, category: newCategory } : txn
      ));
    } catch (error) {
      console.error("Failed to update category:", error);
      alert("Failed to update category. Please try again.");
    }
  };

  const toggleMonth = (key) => {
    setCollapsedMonths(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Group transactions by month
  const groupedTransactions = transactions.reduce((groups, txn) => {
    const date = new Date(txn.txn_date);
    const year = date.getFullYear();
    const month = date.getMonth(); // 0-indexed
    const key = `${year}-${month + 1}`;
    
    if (!groups[key]) {
      groups[key] = {
        key,
        year,
        month: month + 1,
        title: `${MONTH_NAMES[month]} ${year}`,
        txns: [],
        totalDebit: 0,
        totalCredit: 0
      };
    }
    
    groups[key].txns.push(txn);
    const amount = parseFloat(txn.amount);
    if (txn.txn_type === "debit") {
      groups[key].totalDebit += amount;
    } else {
      groups[key].totalCredit += amount;
    }
    
    return groups;
  }, {});

  const sortedKeys = Object.keys(groupedTransactions).sort((a, b) => {
    const [yearA, monthA] = a.split('-').map(Number);
    const [yearB, monthB] = b.split('-').map(Number);
    return yearB - yearA || monthB - monthA;
  });

  const displayedKeys = selectedMonthKey === "all" 
    ? sortedKeys 
    : sortedKeys.filter(key => key === selectedMonthKey);

  return (
    <div className="txns-page">
      <div className="txns-header">
        <div>
          <h1>All Transactions</h1>
          <p>Review and search through your transactions grouped month-wise.</p>
        </div>
        <div className="txns-actions-container">
          <div className="txns-filter-container">
            <select 
              id="month-select" 
              value={selectedMonthKey} 
              onChange={(e) => setSelectedMonthKey(e.target.value)}
              className="txns-month-dropdown"
            >
              <option value="all">All Months</option>
              {sortedKeys.map(key => (
                <option key={key} value={key}>{groupedTransactions[key].title}</option>
              ))}
            </select>
          </div>
          <button className="txns-upload-btn" onClick={() => navigate("/upload")}>
            Upload statement
          </button>
        </div>
      </div>

      {loading ? (
        <div className="txns-loading">
          <div className="txns-spinner"></div>
          <span>Loading transactions...</span>
        </div>
      ) : transactions.length === 0 ? (
        <div className="txns-empty">
          <div className="txns-empty-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="18" x2="12" y2="12" />
              <line x1="9" y1="15" x2="15" y2="15" />
            </svg>
          </div>
          <h2>No transactions yet</h2>
          <p>Upload a statement to begin tracking.</p>
          <button className="txns-upload-btn" onClick={() => navigate("/upload")}>
            Upload statement
          </button>
        </div>
      ) : (
        <div className="txns-list">
          {displayedKeys.map(key => {
            const group = groupedTransactions[key];
            const isCollapsed = collapsedMonths[key];
            
            return (
              <div key={key} className="txns-month-group">
                <button 
                  className="txns-month-header"
                  onClick={() => toggleMonth(key)}
                  aria-expanded={!isCollapsed}
                >
                  <div className="txns-month-title">
                    <span className="txns-month-name">{group.title}</span>
                    <span className="txns-month-count">{group.txns.length} txns</span>
                  </div>
                  
                  <div className="txns-month-stats">
                    <span className="txns-stat debit">
                      Spent: ₹{group.totalDebit.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </span>
                    <span className="txns-stat credit">
                      Income: ₹{group.totalCredit.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </span>
                    <svg 
                      className={`txns-chevron ${isCollapsed ? '' : 'open'}`}
                      xmlns="http://www.w3.org/2000/svg" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2.5" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                </button>

                {!isCollapsed && (
                  <div className="txns-month-body">
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
                          {group.txns.map(txn => (
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
          })}
        </div>
      )}
    </div>
  );
}
