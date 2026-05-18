import { useState, useEffect } from "react";
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

export default function Budget() {
  const [budget, setBudget] = useState({ 
    limit: 0, 
    spent: 0, 
    month: 0, 
    year: 0,
    categories: [] 
  });
  const [loading, setLoading] = useState(true);
  const [editingCategory, setEditingCategory] = useState(null);
  const [tempLimit, setTempLimit] = useState("");
  const [savingCategory, setSavingCategory] = useState(false);

  const fetchBudget = async () => {
    try {
      const token = localStorage.getItem("pp_token");
      const response = await axios.get("http://localhost:5000/api/budget/", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setBudget(response.data.budget);
      }
    } catch (error) {
      console.error("Failed to fetch budget:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBudget();
  }, []);

  const handleUpdateCategoryBudget = async (category, limitValue) => {
    setSavingCategory(true);
    try {
      const token = localStorage.getItem("pp_token");
      await axios.post("http://localhost:5000/api/budget/", 
        { 
          amount: limitValue === "" ? 0.0 : parseFloat(limitValue), 
          category: category 
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setEditingCategory(null);
      fetchBudget();
    } catch (error) {
      console.error("Failed to update category budget:", error);
      alert("Failed to update category budget. Please try again.");
    } finally {
      setSavingCategory(false);
    }
  };

  if (loading) return <div className="budget-loading">Loading budget...</div>;

  const percentage = budget.limit > 0 ? Math.min((budget.spent / budget.limit) * 100, 100) : 0;
  const isOverBudget = budget.spent > budget.limit && budget.limit > 0;
  const remaining = Math.max(budget.limit - budget.spent, 0);

  const monthName = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(new Date());

  // Prepare data for charts
  const chartData = budget.categories.length > 0 ? budget.categories : [];
  
  return (
    <div className="budget-page">
      <div className="budget-header">
        <h1>Monthly Budget</h1>
        <p>Set and track your spending limit for {monthName} {budget.year}.</p>
      </div>

      <div className="budget-grid">
        <div className="budget-main-col">
          <div className="budget-main-card">
            <div className="budget-status">
              <div className="status-item">
                <span className="status-label">Spent so far</span>
                <span className="status-value">₹{budget.spent.toLocaleString('en-IN')}</span>
              </div>
              <div className="status-item">
                <span className="status-label">Monthly Limit</span>
                <span className="status-value">₹{budget.limit.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div className="progress-container">
              <div className="progress-bar-bg">
                <div 
                  className={`progress-bar-fill ${isOverBudget ? 'danger' : ''}`}
                  style={{ width: `${percentage}%` }}
                ></div>
              </div>
              <div className="progress-labels">
                <span>{percentage.toFixed(1)}% used</span>
                <span>{isOverBudget ? "Over Budget!" : `₹${remaining.toLocaleString('en-IN')} remaining`}</span>
              </div>
            </div>
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
                  <div className="empty-chart">No spending data yet.</div>
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
                  <div className="empty-chart">No spending data yet.</div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="budget-side-col">
          <div className="category-list-card">
            <div className="category-list-header">
              <h3>Category Budgets</h3>
            </div>
            <p className="settings-note" style={{ textAlign: 'left', marginTop: '-10px', marginBottom: '20px', fontSize: 'var(--font-size-xs)' }}>
              Set individual limits for your expense categories (excluding Income).
            </p>
            <div className="category-budget-list">
              {chartData.map((cat, i) => {
                const isOver = cat.limit > 0 && cat.spent > cat.limit;
                const pct = cat.limit > 0 ? Math.min((cat.spent / cat.limit) * 100, 100) : 0;
                const isEditing = editingCategory === cat.name;

                return (
                  <div key={cat.name} className="category-budget-row">
                    <div className="category-budget-header">
                      <div className="category-item-info">
                        <div className="category-color" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                        <span className="category-name">{cat.name}</span>
                      </div>
                      
                      <div className="category-budget-actions">
                        {isEditing ? (
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
                            >
                              ✓
                            </button>
                            <button 
                              onClick={() => setEditingCategory(null)}
                              className="compact-btn cancel"
                            >
                              ✗
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
                                  ✏️
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
      </div>
    </div>
  );
}

