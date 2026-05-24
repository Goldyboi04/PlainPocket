import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from "recharts";
import "./Trends.css";

// ── Category emoji map ───────────────────────────────────────────────────────
const CAT_EMOJI = {
  "Food & Dining": "🍽️",
  "Transportation": "🚗",
  "Utilities": "💡",
  "Shopping": "🛍️",
  "Entertainment": "🎬",
  "Healthcare": "🏥",
  "Financial & Obligations": "💳",
  "Savings & Investments": "📈",
  "Housing": "🏠",
  "Personal Care": "💆",
  "Bank Charges": "🏦",
  "Uncategorized": "📦",
};

const fmt = (n) =>
  `₹${parseFloat(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

// ── Status helpers ────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  over_budget: { label: "Over Budget", color: "var(--color-danger)",   bg: "rgba(239,68,68,0.1)"    },
  warning:     { label: "Warning",     color: "var(--color-warning)",  bg: "rgba(245,158,11,0.1)"   },
  on_track:    { label: "On Track",    color: "var(--color-success)",  bg: "rgba(16,185,129,0.1)"   },
  no_budget:   { label: "No Budget",   color: "var(--color-text-muted)", bg: "rgba(100,116,139,0.08)" },
};

const TREND_ICON = {
  up:     { icon: "↑", color: "var(--color-danger)"  },
  down:   { icon: "↓", color: "var(--color-success)" },
  stable: { icon: "→", color: "var(--color-text-secondary)" },
};

const CONFIDENCE_COLORS = {
  high:   { label: "High confidence",   color: "#10b981" },
  medium: { label: "Medium confidence", color: "#f59e0b" },
  low:    { label: "Low confidence",    color: "#6366f1" },
};

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

  // Forecasts tab state
  const [predictions, setPredictions] = useState(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastError, setForecastError] = useState(null);
  
  const [activeTab, setActiveTab] = useState("line"); // "line" | "area" | "forecast"
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

  // Fetch predictions when Forecasts tab is activated
  const fetchPredictions = async () => {
    if (predictions) return; // already loaded
    setForecastLoading(true);
    setForecastError(null);
    try {
      const token = localStorage.getItem("pp_token");
      const res = await axios.get("http://localhost:5000/api/transactions/predictions", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        setPredictions(res.data);
      } else {
        setForecastError("Could not load predictions.");
      }
    } catch (err) {
      console.error("Forecast fetch error:", err);
      setForecastError("Failed to reach the prediction service.");
    } finally {
      setForecastLoading(false);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === "forecast") fetchPredictions();
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
                    onClick={() => handleTabChange("line")}
                  >
                    Category Comparison
                  </button>
                  <button
                    className={`tab-btn ${activeTab === "area" ? "active" : ""}`}
                    onClick={() => handleTabChange("area")}
                  >
                    Distribution (Area)
                  </button>
                  <button
                    className={`tab-btn forecast-tab-btn ${activeTab === "forecast" ? "active" : ""}`}
                    onClick={() => handleTabChange("forecast")}
                  >
                    ✦ Forecasts
                  </button>
                </div>
              </div>

              {focusCategory && (
                <div className="focused-alert-banner">
                  <span>Showing trends for <strong>{focusCategory}</strong>. Click any card on the right to switch or clear filters.</span>
                </div>
              )}

              {activeTab === "forecast" ? (
                <ForecastTabContent
                  loading={forecastLoading}
                  error={forecastError}
                  data={predictions}
                />
              ) : (
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
              )}
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

// ── Forecast Tab Component ────────────────────────────────────────────────────
function ForecastTabContent({ loading, error, data }) {
  if (loading) {
    return (
      <div className="forecast-state-box">
        <div className="forecast-spinner" />
        <span>Running ML predictions…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="forecast-state-box forecast-error">
        <span>⚠️ {error}</span>
      </div>
    );
  }

  if (!data || !data.categories || data.categories.length === 0) {
    return (
      <div className="forecast-state-box">
        <span>No transaction data available to generate forecasts.</span>
      </div>
    );
  }

  const { month_name, days_elapsed, days_in_month, categories, total } = data;
  const progressPct = Math.round((days_elapsed / days_in_month) * 100);
  const totalStatus = STATUS_CONFIG[total.budget_status] || STATUS_CONFIG.no_budget;

  return (
    <div className="forecast-content">

      {/* ── Hero Summary Card ── */}
      <div className="forecast-hero" style={{ borderColor: totalStatus.color }}>
        <div className="forecast-hero-left">
          <p className="forecast-hero-label">ML Predicted Spend — {month_name}</p>
          <div className="forecast-hero-amount">
            <span className="forecast-hero-spent">{fmt(total.spent_so_far)}</span>
            <span className="forecast-hero-sep">→</span>
            <span className="forecast-hero-predicted" style={{ color: totalStatus.color }}>
              {fmt(total.predicted_total)}
            </span>
          </div>
          {total.budget_limit > 0 && (
            <p className="forecast-hero-sub">
              Budget: {fmt(total.budget_limit)} &nbsp;·&nbsp;
              <span style={{ color: totalStatus.color }}>{totalStatus.label}</span>
            </p>
          )}
          {total.historical_avg > 0 && (
            <p className="forecast-hero-sub">
              Historical avg: {fmt(total.historical_avg)} / month
            </p>
          )}
        </div>

        <div className="forecast-hero-right">
          {/* Month progress arc */}
          <div className="forecast-month-ring">
            <svg viewBox="0 0 44 44" className="ring-svg">
              <circle cx="22" cy="22" r="18" fill="none" stroke="var(--color-border)" strokeWidth="4" />
              <circle
                cx="22" cy="22" r="18" fill="none"
                stroke="var(--color-primary)" strokeWidth="4"
                strokeDasharray={`${(progressPct / 100) * 113} 113`}
                strokeLinecap="round"
                transform="rotate(-90 22 22)"
              />
            </svg>
            <div className="ring-label">
              <span className="ring-pct">{progressPct}%</span>
              <span className="ring-sub">of month</span>
            </div>
          </div>
          <p className="forecast-days-text">
            Day {days_elapsed} of {days_in_month}
          </p>
        </div>

        {/* Dual progress bar: spent vs predicted vs budget */}
        <div className="forecast-hero-bar-row">
          {(() => {
            const max = total.budget_limit > 0
              ? Math.max(total.budget_limit, total.predicted_total)
              : total.predicted_total || 1;
            const spentPct  = Math.min((total.spent_so_far   / max) * 100, 100);
            const predPct   = Math.min((total.predicted_total / max) * 100, 100);
            const budgetPct = total.budget_limit > 0 ? Math.min((total.budget_limit / max) * 100, 100) : 0;
            return (
              <div className="forecast-bar-track hero-track">
                <div className="forecast-bar-predicted" style={{ width: `${predPct}%`, background: `${totalStatus.color}30` }} />
                <div className="forecast-bar-spent"     style={{ width: `${spentPct}%` }} />
                {total.budget_limit > 0 && (
                  <div className="forecast-bar-budget-marker" style={{ left: `${budgetPct}%` }}>
                    <div className="budget-marker-line" />
                    <span className="budget-marker-label">Budget</span>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>

      {/* ── Category Cards Grid ── */}
      <div className="forecast-grid">
        {categories.map((item) => {
          const status = STATUS_CONFIG[item.budget_status] || STATUS_CONFIG.no_budget;
          const trend  = TREND_ICON[item.trend]   || TREND_ICON.stable;
          const conf   = CONFIDENCE_COLORS[item.confidence] || CONFIDENCE_COLORS.low;
          const emoji  = CAT_EMOJI[item.category] || "💰";

          const max = item.budget_limit > 0
            ? Math.max(item.budget_limit, item.predicted_total, item.spent_so_far)
            : Math.max(item.predicted_total, item.spent_so_far) || 1;

          const spentPct   = Math.min((item.spent_so_far    / max) * 100, 100);
          const predPct    = Math.min((item.predicted_total / max) * 100, 100);
          const budgetPct  = item.budget_limit > 0 ? Math.min((item.budget_limit / max) * 100, 100) : 0;

          return (
            <div
              key={item.category}
              className="forecast-card"
              style={{ '--status-color': status.color, '--status-bg': status.bg }}
            >
              {/* Card header */}
              <div className="fc-header">
                <div className="fc-title-row">
                  <span className="fc-emoji">{emoji}</span>
                  <span className="fc-cat-name">{item.category}</span>
                </div>
                <div className="fc-badges">
                  <span className="confidence-pill" style={{ color: conf.color, borderColor: `${conf.color}40`, background: `${conf.color}12` }}>
                    {item.confidence === "high" ? "●●●" : item.confidence === "medium" ? "●●○" : "●○○"} {item.confidence}
                  </span>
                  <span
                    className="trend-arrow"
                    style={{ color: trend.color }}
                    title={`Spending trend: ${item.trend}`}
                  >
                    {trend.icon}
                  </span>
                </div>
              </div>

              {/* Amounts */}
              <div className="fc-amounts">
                <div className="fc-amount-col">
                  <span className="fc-amount-label">Spent so far</span>
                  <span className="fc-amount-value">{fmt(item.spent_so_far)}</span>
                </div>
                <div className="fc-amount-arrow">→</div>
                <div className="fc-amount-col">
                  <span className="fc-amount-label">ML Forecast</span>
                  <span className="fc-amount-value forecast-value" style={{ color: status.color }}>
                    {fmt(item.predicted_total)}
                  </span>
                </div>
                {item.budget_limit > 0 && (
                  <>
                    <div className="fc-amount-arrow">/</div>
                    <div className="fc-amount-col">
                      <span className="fc-amount-label">Budget</span>
                      <span className="fc-amount-value">{fmt(item.budget_limit)}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Dual bar */}
              <div className="forecast-bar-track">
                <div className="forecast-bar-predicted" style={{ width: `${predPct}%`, background: `${status.color}28` }} />
                <div className="forecast-bar-spent"     style={{ width: `${spentPct}%`, background: status.color }} />
                {item.budget_limit > 0 && (
                  <div className="forecast-bar-budget-marker" style={{ left: `${budgetPct}%` }}>
                    <div className="budget-marker-line" style={{ background: status.color }} />
                  </div>
                )}
              </div>
              <div className="fc-bar-labels">
                <span>₹0</span>
                {item.budget_limit > 0 && <span style={{ color: status.color }}>{fmt(item.budget_limit)}</span>}
              </div>

              {/* Status badge */}
              <div className="fc-footer">
                <span
                  className="budget-status-badge"
                  style={{ color: status.color, background: status.bg, borderColor: `${status.color}40` }}
                >
                  {item.budget_status === "over_budget" ? "🔴" :
                   item.budget_status === "warning"     ? "🟡" :
                   item.budget_status === "on_track"    ? "🟢" : "⚪"}
                  {" "}{status.label}
                </span>
                {item.historical_avg > 0 && (
                  <span className="fc-hist-avg">avg {fmt(item.historical_avg)}/mo</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── ML Info Footer ── */}
      <div className="forecast-ml-note">
        <svg viewBox="0 0 16 16" fill="currentColor" className="ml-icon">
          <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm.75 10.5h-1.5v-5h1.5v5zm0-6.5h-1.5V3.5h1.5V5z"/>
        </svg>
        Predictions use <strong>Linear Regression</strong> (scikit-learn) fitted on your monthly category history, blended with your current-month pace. Confidence rises as more days of the month pass and more historical months are available.
      </div>
    </div>
  );
}
