import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import ThemeToggle from "../context/ThemeToggle";
import "./Upload.css";

const BANKS = ["AUTO", "HDFC", "SBI", "ICICI", "AXIS"];

export default function Upload() {
  const [selectedBank, setSelectedBank] = useState("AUTO");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState(null);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.type === "text/csv") {
      setFile(selectedFile);
      setMessage(null);
    } else {
      setMessage({ type: "error", text: "Please select a valid CSV file." });
    }
  };

  const handleUpload = async () => {
    if (!selectedBank) {
      setMessage({ type: "error", text: "Please select your bank." });
      return;
    }
    if (!file) {
      setMessage({ type: "error", text: "Please select a file to upload." });
      return;
    }

    setUploading(true);
    setMessage(null);
    setProgress(0);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("bank_name", selectedBank);

    const token = localStorage.getItem("pp_token");

    try {
      const response = await axios.post("http://localhost:5000/api/upload/statement", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${token}`,
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setProgress(percentCompleted);
        },
      });

      setMessage({ type: "success", text: response.data.message });
      setTimeout(() => navigate("/dashboard"), 2000);
    } catch (err) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Upload failed. Please try again.",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="upload-layout">
      <div style={{ position: "absolute", top: "24px", right: "24px", display: "flex", gap: "16px", alignItems: "center" }}>
        <button onClick={() => navigate("/dashboard")} style={{ background: "transparent", border: "none", color: "var(--color-text-secondary)", cursor: "pointer", fontWeight: 500 }}>
          Cancel
        </button>
        <ThemeToggle />
      </div>
      <main className="upload-main">
        <div className="upload-header">
          <h1>Upload Statement</h1>
          <p>Select your bank and upload your CSV statement to start tracking.</p>
        </div>

        <div className="upload-card">
          <div className="bank-selector">
            <label className="form-label">Select Bank</label>
            <div className="bank-grid">
              {BANKS.map((bank) => (
                <div
                  key={bank}
                  className={`bank-option ${selectedBank === bank ? "active" : ""}`}
                  onClick={() => setSelectedBank(bank)}
                >
                  {bank === "AUTO" ? "Auto-Detect" : bank}
                </div>
              ))}
            </div>
          </div>

          <div
            className={`dropzone ${file ? "has-file" : ""}`}
            onClick={() => fileInputRef.current.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".csv"
              style={{ display: "none" }}
            />
            <div className="dropzone-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <div className="dropzone-text">
              <h3>{file ? file.name : "Choose a file or drag it here"}</h3>
              <p>Only .CSV files are supported</p>
            </div>
          </div>

          {file && (
            <div className="selected-file">
              <div className="file-info">
                <span>📄</span>
                <span>{file.name} ({(file.size / 1024).toFixed(1)} KB)</span>
              </div>
              <button className="remove-file" onClick={() => setFile(null)}>✕</button>
            </div>
          )}

          {uploading && (
            <div className="progress-container">
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${progress}%` }}></div>
              </div>
              <p className="progress-text">Uploading... {progress}%</p>
            </div>
          )}

          {message && (
            <div className={`upload-message ${message.type}`}>
              {message.text}
            </div>
          )}

          <button
            className="upload-submit-btn"
            onClick={handleUpload}
            disabled={uploading || !file || !selectedBank}
          >
            {uploading ? "Processing..." : "Import Statement"}
          </button>
        </div>
      </main>
    </div>
  );
}
