import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api";
import useCart from "../hooks/useCart";

function Login() {
  const navigate = useNavigate();
  const cart = useCart();
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    if (!formData.email || !formData.password) return setError("Enter your email and password.");
    try {
      setLoading(true);
      await api.post("/customers/login", formData);
      await cart.refreshCart();
      navigate("/home");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Couldn’t sign you in. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-layout">
      <section className="auth-panel">
        <Link to="/products" className="brand" aria-label="ShopKart home"><span className="brand-mark" aria-hidden="true"><span /><span /><span /><span /></span><span>shopkart<span className="brand-dot">.</span></span></Link>
        <div className="auth-content">
          <span className="section-kicker">WELCOME BACK</span>
          <h1>Good to see<br />you again.</h1>
          <p className="auth-description">Sign in to your account and pick up where you left off.</p>
          <form onSubmit={handleSubmit} className="auth-form">
            <label htmlFor="login-email">Email address</label>
            <input id="login-email" type="email" autoComplete="email" placeholder="you@example.com" value={formData.email} onChange={(event) => setFormData({ ...formData, email: event.target.value })} required />
            <label htmlFor="login-password">Password</label>
            <input id="login-password" type="password" autoComplete="current-password" placeholder="Enter your password" value={formData.password} onChange={(event) => setFormData({ ...formData, password: event.target.value })} required />
            {error && <p className="form-message error" role="alert">{error}</p>}
            <button className="button button-dark auth-submit" type="submit" disabled={loading}>{loading ? "Signing in..." : "Sign in"}<span aria-hidden="true">↗</span></button>
          </form>
          <p className="auth-switch">New to ShopKart? <Link to="/register">Create an account <span aria-hidden="true">→</span></Link></p>
        </div>
        <p className="auth-copyright">© {new Date().getFullYear()} ShopKart. Good things, found here.</p>
      </section>
      <aside className="auth-visual"><div className="auth-visual-shape"><span>SK</span></div><div className="auth-visual-copy"><span className="section-kicker light">A LITTLE MORE EVERYDAY</span><h2>Your next favorite<br />is waiting.</h2><p>Find the things that make every day feel a little better.</p></div></aside>
    </main>
  );
}

export default Login;
