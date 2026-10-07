import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import api from "../services/api";
import Navbar from "../components/Navbar";
import useWishlist from "../hooks/useWishlist";

const money = (value) => `₹${value.toLocaleString("en-IN")}`;

function OrderDetails() {
  const { id } = useParams();
  const location = useLocation();
  const wishlist = useWishlist();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    api.get(`/orders/${id}`, { signal: controller.signal })
      .then((response) => { setOrder(response.data.order); setError(""); })
      .catch((requestError) => {
        if (requestError.code !== "ERR_CANCELED") setError(requestError.response?.status === 404 ? "This order could not be found." : "Unable to load this order. Please try again.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, retry]);

  return (
    <div className="site-page">
      <Navbar wishlistCount={wishlist.count} />
      <main className="page-shell catalog-content order-details-page">
        {loading ? (
          <div className="products-state" role="status"><span className="loader" /><h2>Loading order...</h2></div>
        ) : error || !order ? (
          <div className="products-state" role="alert"><h2>{error || "Order not found"}</h2><button type="button" className="button button-dark" onClick={() => { setLoading(true); setRetry((value) => value + 1); }}>Try Again ↗</button></div>
        ) : (
          <>
            <span className="section-kicker">{location.state?.justPlaced && order.paymentStatus === "PAID" ? "PAYMENT VERIFIED" : "ORDER DETAILS"}</span>
            <h1>{order.paymentStatus === "PAID" ? "Order placed successfully" : order.paymentStatus === "FAILED" ? "Payment could not start" : "Awaiting payment"}</h1>
            <p className="wishlist-intro">Order #{order._id} · {new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</p>
            <div className="order-details-layout">
              <section className="checkout-panel">
                <div className="order-card-top"><h2>Items ordered</h2><span className={`order-status ${order.paymentStatus === "PAID" ? "paid" : ""}`}>{order.status.replaceAll("_", " ")}</span></div>
                <div className="order-item-list">{order.items.map((item) => <div className="order-item" key={item.product}><img src={item.image || "/product-placeholder.svg"} alt={item.name} onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = "/product-placeholder.svg"; }} /><div><strong>{item.name}</strong><span>{money(item.price)} × {item.quantity}</span></div><b>{money(item.price * item.quantity)}</b></div>)}</div>
                <h3>Shipping to</h3>
                <address>{order.shippingAddress.fullName}<br />{order.shippingAddress.addressLine1}<br />{order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.pincode}<br />{order.shippingAddress.phone}</address>
              </section>
              <aside className="cart-summary"><span className="section-kicker">ORDER TOTAL</span><h2>{money(order.totalAmount)}</h2><p>Payment: {order.paymentStatus}</p><Link to="/orders" className="button button-dark">View My Orders ↗</Link><Link to="/products" className="back-link">Continue shopping →</Link></aside>
            </div>
          </>
        )}
      </main>
      <footer className="site-footer"><div className="page-shell"><strong>shopkart<span>.</span></strong><p>Good things, found here.</p><span>© {new Date().getFullYear()} ShopKart</span></div></footer>
    </div>
  );
}

export default OrderDetails;
