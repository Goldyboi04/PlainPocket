import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from "recharts";
import "./Trends.css";

const COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e",
  "#f59e0b", "#10b981", "#06b6d4", "#3b82f6",
  "#64748b", "#a855f7", "#ef4444", "#22c55e"
];

export default function Trends() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [trends, setTrends] = useState([]);
  const [categories, setCategories] = useState([]);
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState("line"); // "area" or "line"
  const [hiddenCategories, setHiddenCategories] = useState({});
  const [focusCategory, setFocusCategory] = useState(null);

  const fetchTrends = async () => {
    try {
      const token = localStorage.getItem("pp_token");
      const response = await axios.get("http://localhost:5000/api/transactions/trends", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setTrends(response.data.trends);
        setCategories(response.data.categories);
        setInsights(response.data.insights);
        
        // Handle initial category from query parameters
        const urlCat = searchParams.get("category");
        if (urlCat && response.data.categories.includes(urlCat)) {
          applyCategoryFocus(urlCat, response.data.categories);
        }
      }
    } catch (error) {
      console.error("Error fetching trends data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrends();
  }, [searchParams]);

  const applyCategoryFocus = (targetCat, allCats) => {
    setFocusCategory(targetCat);
    setActiveTab("line");
    // Hide all other categories
    const hidden = {};
    allCats.forEach(cat => {
      if (cat !== targetCat) {
        hidden[cat] = true;
      }
    });
    setHiddenCategories(hidden);
  };

  const handleLegendClick = (e) => {
    const { dataKey } = e;
    toggleCategoryVisibility(dataKey);
  };

  const toggleCategoryVisibility = (catName) => {
    setHiddenCategories(prev => ({
      ...prev,
      [catName]: !prev[catName]
    }));
    
    // Clear singular focus if we toggle other items
    setFocusCategory(null);
  };

  const resetFilters = () => {
    setHiddenCategories({});
    setFocusCategory(null);
    setSearchParams({});
  };

  const handleCategorySelect = (catName) => {
    if (focusCategory === catName) {
      resetFilters();
    } else {
      applyCategoryFocus(catName, categories);
      setSearchParams({ category: catName });
    }
  };

  return (
    <div className="trends-page">
      <div className="trends-header">
        <div>
          <h1>Spending Trends</h1>
          <p>Analyze category-wise monthly variations and spending velocities.</p>
        </div>
        {focusCategory && (
          <button className="reset-filter-btn" onClick={resetFilters}>
            Clear Filter ({focusCategory})
          </button>
        )}
      </div>

      {loading ? (
        <div className="trends-loading">
          <div className="trends-spinner"></div>
          <span>Computing trends and analysis...</span>
        </div>
      ) : trends.length === 0 ? (
        <div className="trends-empty">
          <h2>No trend data available</h2>
          <p>Please upload statements containing debit transactions across multiple months to generate historical insights.</p>
          <button className="upload-btn" onClick={() => navigate("/upload")}>
            Upload Statement
          </button>
        </div>
      ) : (
        <div className="trends-grid">
          {/* Main Chart Column */}
          <div className="trends-main-col">
            <div className="chart-card trends-chart-card">
              <div className="chart-header">
                <div className="tabs">
                  <button 
                    className={`tab-btn ${activeTab === "line" ? "active" : ""}`}
                    onClick={() => setActiveTab("line")}
                  >
                    Category Comparison (Lines)
                  </button>
                  <button 
                    className={`tab-btn ${activeTab === "area" ? "active" : ""}`}
                    onClick={() => setActiveTab("area")}
                  >
                    Spending Distribution (Area)
                  </button>
                </div>
              </div>

              {focusCategory && (
                <div className="focused-alert-banner">
                  <span>Showing trends for <strong>{focusCategory}</strong>. Click any card on the right to switch or clear filters.</span>
                </div>
              )}

              <div className="chart-wrapper">
                <ResponsiveContainer width="100%" height="100%">
                  {activeTab === "area" ? (
                    <AreaChart data={trends} margin={{ top: 20, right: 30, left: 10, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                      <XAxis dataKey="month" tick={{ fill: "var(--color-text-secondary)", fontSize: 12 }} />
                      <YAxis tickFormatter={(v) => `₹${v}`} tick={{ fill: "var(--color-text-secondary)", fontSize: 12 }} />
                      <Tooltip 
                        formatter={(val) => `₹${parseFloat(val).toLocaleString('en-IN')}`}
                        contentStyle={{ borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-card)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      />
                      <Legend onClick={handleLegendClick} wrapperStyle={{ paddingTop: 10, cursor: 'pointer' }} />
                      {categories.map((cat, i) => (
                        <Area
                          key={cat}
                          type="monotone"
                          dataKey={cat}
                          stackId="1"
                          stroke={COLORS[i % COLORS.length]}
                          fill={COLORS[i % COLORS.length]}
                          fillOpacity={hiddenCategories[cat] ? 0.0 : 0.6}
                          strokeOpacity={hiddenCategories[cat] ? 0.05 : 1}
                        />
                      ))}
                    </AreaChart>
                  ) : (
                    <LineChart data={trends} margin={{ top: 20, right: 30, left: 10, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                      <XAxis dataKey="month" tick={{ fill: "var(--color-text-secondary)", fontSize: 12 }} />
                      <YAxis tickFormatter={(v) => `₹${v}`} tick={{ fill: "var(--color-text-secondary)", fontSize: 12 }} />
                      <Tooltip 
                        formatter={(val) => `₹${parseFloat(val).toLocaleString('en-IN')}`}
                        contentStyle={{ borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-card)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      />
                      <Legend onClick={handleLegendClick} wrapperStyle={{ paddingTop: 10, cursor: 'pointer' }} />
                      {categories.map((cat, i) => (
                        <Line
                          key={cat}
                          type="monotone"
                          dataKey={cat}
                          stroke={COLORS[i % COLORS.length]}
                          strokeWidth={focusCategory === cat ? 3.5 : 2}
                          dot={focusCategory === cat ? { r: 6 } : { r: 4 }}
                          activeDot={{ r: 8 }}
                          hide={hiddenCategories[cat]}
                        />
                      ))}
                    </LineChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Sidebar Insights & Filter Column */}
          <div className="trends-side-col">
            {/* Category Select Toggles */}
            <div className="side-card">
              <h3>Active Categories</h3>
              <p className="side-card-subtitle">Click to toggle trend lines</p>
              <div className="categories-badge-list">
                {categories.map((cat, i) => {
                  const isHidden = hiddenCategories[cat];
                  const isFocused = focusCategory === cat;
                  
                  return (
                    <button
                      key={cat}
                      className={`cat-badge-btn ${isHidden ? "hidden" : ""} ${isFocused ? "focused" : ""}`}
                      onClick={() => handleCategorySelect(cat)}
                      style={{ 
                        '--badge-color': COLORS[i % COLORS.length],
                        '--badge-bg-color': `${COLORS[i % COLORS.length]}15` 
                      }}
                    >
                      <span className="dot" style={{ backgroundColor: COLORS[i % COLORS.length] }}></span>
                      <span className="label">{cat}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Smart Spending Insights */}
            <div className="side-card">
              <h3>Smart MoM Insights</h3>
              <div className="insights-list">
                {insights.length === 0 ? (
                  <p className="empty-insights">No significant month-over-month shifts detected yet (&gt; 10% change).</p>
                ) : (
                  insights.map((insight, idx) => (
                    <div key={idx} className={`insight-item ${insight.direction}`}>
                      <div className="insight-icon">
                        {insight.direction === "up" ? (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                            <polyline points="17 6 23 6 23 12" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
                            <polyline points="17 18 23 18 23 12" />
                          </svg>
                        )}
                      </div>
                      <div className="insight-details">
                        <span className="insight-tag">
                          {insight.category} ({insight.direction === "up" ? "+" : "-"}{insight.percentage.toFixed(0)}%)
                        </span>
                        <p className="insight-text">{insight.text}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
