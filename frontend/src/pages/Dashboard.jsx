import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1.5rem" }}>
      <div style={{ fontSize: "3rem" }}>🎉</div>
      <h1 style={{ fontSize: "2rem", fontWeight: 700 }}>Welcome, {user?.name || "User"}!</h1>
      <p style={{ color: "var(--color-text-secondary)" }}>logged in successfully.</p>
      <button onClick={handleLogout} style={{ padding: "12px 32px", background: "var(--color-primary)", border: "none", borderRadius: "var(--radius-md)", color: "white", fontFamily: "var(--font-family)", fontSize: "1rem", fontWeight: 600, cursor: "pointer" }}>
        Sign Out
      </button>
    </div>
  );
}
