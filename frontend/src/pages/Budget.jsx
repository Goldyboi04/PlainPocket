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
  const [newLimit, setNewLimit] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchBudget = async () => {
    try {
      const token = localStorage.getItem("pp_token");
      const response = await axios.get("http://localhost:5000/api/budget/", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setBudget(response.data.budget);
        setNewLimit(response.data.budget.limit || "");
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

  const handleUpdateBudget = async (e) => {
    e.preventDefault();
    if (!newLimit || isNaN(newLimit)) return;

    setSaving(true);
    try {
      const token = localStorage.getItem("pp_token");
      await axios.post("http://localhost:5000/api/budget/", 
        { amount: parseFloat(newLimit) },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchBudget();
    } catch (error) {
      console.error("Failed to update budget:", error);
      alert("Failed to update budget. Please try again.");
    } finally {
      setSaving(false);
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
                  <ResponsiveContainer width="100%" height={350}>
                    <PieChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="45%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={5}
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
                      <Legend wrapperStyle={{ paddingTop: '20px' }} />
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
                  <ResponsiveContainer width="100%" height={350}>
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
          <div className="budget-settings-card">
            <h3>Set Monthly Limit</h3>
            <form onSubmit={handleUpdateBudget}>
              <div className="input-group">
                <span className="currency-prefix">₹</span>
                <input 
                  type="number" 
                  placeholder="Enter amount"
                  value={newLimit}
                  onChange={(e) => setNewLimit(e.target.value)}
                  min="0"
                  step="500"
                />
              </div>
              <button type="submit" disabled={saving} className="update-btn">
                {saving ? "Saving..." : "Update Budget"}
              </button>
            </form>
            <p className="settings-note">Your budget resets on the 1st of every month.</p>
          </div>

          <div className="category-list-card">
            <h3>Top Expenses</h3>
            <div className="category-list">
              {chartData.map((cat, i) => (
                <div key={cat.name} className="category-item">
                  <div className="category-item-info">
                    <div className="category-color" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                    <span className="category-name">{cat.name}</span>
                  </div>
                  <span className="category-value">₹{cat.value.toLocaleString('en-IN')}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

