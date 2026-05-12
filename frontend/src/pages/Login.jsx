import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./Auth.css";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name] || errors.general) setErrors((prev) => ({ ...prev, [name]: "", general: "" }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.email.trim()) errs.email = "Email is required.";
    if (!form.password) errs.password = "Password is required.";
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    setErrors({});
    try {
      await login(form.email, form.password);
      navigate("/dashboard");
    } catch (err) {
      const apiErrors = err.response?.data?.errors || {};
      setErrors({ general: apiErrors.general || "Something went wrong." });
    } finally { setLoading(false); }
  };

  return (
    <div className="auth-page" id="login-page">
      <div className="auth-brand-panel">
        <div className="auth-orb auth-orb-1" />
        <div className="auth-orb auth-orb-2" />
        <div className="brand-content">
          <div className="brand-logo">
            <div className="brand-icon">💰</div>
            <span className="brand-name">PlainPocket</span>
          </div>
          <p className="brand-tagline">Your finances, decoded. One dashboard to track every rupee across all your accounts.</p>
          <ul className="brand-features">
            <li><span className="feature-icon">📄</span>Upload bank statements from HDFC & SBI</li>
            <li><span className="feature-icon">🤖</span>AI-powered categorization in plain language</li>
            <li><span className="feature-icon">📊</span>Beautiful dashboards & spending insights</li>
            <li><span className="feature-icon">💬</span>Chat with your financial data using AI</li>
          </ul>
        </div>
      </div>
      <div className="auth-form-panel">
        <div className="auth-form-container">
          <div className="auth-form-header">
            <h1>Welcome back</h1>
            <p>Sign in to your PlainPocket account</p>
          </div>
          {errors.general && <div className="form-error-general">⚠️ {errors.general}</div>}
          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label className="form-label" htmlFor="login-email">Email Address</label>
              <div className="form-input-wrapper">
                <span className="form-input-icon">✉️</span>
                <input id="login-email" className={`form-input ${errors.email ? "error" : ""}`} type="email" name="email" placeholder="you@example.com" value={form.email} onChange={handleChange} autoComplete="email" autoFocus />
              </div>
              {errors.email && <div className="form-error">{errors.email}</div>}
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="login-password">Password</label>
              <div className="form-input-wrapper">
                <span className="form-input-icon">🔒</span>
                <input id="login-password" className={`form-input ${errors.password ? "error" : ""}`} type={showPassword ? "text" : "password"} name="password" placeholder="Enter your password" value={form.password} onChange={handleChange} autoComplete="current-password" />
                <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>{showPassword ? "🙈" : "👁️"}</button>
              </div>
              {errors.password && <div className="form-error">{errors.password}</div>}
            </div>
            <button type="submit" className="auth-submit-btn" id="login-submit" disabled={loading}>
              {loading && <span className="btn-spinner" />}{loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
          <div className="auth-form-footer">Don't have an account?<Link to="/signup">Create one</Link></div>
        </div>
      </div>
    </div>
  );
}
