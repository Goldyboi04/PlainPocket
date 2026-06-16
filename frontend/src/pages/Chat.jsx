import { useState, useEffect, useRef } from "react";
import axios from "axios";
import "./Chat.css";

// ── Suggestion group icons ───────────────────────────────────────────────────
const GROUP_ICONS = {
  "Spending Overview": "💰",
  "Category Analysis": "📊",
  "Merchants & Transactions": "🏪",
  "Trends & Comparison": "📈",
  "Banking & Income": "🏦",
  "Budget": "🎯",
};

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Fetch suggestions on mount
  useEffect(() => {
    const fetchSuggestions = async () => {
      try {
        const token = localStorage.getItem("pp_token");
        const res = await axios.get("http://localhost:5000/api/chat/suggestions", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.data.success) {
          setSuggestions(res.data.suggestions);
        }
      } catch (err) {
        console.error("Failed to load suggestions:", err);
      }
    };
    fetchSuggestions();
  }, []);

  const sendMessage = async (questionText) => {
    const question = (questionText || input).trim();
    if (!question || loading) return;

    // Add user message
    const userMsg = { role: "user", content: question };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setShowSuggestions(false);
    setLoading(true);

    try {
      const token = localStorage.getItem("pp_token");
      const res = await axios.post(
        "http://localhost:5000/api/chat/",
        { question },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data.success) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: res.data.explanation,
            sql: res.data.sql,
            results: res.data.results,
            columns: res.data.columns,
            row_count: res.data.row_count,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: res.data.message || "Something went wrong.",
            sql: res.data.sql || null,
            isError: true,
          },
        ]);
      }
    } catch (err) {
      const data = err.response?.data || {};
      const errorMsg = data.message || "Failed to reach the server. Please try again.";
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: errorMsg,
          sql: data.sql || null,
          isError: true
        },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleSuggestionClick = (query) => {
    setInput(query);
    sendMessage(query);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="chat-page">
      {/* ── Header ── */}
      <div className="chat-header">
        <div className="chat-header-left">
          <div className="chat-header-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <div>
            <h1>Chat with Statement</h1>
            <p>Ask questions about your finances in plain English. Powered by AI.</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            className="chat-new-btn"
            onClick={() => { setMessages([]); setShowSuggestions(true); }}
          >
            + New Chat
          </button>
        )}
      </div>

      {/* ── Chat area ── */}
      <div className="chat-body">
        {/* ── Suggestions (shown when no messages) ── */}
        {showSuggestions && messages.length === 0 && (
          <div className="suggestions-area">
            <div className="suggestions-intro">
              <div className="suggestions-icon-big">✨</div>
              <h2>What would you like to know?</h2>
              <p>Ask any question about your transactions, spending, or budgets. Here are some ideas:</p>
            </div>
            <div className="suggestions-grid">
              {suggestions.map((group) => (
                <div key={group.group} className="suggestion-group">
                  <h3>
                    <span className="sg-icon">{GROUP_ICONS[group.group] || "💡"}</span>
                    {group.group}
                  </h3>
                  <div className="suggestion-chips">
                    {group.queries.map((q) => (
                      <button
                        key={q}
                        className="suggestion-chip"
                        onClick={() => handleSuggestionClick(q)}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Messages ── */}
        <div className="messages-list">
          {messages.map((msg, idx) => (
            <div key={idx} className={`message-row ${msg.role}`}>
              {msg.role === "assistant" && (
                <div className="message-avatar ai-avatar">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                    <path d="M2 17l10 5 10-5"/>
                    <path d="M2 12l10 5 10-5"/>
                  </svg>
                </div>
              )}
              <div className={`message-bubble ${msg.role} ${msg.isError ? "error" : ""}`}>
                {/* Text content */}
                <p className="message-text">{msg.content}</p>

                {/* Collapsible Technical Details (assistant only) */}
                {msg.sql && (
                  <QueryInspector
                    sql={msg.sql}
                    columns={msg.columns}
                    results={msg.results}
                    rowCount={msg.row_count}
                    isError={msg.isError}
                    onCopy={copyToClipboard}
                  />
                )}
              </div>
              {msg.role === "user" && (
                <div className="message-avatar user-avatar">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                </div>
              )}
            </div>
          ))}

          {/* Typing indicator */}
          {loading && (
            <div className="message-row assistant">
              <div className="message-avatar ai-avatar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                  <path d="M2 17l10 5 10-5"/>
                  <path d="M2 12l10 5 10-5"/>
                </svg>
              </div>
              <div className="message-bubble assistant typing-bubble">
                <div className="typing-indicator">
                  <span></span><span></span><span></span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ── Input area ── */}
      <div className="chat-input-area">
        <div className="chat-input-wrapper">
          <textarea
            ref={inputRef}
            className="chat-input"
            placeholder="Ask about your finances..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={loading}
          />
          <button
            className={`chat-send-btn ${input.trim() && !loading ? "active" : ""}`}
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
        <p className="chat-disclaimer">
          AI-generated SQL may not always be perfect. Always verify results.
        </p>
      </div>
    </div>
  );
}


// ── Query Inspector Component ─────────────────────────────────────────────────
function QueryInspector({ sql, columns, results, rowCount, isError, onCopy }) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = (e) => {
    e.stopPropagation();
    onCopy(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="query-inspector">
      <div className="inspector-header" onClick={() => setIsOpen(!isOpen)}>
        <div className="inspector-title">
          <svg className="inspector-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="16 18 22 12 16 6"/>
            <polyline points="8 6 2 12 8 18"/>
          </svg>
          <span>{isOpen ? "Hide Technical Details" : "View Technical Details"}</span>
        </div>
        <svg
          className={`inspector-chevron ${isOpen ? "open" : ""}`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        >
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </div>

      {isOpen && (
        <div className="inspector-body">
          <div className="inspector-sql-section">
            <div className="inspector-sql-header">
              <span className="inspector-sql-label">Generated SQL</span>
              <button className="inspector-copy-btn" onClick={handleCopy}>
                {copied ? "✓ Copied" : "Copy Query"}
              </button>
            </div>
            <div className="inspector-code-wrapper">
              <pre className="inspector-code">{sql}</pre>
            </div>
          </div>

          <div className="inspector-data-section">
            {results && results.length > 0 ? (
              <ResultsTable
                columns={columns}
                results={results}
                rowCount={rowCount}
              />
            ) : (
              results && results.length === 0 && !isError && (
                <div className="empty-results">
                  <span>No matching records found.</span>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}


// ── SQL Code Block Component ─────────────────────────────────────────────────
function SQLBlock({ sql, onCopy }) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    onCopy(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="sql-block">
      <div className="sql-block-header" onClick={() => setIsOpen(!isOpen)}>
        <div className="sql-toggle">
          <svg
            className={`sql-chevron ${isOpen ? "open" : ""}`}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          >
            <polyline points="9 18 15 12 9 6"/>
          </svg>
          <span className="sql-label">Generated SQL</span>
        </div>
        <button
          className="sql-copy-btn"
          onClick={(e) => { e.stopPropagation(); handleCopy(); }}
        >
          {copied ? "✓ Copied" : "Copy"}
        </button>
      </div>
      {isOpen && (
        <div className="sql-code-wrapper">
          <pre className="sql-code">{sql}</pre>
        </div>
      )}
    </div>
  );
}


// ── Results Table Component ──────────────────────────────────────────────────
function ResultsTable({ columns, results, rowCount }) {
  // Format values for display
  const formatValue = (val, col) => {
    if (val === null || val === undefined) return "—";
    // Detect amount-like columns and format as currency
    const amountCols = ["amount", "total", "total_spent", "total_income", "total_amount",
      "avg_amount", "avg_daily", "spent", "balance", "sum_amount", "max_amount",
      "min_amount", "budget_limit", "avg_spending", "daily_avg"];
    const colLower = col.toLowerCase();
    if (amountCols.some(a => colLower.includes(a)) || colLower.includes("spend") || colLower.includes("earning")) {
      const num = parseFloat(val);
      if (!isNaN(num)) {
        return `₹${num.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
      }
    }
    return String(val);
  };

  return (
    <div className="results-container">
      <div className="results-header-row">
        <span className="results-label">
          📋 {rowCount} result{rowCount !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="results-table-wrap">
        <table className="results-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col}>{col.replace(/_/g, " ")}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {results.map((row, i) => (
              <tr key={i}>
                {columns.map((col) => (
                  <td key={col}>{formatValue(row[col], col)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
