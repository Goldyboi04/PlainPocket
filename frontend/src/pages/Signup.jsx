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
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-mark">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 17l10-5 10 5M2 12l10-5 10 5" />
            </svg>
          </div>
          <span className="auth-logo-text">PlainPocket</span>
        </div>

        <div className="auth-header">
          <h1>Create an account</h1>
          <p>Start tracking your finances</p>
        </div>

        {errors.general && <div className="form-error-banner">{errors.general}</div>}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="signup-name">Full name</label>
            <input
              id="signup-name"
              className={`form-input ${errors.name ? "error" : ""}`}
              type="text"
              name="name"
              placeholder="Dhruv Sharma"
              value={form.name}
              onChange={handleChange}
              autoComplete="name"
              autoFocus
            />
            {errors.name && <div className="form-error">{errors.name}</div>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="signup-mobile">Mobile number</label>
            <input
              id="signup-mobile"
              className={`form-input ${errors.mobile ? "error" : ""}`}
              type="tel"
              name="mobile"
              placeholder="9876543210"
              value={form.mobile}
              onChange={handleChange}
              maxLength={10}
              autoComplete="tel"
            />
            {errors.mobile && <div className="form-error">{errors.mobile}</div>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="signup-email">Email</label>
            <input
              id="signup-email"
              className={`form-input ${errors.email ? "error" : ""}`}
              type="email"
              name="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={handleChange}
              autoComplete="email"
            />
            {errors.email && <div className="form-error">{errors.email}</div>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="signup-password">Password</label>
            <div className="password-wrapper">
              <input
                id="signup-password"
                className={`form-input ${errors.password ? "error" : ""}`}
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="Min. 6 characters"
                value={form.password}
                onChange={handleChange}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            {errors.password && <div className="form-error">{errors.password}</div>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="signup-confirm">Confirm password</label>
            <div className="password-wrapper">
              <input
                id="signup-confirm"
                className={`form-input ${errors.confirmPassword ? "error" : ""}`}
                type={showConfirm ? "text" : "password"}
                name="confirmPassword"
                placeholder="Re-enter your password"
                value={form.confirmPassword}
                onChange={handleChange}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowConfirm(!showConfirm)}
                tabIndex={-1}
                aria-label={showConfirm ? "Hide password" : "Show password"}
              >
                {showConfirm ? "Hide" : "Show"}
              </button>
            </div>
            {errors.confirmPassword && <div className="form-error">{errors.confirmPassword}</div>}
          </div>

          <button type="submit" className="auth-submit-btn" id="signup-submit" disabled={loading}>
            {loading && <span className="btn-spinner" />}
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <div className="auth-footer">
          Already have an account?<Link to="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
