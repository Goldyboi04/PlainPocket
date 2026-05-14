import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import "./Dashboard.css";

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

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
        <div className="dash-header-left">
          <div className="dash-logo-mark">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 17l10-5 10 5M2 12l10-5 10 5" />
            </svg>
          </div>
          <span className="dash-logo-text">PlainPocket</span>
        </div>
        <div className="dash-header-right">
          <div className="dash-avatar" title={user?.name}>{initials}</div>
          <button onClick={handleLogout} className="dash-logout-btn">Sign out</button>
        </div>
      </header>

      <main className="dash-main">
        <div className="dash-welcome">
          <h1>Good {getGreeting()}, {user?.name?.split(" ")[0] || "there"}</h1>
          <p>Here's what's happening with your finances.</p>
        </div>

        <div className="dash-grid">
          <div className="dash-card">
            <div className="dash-card-label">Total balance</div>
            <div className="dash-card-value">—</div>
            <div className="dash-card-note">Connect a bank to get started</div>
          </div>
          <div className="dash-card">
            <div className="dash-card-label">This month</div>
            <div className="dash-card-value">—</div>
            <div className="dash-card-note">No transactions yet</div>
          </div>
          <div className="dash-card">
            <div className="dash-card-label">Accounts</div>
            <div className="dash-card-value">0</div>
            <div className="dash-card-note">Upload a statement to begin</div>
          </div>
        </div>

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
          <p>Drop a PDF bank statement from HDFC or SBI and we'll parse it into a clean, categorized view of your spending.</p>
          <button className="dash-upload-btn" onClick={() => navigate("/upload")}>
            Upload statement
            <span className="dash-badge">New</span>
          </button>
        </div>
      </main>
    </div>
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}
