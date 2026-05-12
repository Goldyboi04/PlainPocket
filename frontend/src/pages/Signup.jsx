import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./Auth.css";

export default function Signup() {
  const navigate = useNavigate();
  const { signup } = useAuth();
  const [form, setForm] = useState({ name: "", mobile: "", email: "", password: "", confirmPassword: "" });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validate = () => {
    const errs = {};
    if (!form.name.trim() || form.name.trim().length < 2) errs.name = "Name must be at least 2 characters.";
    if (!/^\d{10}$/.test(form.mobile)) errs.mobile = "Enter a valid 10-digit mobile number.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = "Enter a valid email address.";
    if (form.password.length < 6) errs.password = "Password must be at least 6 characters.";
    if (form.password !== form.confirmPassword) errs.confirmPassword = "Passwords do not match.";
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    setErrors({});
    try {
      await signup(form);
      navigate("/dashboard");
    } catch (err) {
      const apiErrors = err.response?.data?.errors || {};
      if (Object.keys(apiErrors).length) {
        setErrors(apiErrors);
      } else {
        setErrors({ general: "Something went wrong. Please try again." });
      }
    } finally { setLoading(false); }
  };

  return (
    <div className="auth-page" id="signup-page">
      <div className="auth-brand-panel">
        <div className="auth-orb auth-orb-1" />
        <div className="auth-orb auth-orb-2" />
        <div className="brand-content">
          <div className="brand-logo">
            <div className="brand-icon">💰</div>
            <span className="brand-name">PlainPocket</span>
          </div>
          <p className="brand-tagline">Take control of your finances. Upload statements, get AI insights, and never lose track of your money again.</p>
          <ul className="brand-features">
            <li><span className="feature-icon">🔐</span>Your data stays private & secure</li>
            <li><span className="feature-icon">⚡</span>Set up in under 2 minutes</li>
            <li><span className="feature-icon">🎯</span>Smart budgets & spending alerts</li>
            <li><span className="feature-icon">📱</span>Works on any device, anywhere</li>
          </ul>
        </div>
      </div>
      <div className="auth-form-panel">
        <div className="auth-form-container">
          <div className="auth-form-header">
            <h1>Create account</h1>
            <p>Start tracking your finances in plain language</p>
          </div>
          {errors.general && <div className="form-error-general">⚠️ {errors.general}</div>}
          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label className="form-label" htmlFor="signup-name">Full Name</label>
              <div className="form-input-wrapper">
                <span className="form-input-icon">👤</span>
                <input id="signup-name" className={`form-input ${errors.name ? "error" : ""}`} type="text" name="name" placeholder="Dhruv Sharma" value={form.name} onChange={handleChange} autoComplete="name" autoFocus />
              </div>
              {errors.name && <div className="form-error">{errors.name}</div>}
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="signup-mobile">Mobile Number</label>
              <div className="form-input-wrapper">
                <span className="form-input-icon">📱</span>
                <input id="signup-mobile" className={`form-input ${errors.mobile ? "error" : ""}`} type="tel" name="mobile" placeholder="9876543210" value={form.mobile} onChange={handleChange} maxLength={10} autoComplete="tel" />
              </div>
              {errors.mobile && <div className="form-error">{errors.mobile}</div>}
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="signup-email">Email Address</label>
              <div className="form-input-wrapper">
                <span className="form-input-icon">✉️</span>
                <input id="signup-email" className={`form-input ${errors.email ? "error" : ""}`} type="email" name="email" placeholder="you@example.com" value={form.email} onChange={handleChange} autoComplete="email" />
              </div>
              {errors.email && <div className="form-error">{errors.email}</div>}
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="signup-password">Password</label>
              <div className="form-input-wrapper">
                <span className="form-input-icon">🔒</span>
                <input id="signup-password" className={`form-input ${errors.password ? "error" : ""}`} type={showPassword ? "text" : "password"} name="password" placeholder="Min. 6 characters" value={form.password} onChange={handleChange} autoComplete="new-password" />
                <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>{showPassword ? "🙈" : "👁️"}</button>
              </div>
              {errors.password && <div className="form-error">{errors.password}</div>}
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="signup-confirm">Confirm Password</label>
              <div className="form-input-wrapper">
                <span className="form-input-icon">🔒</span>
                <input id="signup-confirm" className={`form-input ${errors.confirmPassword ? "error" : ""}`} type={showConfirm ? "text" : "password"} name="confirmPassword" placeholder="Re-enter your password" value={form.confirmPassword} onChange={handleChange} autoComplete="new-password" />
                <button type="button" className="password-toggle" onClick={() => setShowConfirm(!showConfirm)} tabIndex={-1}>{showConfirm ? "🙈" : "👁️"}</button>
              </div>
              {errors.confirmPassword && <div className="form-error">{errors.confirmPassword}</div>}
            </div>
            <button type="submit" className="auth-submit-btn" id="signup-submit" disabled={loading}>
              {loading && <span className="btn-spinner" />}{loading ? "Creating account..." : "Create Account"}
            </button>
          </form>
          <div className="auth-form-footer">Already have an account?<Link to="/login">Sign in</Link></div>
        </div>
      </div>
    </div>
  );
}
