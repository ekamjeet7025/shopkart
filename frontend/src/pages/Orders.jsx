import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import Navbar from "../components/Navbar";
import useWishlist from "../hooks/useWishlist";

const money = (value) => `₹${value.toLocaleString("en-IN")}`;

function Orders() {
  const wishlist = useWishlist();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    api.get("/orders", { signal: controller.signal })
      .then((response) => { setOrders(response.data.orders); setError(""); setNeedsLogin(false); })
      .catch((requestError) => {
        if (requestError.code === "ERR_CANCELED") return;
        setNeedsLogin(requestError.response?.status === 401);
        setError(requestError.response?.data?.message || "Unable to load orders. Please try again.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [retry]);

  return (
    <div className="site-page">
      <Navbar wishlistCount={wishlist.count} />
      <main className="page-shell catalog-content orders-page">
        <span className="section-kicker">YOUR SHOPPING HISTORY</span><h1>My Orders</h1>
        <p className="wishlist-intro">A record of everything you ordered.</p>
        {loading ? (
          <div className="products-state" role="status"><span className="loader" /><h2>Loading your orders...</h2></div>
        ) : needsLogin ? (
          <div className="products-state"><h2>Sign in to view orders</h2><Link to="/login" className="button button-dark">Sign in ↗</Link></div>
        ) : error ? (
          <div className="products-state" role="alert"><h2>Unable to load orders</h2><p>{error}</p><button type="button" className="button button-dark" onClick={() => { setLoading(true); setRetry((value) => value + 1); }}>Try Again ↗</button></div>
        ) : orders.length === 0 ? (
          <div className="products-state"><span className="state-icon" aria-hidden="true">▤</span><h2>You have not placed any orders yet</h2><p>When you complete checkout, your orders will appear here.</p><Link to="/products" className="button button-dark">Start Shopping ↗</Link></div>
        ) : (
          <div className="orders-list">{orders.map((order) => (
            <article className="order-card" key={order._id}>
              <div className="order-card-top"><div><span className="section-kicker">ORDER #{order._id.slice(-8).toUpperCase()}</span><h2>{new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</h2></div><span className={`order-status ${order.paymentStatus === "PAID" ? "paid" : ""}`}>{order.status.replaceAll("_", " ")}</span></div>
              <p>{order.items.map((item) => `${item.name} × ${item.quantity}`).join(" · ")}</p>
              <div className="order-card-bottom"><strong>{money(order.totalAmount)}</strong><Link className="text-link" to={`/orders/${order._id}`}>View details →</Link></div>
            </article>
          ))}</div>
        )}
        <Link to="/products" className="back-link">← Continue shopping</Link>
      </main>
      <footer className="site-footer"><div className="page-shell"><strong>shopkart<span>.</span></strong><p>Good things, found here.</p><span>© {new Date().getFullYear()} ShopKart</span></div></footer>
    </div>
  );
}

export default Orders;
