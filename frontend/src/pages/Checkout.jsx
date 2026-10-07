import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api";
import Navbar from "../components/Navbar";
import useCart from "../hooks/useCart";
import useWishlist from "../hooks/useWishlist";

const fields = [
  ["fullName", "Full name", "text", "name"],
  ["phone", "Phone number", "tel", "tel"],
  ["addressLine1", "Address line", "text", "street-address"],
  ["city", "City", "text", "address-level2"],
  ["state", "State", "text", "address-level1"],
  ["pincode", "Pincode", "text", "postal-code"],
];
const emptyAddress = { fullName: "", phone: "", addressLine1: "", city: "", state: "", pincode: "" };
const money = (value) => `₹${value.toLocaleString("en-IN")}`;

function validateAddress(address) {
  const errors = {};
  for (const [key, label] of fields) {
    if (!address[key].trim()) errors[key] = `${label} is required.`;
  }
  if (address.phone.trim() && !/^[6-9]\d{9}$/.test(address.phone.trim())) errors.phone = "Enter a valid 10-digit Indian mobile number.";
  if (address.pincode.trim() && !/^\d{6}$/.test(address.pincode.trim())) errors.pincode = "Pincode must contain 6 digits.";
  return errors;
}

function loadRazorpayScript() {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => { script.remove(); reject(new Error("Payment window could not load. Check your connection and try again.")); };
    document.body.appendChild(script);
  });
}

function Checkout() {
  const navigate = useNavigate();
  const cart = useCart();
  const wishlist = useWishlist();
  const [address, setAddress] = useState(emptyAddress);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState("");
  const [verificationData, setVerificationData] = useState(null);

  useEffect(() => {
    let active = true;
    api.get("/customers/me").then((response) => {
      if (!active) return;
      setAddress((current) => ({
        ...current,
        fullName: current.fullName || response.data.customer.fullName || "",
        phone: current.phone || response.data.customer.phone || ""
      }));
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  const verify = async (details) => {
    setProcessing("verifying");
    setError("");
    try {
      const response = await api.post("/orders/verify-payment", details);
      cart.completeOrder();
      setVerificationData(null);
      navigate(`/orders/${response.data.order._id}`, { replace: true, state: { justPlaced: true } });
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Payment verification could not finish. Your cart is unchanged. Try verification again.");
      setProcessing("");
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (processing) return;
    const trimmed = Object.fromEntries(Object.entries(address).map(([key, value]) => [key, value.trim()]));
    const errors = validateAddress(trimmed);
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    if (cart.cartItems.length === 0) return setError("Your cart is empty.");
    setError("");
    setProcessing("starting");
    try {
      // Load the Checkout script before creating a pending order.
      await loadRazorpayScript();
      const { data } = await api.post("/orders/create-payment-order", { shippingAddress: trimmed });
      if (data.amount !== Math.round(cart.subtotal * 100)) {
        await cart.refreshCart();
        setError("A product price changed. Review your updated cart before paying.");
        setProcessing("");
        return;
      }
      const payment = new window.Razorpay({
        key: data.key,
        amount: data.amount,
        currency: data.currency,
        name: "ShopKart",
        description: "ShopKart Test Mode order",
        order_id: data.razorpayOrderId,
        prefill: { name: trimmed.fullName, contact: trimmed.phone },
        theme: { color: "#254e38" },
        modal: { ondismiss: () => setProcessing("") },
        handler: (result) => {
          const details = {
            shopKartOrderId: data.shopKartOrderId,
            razorpay_order_id: result.razorpay_order_id,
            razorpay_payment_id: result.razorpay_payment_id,
            razorpay_signature: result.razorpay_signature
          };
          setVerificationData(details);
          verify(details);
        }
      });
      payment.on("payment.failed", () => {
        setError("Test payment failed. Your cart is unchanged. Please try again.");
        setProcessing("");
      });
      setProcessing("payment");
      payment.open();
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || "Unable to start payment. Please try again.");
      setProcessing("");
    }
  };

  return (
    <div className="site-page">
      <Navbar wishlistCount={wishlist.count} />
      <main className="page-shell catalog-content checkout-page">
        <span className="section-kicker">LAST STEP</span><h1>Checkout</h1>
        <p className="wishlist-intro">Add your delivery details and review your order before test payment.</p>
        {cart.loading ? (
          <div className="products-state" role="status"><span className="loader" /><h2>Loading your cart...</h2></div>
        ) : cart.needsLogin ? (
          <div className="products-state"><h2>Sign in to checkout</h2><Link to="/login" className="button button-dark">Sign in ↗</Link></div>
        ) : cart.error ? (
          <div className="products-state" role="alert"><h2>Unable to load your cart</h2><p>{cart.error}</p><button type="button" className="button button-dark" onClick={cart.refreshCart}>Try Again ↗</button></div>
        ) : cart.cartItems.length === 0 ? (
          <div className="products-state"><h2>Your cart is empty</h2><p>Add a product before checking out.</p><Link to="/products" className="button button-dark">Browse Products ↗</Link></div>
        ) : (
          <form onSubmit={handleSubmit} className="checkout-layout" noValidate>
            <section className="checkout-panel">
              <span className="section-kicker">DELIVERY DETAILS</span><h2>Shipping address</h2>
              <div className="checkout-fields">
                {fields.map(([key, label, type, autocomplete]) => (
                  <div className={key === "addressLine1" ? "checkout-field wide" : "checkout-field"} key={key}>
                    <label htmlFor={`checkout-${key}`}>{label}</label>
                    <input id={`checkout-${key}`} type={type} autoComplete={autocomplete} value={address[key]} onChange={(event) => setAddress((current) => ({ ...current, [key]: event.target.value }))} aria-invalid={Boolean(fieldErrors[key])} aria-describedby={fieldErrors[key] ? `checkout-${key}-error` : undefined} />
                    {fieldErrors[key] && <small id={`checkout-${key}-error`} className="checkout-field-error">{fieldErrors[key]}</small>}
                  </div>
                ))}
              </div>
            </section>
            <aside className="cart-summary checkout-summary">
              <span className="section-kicker">ORDER REVIEW</span><h2>Your order</h2>
              <ul>{cart.cartItems.map((item) => <li key={item.product._id}><span>{item.product.name} × {item.quantity}</span><strong>{money(item.product.price * item.quantity)}</strong></li>)}</ul>
              <div className="cart-summary-total"><span>Total</span><strong>{money(cart.subtotal)}</strong></div>
              <p>Final price and stock are checked on the server. Razorpay opens in Test Mode; no real money is charged.</p>
              {error && <p className="checkout-error" role="alert">{error}</p>}
              {verificationData && !processing && <button type="button" className="button button-light checkout-retry" onClick={() => verify(verificationData)}>Retry payment verification</button>}
              <button type="submit" className="button button-dark" disabled={Boolean(processing)}>{processing === "starting" ? "Preparing payment..." : processing === "verifying" ? "Verifying payment..." : processing === "payment" ? "Complete test payment..." : "Pay with Razorpay →"}</button>
              <small>Payment is confirmed only after server verification.</small>
            </aside>
          </form>
        )}
        <Link to="/cart" className="back-link">← Back to cart</Link>
      </main>
      <footer className="site-footer"><div className="page-shell"><strong>shopkart<span>.</span></strong><p>Good things, found here.</p><span>© {new Date().getFullYear()} ShopKart</span></div></footer>
    </div>
  );
}

export default Checkout;
