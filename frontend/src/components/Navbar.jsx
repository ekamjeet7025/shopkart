import { useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import api from "../services/api";
import useCart from "../hooks/useCart";

function Navbar({ wishlistCount }) {
  const navigate = useNavigate();
  const [signedIn, setSignedIn] = useState(false);
  const cart = useCart();

  useEffect(() => {
    let active = true;
    api.get("/customers/me")
      .then(() => { if (active) setSignedIn(true); })
      .catch(() => { if (active) setSignedIn(false); });
    return () => { active = false; };
  }, []);

  const handleLogout = async () => {
    if (!signedIn) {
      navigate("/login");
      return;
    }
    try {
      await api.post("/customers/logout");
      cart.clearCart();
      setSignedIn(false);
      navigate("/login");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <>
      <div className="announcement-bar">Thoughtfully chosen. Made for everyday living.</div>
      <header className="site-header">
        <nav className="navbar page-shell" aria-label="Main navigation">
          <Link to="/products" className="brand" aria-label="ShopKart home">
            <span className="brand-mark" aria-hidden="true"><span /><span /><span /><span /></span>
            <span>shopkart<span className="brand-dot">.</span></span>
          </Link>
          <div className="nav-links">
            <NavLink to="/home" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>Home</NavLink>
            <NavLink to="/products" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>Products</NavLink>
            <NavLink to="/wishlist" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>Wishlist{wishlistCount !== undefined ? ` (${wishlistCount})` : ""}</NavLink>
            <NavLink to="/cart" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>Cart{!cart.loading && !cart.needsLogin && !cart.error ? ` (${cart.totalUnits})` : ""}</NavLink>
            <NavLink to="/orders" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>Orders</NavLink>
          </div>
          <button className="nav-account" onClick={handleLogout}>{signedIn ? "Log out" : "Sign in"} <span aria-hidden="true">↗</span></button>
        </nav>
      </header>
    </>
  );
}

export default Navbar;
