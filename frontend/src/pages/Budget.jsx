import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from "recharts";
import "./Budget.css";

const COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e",
  "#f59e0b", "#10b981", "#06b6d4", "#3b82f6",
  "#64748b", "#a855f7", "#ef4444", "#22c55e"
];

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function Budget() {
  const navigate = useNavigate();
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1); // 1-indexed
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [availableMonths, setAvailableMonths] = useState([]);

  const [budget, setBudget] = useState({
    limit: 0,
    spent: 0,
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    budget_inherited: false,
    categories: []
  });
  const [loading, setLoading] = useState(true);
  const [editingCategory, setEditingCategory] = useState(null);
  const [tempLimit, setTempLimit] = useState("");
  const [savingCategory, setSavingCategory] = useState(false);

  const isCurrentMonth = selectedMonth === now.getMonth() + 1 && selectedYear === now.getFullYear();

  const fetchAvailableMonths = useCallback(async () => {
    try {
      const token = localStorage.getItem("pp_token");
      const res = await axios.get("http://localhost:5000/api/transactions/months", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        setAvailableMonths(res.data.months);
      }
    } catch (err) {
      console.error("Failed to fetch available months:", err);
    }
  }, []);

  const fetchBudget = useCallback(async (month, year) => {
    setLoading(true);
    try {
      const token = localStorage.getItem("pp_token");
      const response = await axios.get(
        `http://localhost:5000/api/budget/?month=${month}&year=${year}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.success) {
        setBudget(response.data.budget);
      }
    } catch (error) {
      console.error("Failed to fetch budget:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAvailableMonths();
  }, [fetchAvailableMonths]);

  useEffect(() => {
    fetchBudget(selectedMonth, selectedYear);
  }, [selectedMonth, selectedYear, fetchBudget]);

  // Build sorted list of all months that have data + current month
  const navigableMonths = (() => {
    const set = new Set(availableMonths.map(m => `${m.year}-${m.month}`));
    // Always include current month
    set.add(`${now.getFullYear()}-${now.getMonth() + 1}`);
    return [...set]
      .map(s => {
        const [y, m] = s.split("-").map(Number);
        return { year: y, month: m };
      })
      .sort((a, b) => b.year - a.year || b.month - a.month);
  })();

  const currentIndex = navigableMonths.findIndex(
    m => m.month === selectedMonth && m.year === selectedYear
  );

  const canGoNext = currentIndex > 0;
  const canGoPrev = currentIndex < navigableMonths.length - 1;

  const goNext = () => {
    if (canGoNext) {
      const { month, year } = navigableMonths[currentIndex - 1];
      setSelectedMonth(month);
      setSelectedYear(year);
      setEditingCategory(null);
    }
  };

  const goPrev = () => {
    if (canGoPrev) {
      const { month, year } = navigableMonths[currentIndex + 1];
      setSelectedMonth(month);
      setSelectedYear(year);
      setEditingCategory(null);
    }
  };

  const handleUpdateCategoryBudget = async (category, limitValue) => {
    setSavingCategory(true);
    try {
      const token = localStorage.getItem("pp_token");
      await axios.post(
        "http://localhost:5000/api/budget/",
        {
          amount: limitValue === "" ? 0.0 : parseFloat(limitValue),
          category: category
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setEditingCategory(null);
      fetchBudget(selectedMonth, selectedYear);
    } catch (error) {
      console.error("Failed to update category budget:", error);
      alert("Failed to update category budget. Please try again.");
    } finally {
      setSavingCategory(false);
    }
  };

  const percentage = budget.limit > 0 ? Math.min((budget.spent / budget.limit) * 100, 100) : 0;
  const isOverBudget = budget.spent > budget.limit && budget.limit > 0;
  const remaining = Math.max(budget.limit - budget.spent, 0);

  const chartData = budget.categories.filter(c => c.spent > 0);

  return (
    <div className="budget-page">
      <div className="budget-header">
        <h1>Monthly Budget</h1>
        <p>Track and manage your spending limits month by month.</p>
      </div>

      {/* Month Navigator */}
      <div className="month-navigator">
        <button
          className="month-nav-btn"
          onClick={goPrev}
          disabled={!canGoPrev}
          title="Previous month"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        <div className="month-display">
          <span className="month-name">{MONTH_NAMES[selectedMonth - 1]} {selectedYear}</span>
          {isCurrentMonth && <span className="month-badge current">Current Month</span>}
          {!isCurrentMonth && <span className="month-badge past">Past Month</span>}
        </div>

        <button
          className="month-nav-btn"
          onClick={goNext}
          disabled={!canGoNext}
          title="Next month"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {!isCurrentMonth && (
        <div className="past-month-notice">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {budget.budget_inherited
            ? `Viewing past month — budget limits shown are inherited from another month's budget.`
            : `Viewing past month — budget limits are read-only. Switch to the current month to edit.`
          }
        </div>
      )}

      {loading ? (
        <div className="budget-loading">Loading budget data...</div>
      ) : (
        <div className="budget-layout">
          <div className="budget-main-card">
              <div className="budget-status">
                <div className="status-item">
                  <span className="status-label">Spent in {MONTH_NAMES[selectedMonth - 1]}</span>
                  <span className="status-value">₹{budget.spent.toLocaleString('en-IN')}</span>
                </div>
                <div className="status-item" style={{ textAlign: 'right' }}>
                  <span className="status-label">Monthly Limit</span>
                  <span className="status-value">
                    {budget.limit > 0 ? `₹${budget.limit.toLocaleString('en-IN')}` : "—"}
                  </span>
                </div>
              </div>

              {budget.limit > 0 ? (
                <div className="progress-container">
                  <div className="progress-bar-bg">
                    <div
                      className={`progress-bar-fill ${isOverBudget ? 'danger' : ''}`}
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                  <div className="progress-labels">
                    <span>{percentage.toFixed(1)}% used</span>
                    <span>{isOverBudget ? "⚠ Over Budget!" : `₹${remaining.toLocaleString('en-IN')} remaining`}</span>
                  </div>
                </div>
              ) : (
                <div className="no-limit-notice">
                  {isCurrentMonth
                    ? "No budget limit set. Add category limits on the right →"
                    : "No budget limit was set for this month."}
                </div>
              )}
            </div>

            <div className="budget-charts-section">
              <div className="chart-card">
                <h3>Spending by Category</h3>
                <div className="chart-wrapper">
                  {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart margin={{ top: 20, right: 10, bottom: 10, left: 10 }}>
                        <Pie
                          data={chartData}
                          cx="50%"
                          cy="45%"
                          innerRadius={40}
                          outerRadius={65}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value) => `₹${value.toLocaleString('en-IN')}`}
                          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        />
                        <Legend wrapperStyle={{ paddingTop: '5px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="empty-chart">No spending data for this month.</div>
                  )}
                </div>
              </div>

              <div className="chart-card">
                <h3>Category Comparison</h3>
                <div className="chart-wrapper">
                  {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 30 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="var(--color-border)" />
                        <XAxis type="number" hide />
                        <YAxis
                          dataKey="name"
                          type="category"
                          axisLine={false}
                          tickLine={false}
                          width={100}
                          tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }}
                        />
                        <Tooltip
                          formatter={(value) => `₹${value.toLocaleString('en-IN')}`}
                          cursor={{ fill: 'var(--color-bg-alt)' }}
                        />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                          {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="empty-chart">No spending data for this month.</div>
                  )}
                </div>
              </div>
            </div>

            <div className="category-list-card">
              <div className="category-list-header">
                <h3>Category Budgets</h3>
              </div>
              <p className="settings-note" style={{ textAlign: 'left', marginTop: '-10px', marginBottom: '20px', fontSize: 'var(--font-size-xs)' }}>
                {isCurrentMonth
                  ? "Set individual limits for your expense categories."
                  : "Budget limits for this past month (read-only)."}
              </p>
              <div className="category-budget-grid">
                {budget.categories.map((cat, i) => {
                  const isOver = cat.limit > 0 && cat.spent > cat.limit;
                  const pct = cat.limit > 0 ? Math.min((cat.spent / cat.limit) * 100, 100) : 0;
                  const isEditing = editingCategory === cat.name && isCurrentMonth;

                  return (
                    <div key={cat.name} className="category-budget-row">
                      <div className="category-budget-header">
                        <div 
                          className="category-item-info clickable" 
                          onClick={() => navigate(`/trends?category=${encodeURIComponent(cat.name)}`)}
                          title={`View ${cat.name} trends`}
                        >
                          <div className="category-color" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                          <span className="category-name">{cat.name}</span>
                        </div>

                        <div className="category-budget-actions">
                          {isCurrentMonth ? (
                            isEditing ? (
                              <div className="compact-edit-wrapper">
                                <span className="compact-currency">₹</span>
                                <input
                                  type="number"
                                  value={tempLimit}
                                  onChange={(e) => setTempLimit(e.target.value)}
                                  className="compact-input"
                                  placeholder="Limit"
                                  autoFocus
                                  min="0"
                                  step="500"
                                />
                                <button
                                  onClick={() => handleUpdateCategoryBudget(cat.name, tempLimit)}
                                  className="compact-btn save"
                                  disabled={savingCategory}
                                  title="Save Limit"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => setEditingCategory(null)}
                                  className="compact-btn cancel"
                                  title="Cancel"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                  </svg>
                                </button>
                              </div>
                            ) : (
                              <div className="compact-limit-display">
                                {cat.limit > 0 ? (
                                  <>
                                    <span className="category-limit-val">₹{cat.limit.toLocaleString('en-IN')}</span>
                                    <button
                                      onClick={() => { setEditingCategory(cat.name); setTempLimit(cat.limit); }}
                                      className="category-edit-btn"
                                      title="Edit Limit"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                        <path d="M18.375 2.625a2.122 2.122 0 1 1 3 3L12 15l-4 1 1-4Z" />
                                      </svg>
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    onClick={() => { setEditingCategory(cat.name); setTempLimit(""); }}
                                    className="category-set-btn"
                                  >
                                    + Limit
                                  </button>
                                )}
                              </div>
                            )
                          ) : (
                            /* Past month – read only */
                            <div className="compact-limit-display">
                              {cat.limit > 0 ? (
                                <span className="category-limit-val readonly">₹{cat.limit.toLocaleString('en-IN')}</span>
                              ) : (
                                <span className="category-limit-val readonly muted">—</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="category-spending-info">
                        <span className="category-spent-text">
                          ₹{cat.spent.toLocaleString('en-IN')} spent
                          {cat.limit > 0 ? ` of ₹${cat.limit.toLocaleString('en-IN')}` : ""}
                        </span>
                        {cat.limit > 0 && (
                          <span className={`category-pct-badge ${isOver ? 'danger' : ''}`}>
                            {pct.toFixed(0)}%
                          </span>
                        )}
                      </div>

                      {cat.limit > 0 && (
                        <div className="category-progress-bg">
                          <div
                            className={`category-progress-fill ${isOver ? 'danger' : ''}`}
                            style={{ width: `${pct}%` }}
                          ></div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
        </div>
      )}
    </div>
  );
}
