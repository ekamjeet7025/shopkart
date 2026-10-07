import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api";

function Register() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ fullName: "", email: "", password: "", phone: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (formData.password.length < 6) return setError("Use at least 6 characters for your password.");
    try {
      setLoading(true);
      const response = await api.post("/customers/register", formData);
      setSuccess(response.data.message);
      setTimeout(() => navigate("/login"), 1000);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Couldn’t create your account. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-layout">
      <section className="auth-panel">
        <Link to="/products" className="brand" aria-label="ShopKart home"><span className="brand-mark" aria-hidden="true"><span /><span /><span /><span /></span><span>shopkart<span className="brand-dot">.</span></span></Link>
        <div className="auth-content">
          <span className="section-kicker">LET’S GET STARTED</span>
          <h1>Good things<br />start here.</h1>
          <p className="auth-description">Create your account to discover more of what you love.</p>
          <form onSubmit={handleSubmit} className="auth-form">
            <label htmlFor="register-name">Full name</label>
            <input id="register-name" type="text" autoComplete="name" placeholder="Your full name" value={formData.fullName} onChange={(event) => setFormData({ ...formData, fullName: event.target.value })} required />
            <label htmlFor="register-email">Email address</label>
            <input id="register-email" type="email" autoComplete="email" placeholder="you@example.com" value={formData.email} onChange={(event) => setFormData({ ...formData, email: event.target.value })} required />
            <label htmlFor="register-phone">Phone number</label>
            <input id="register-phone" type="tel" autoComplete="tel" placeholder="Your phone number" value={formData.phone} onChange={(event) => setFormData({ ...formData, phone: event.target.value })} required />
            <label htmlFor="register-password">Password</label>
            <input id="register-password" type="password" autoComplete="new-password" placeholder="At least 6 characters" minLength={6} value={formData.password} onChange={(event) => setFormData({ ...formData, password: event.target.value })} required />
            {error && <p className="form-message error" role="alert">{error}</p>}
            {success && <p className="form-message success" role="status">{success}</p>}
            <button className="button button-dark auth-submit" type="submit" disabled={loading}>{loading ? "Creating account..." : "Create account"}<span aria-hidden="true">↗</span></button>
          </form>
          <p className="auth-switch">Already have an account? <Link to="/login">Sign in <span aria-hidden="true">→</span></Link></p>
        </div>
        <p className="auth-copyright">© {new Date().getFullYear()} ShopKart. Good things, found here.</p>
      </section>
      <aside className="auth-visual"><div className="auth-visual-shape"><span>SK</span></div><div className="auth-visual-copy"><span className="section-kicker light">A LITTLE MORE EVERYDAY</span><h2>A better way<br />to discover.</h2><p>Your kind of things, all in one thoughtful place.</p></div></aside>
    </main>
  );
}

export default Register;
