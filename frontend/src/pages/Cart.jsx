import { useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import useCart from "../hooks/useCart";
import useWishlist from "../hooks/useWishlist";

const money = (value) => `₹${value.toLocaleString("en-IN")}`;

function CartItem({ item }) {
  const cart = useCart();
  const [error, setError] = useState("");
  const product = item.product;
  const busy = cart.busyIds.includes(product._id);

  const changeQuantity = async (quantity) => {
    setError("");
    try {
      await cart.updateQuantity(product._id, quantity);
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const remove = async () => {
    setError("");
    try {
      await cart.removeFromCart(product._id);
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  return (
    <article className="cart-item">
      <Link to={`/products/${product._id}`} className="cart-item-image"><img src={product.image} alt={product.name} onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = "/product-placeholder.svg"; }} /></Link>
      <div className="cart-item-info">
        <span className="eyebrow">{product.category}</span>
        <Link to={`/products/${product._id}`} className="cart-item-name">{product.name}</Link>
        <span className="cart-item-unit">{money(product.price)} each</span>
        <span className={item.quantity > product.stock ? "cart-stock-warning" : "cart-item-stock"}>
          {item.quantity > product.stock ? `Only ${product.stock} currently available` : product.stock > 0 ? `${product.stock} in stock` : "Out of stock"}
        </span>
      </div>
      <div className="cart-item-actions">
        <strong>{money(product.price * item.quantity)}</strong>
        <div className="quantity-control" aria-label={`Quantity for ${product.name}`}>
          <button type="button" aria-label={`Decrease ${product.name} quantity`} disabled={busy || item.quantity <= 1} onClick={() => changeQuantity(item.quantity - 1)}>−</button>
          <span aria-live="polite">{busy ? "…" : item.quantity}</span>
          <button type="button" aria-label={`Increase ${product.name} quantity`} disabled={busy || item.quantity >= product.stock} onClick={() => changeQuantity(item.quantity + 1)}>+</button>
        </div>
        <button type="button" className="cart-remove" disabled={busy} onClick={remove}>{busy ? "Updating..." : "Remove"}</button>
        {error && <p className="cart-action-error" role="alert">{error}</p>}
      </div>
    </article>
  );
}

function Cart() {
  const cart = useCart();
  const wishlist = useWishlist();

  return (
    <div className="site-page">
      <Navbar wishlistCount={wishlist.count} />
      <main className="page-shell catalog-content cart-page">
        <div className="catalog-title-row"><div><span className="section-kicker">READY WHEN YOU ARE</span><h1>My Cart</h1></div>{!cart.loading && !cart.error && !cart.needsLogin && <span className="results-count">{cart.totalUnits} {cart.totalUnits === 1 ? "item" : "items"}</span>}</div>
        <p className="wishlist-intro">Review the things you picked before checkout.</p>
        {cart.loading ? (
          <div className="products-state" role="status"><span className="loader" /><h2>Loading your cart...</h2></div>
        ) : cart.needsLogin ? (
          <div className="products-state"><span className="state-icon" aria-hidden="true">🛒</span><h2>Your cart is personal</h2><p>Sign in to see the items you saved for purchase.</p><Link to="/login" className="button button-dark">Sign in ↗</Link></div>
        ) : cart.error ? (
          <div className="products-state" role="alert"><span className="state-icon" aria-hidden="true">!</span><h2>Unable to load your cart</h2><p>{cart.error}</p><button type="button" className="button button-dark" onClick={cart.refreshCart}>Try Again ↗</button></div>
        ) : cart.cartItems.length === 0 ? (
          <div className="products-state"><span className="state-icon" aria-hidden="true">🛒</span><h2>Your cart is empty</h2><p>Looks like you haven’t added anything yet.</p><Link to="/products" className="button button-dark">Browse Products ↗</Link></div>
        ) : (
          <div className="cart-layout">
            <div className="cart-list">{cart.cartItems.map((item) => <CartItem key={item.product._id} item={item} />)}</div>
            <aside className="cart-summary">
              <span className="section-kicker">YOUR SELECTION</span><h2>Order summary</h2>
              <div><span>Total units</span><strong>{cart.totalUnits}</strong></div>
              <div className="cart-summary-total"><span>Subtotal</span><strong>{money(cart.subtotal)}</strong></div>
              <p>Shipping and final stock checks will be handled at checkout.</p>
              <Link to="/checkout" className="button button-dark">Proceed to Checkout ↗</Link>
              <small>Final price and stock are checked before payment.</small>
            </aside>
          </div>
        )}
        <Link to="/products" className="back-link">← Continue shopping</Link>
      </main>
      <footer className="site-footer"><div className="page-shell"><strong>shopkart<span>.</span></strong><p>Good things, found here.</p><span>© {new Date().getFullYear()} ShopKart</span></div></footer>
    </div>
  );
}

export default Cart;
