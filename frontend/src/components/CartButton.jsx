import { useState } from "react";
import { Link } from "react-router-dom";
import useCart from "../hooks/useCart";

function CartButton({ product, className = "cart-button" }) {
  const cart = useCart();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const busy = cart.busyIds.includes(product._id);
  const inCart = cart.cartItems.some((item) => item.product._id === product._id);
  const soldOut = product.stock < 1;

  const handleAdd = async () => {
    setMessage("");
    setError("");
    try {
      await cart.addToCart(product._id);
      setMessage("Added to cart");
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  return (
    <div className="cart-action">
      <button type="button" className={className} disabled={busy || soldOut} onClick={handleAdd}>
        {soldOut ? "Sold out" : busy ? "Adding..." : inCart ? "Add another" : "Add to cart"}
        <span aria-hidden="true"> ↗</span>
      </button>
      {message && !busy && <p className="cart-action-success" role="status">{message} · <Link to="/cart">View cart</Link></p>}
      {error && <p className="cart-action-error" role="alert">{error} {cart.needsLogin && <Link to="/login">Sign in →</Link>}</p>}
    </div>
  );
}

export default CartButton;
