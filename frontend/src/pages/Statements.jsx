import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "./Dashboard.css"; // Reuse dashboard styles for layout consistency

export default function Statements() {
  const [statements, setStatements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const navigate = useNavigate();

  const fetchStatements = async () => {
    try {
      const token = localStorage.getItem("pp_token");
      const response = await axios.get("http://localhost:5000/api/statements/", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setStatements(response.data.statements);
      }
    } catch (error) {
      console.error("Error fetching statements:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatements();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this statement? All associated transactions will be removed.")) return;
    
    try {
      const token = localStorage.getItem("pp_token");
      const response = await axios.delete(`http://localhost:5000/api/statements/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setMessage({ type: "success", text: response.data.message });
        fetchStatements(); // Refresh the list
      }
    } catch (error) {
      setMessage({ type: "error", text: error.response?.data?.message || "Failed to delete statement" });
    }
    
    // Clear message after 3 seconds
    setTimeout(() => setMessage(null), 3000);
  };

  return (
    <div className="dash-content-wrapper">
      <div className="dash-welcome">
        <h1>Manage Statements</h1>
        <p>View and remove your uploaded bank statements.</p>
      </div>

      {message && (
        <div className={`upload-message ${message.type}`} style={{ marginBottom: "20px", padding: "12px", borderRadius: "8px", backgroundColor: message.type === 'success' ? '#e0ffe0' : '#ffe0e0', color: message.type === 'success' ? '#006600' : '#cc0000' }}>
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="dash-empty-state">
          <p>Loading statements...</p>
        </div>
      ) : statements.length === 0 ? (
        <div className="dash-empty-state">
          <div className="dash-empty-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
              <polyline points="13 2 13 9 20 9"></polyline>
            </svg>
          </div>
          <h2>No statements uploaded yet</h2>
          <p>Upload a statement to start tracking your finances.</p>
          <button className="dash-upload-btn" onClick={() => navigate("/upload")}>
            Upload new statement
          </button>
        </div>
      ) : (
        <div className="dash-transactions">
          <div className="dash-transactions-header">
            <h2>Your Statements</h2>
            <button className="dash-upload-btn" onClick={() => navigate("/upload")}>
              Upload New
            </button>
          </div>
          <div className="table-container">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Upload Date</th>
                  <th>Bank Name</th>
                  <th>File Name</th>
                  <th className="align-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {statements.map(stmt => (
                  <tr key={stmt.id}>
                    <td>{new Date(stmt.upload_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    <td><span className="category-badge">{stmt.bank_name}</span></td>
                    <td className="merchant-cell">{stmt.file_name}</td>
                    <td className="align-right">
                      <button 
                        onClick={() => handleDelete(stmt.id)}
                        style={{
                          background: "transparent",
                          border: "1px solid var(--color-border)",
                          color: "var(--color-text-secondary)",
                          padding: "6px 12px",
                          borderRadius: "6px",
                          cursor: "pointer",
                          fontSize: "0.8rem",
                          transition: "all 0.2s"
                        }}
                        onMouseOver={(e) => { e.target.style.color = "#dc2626"; e.target.style.borderColor = "#dc2626"; }}
                        onMouseOut={(e) => { e.target.style.color = "var(--color-text-secondary)"; e.target.style.borderColor = "var(--color-border)"; }}
                      >
                        Remove
                      </button>
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
}

