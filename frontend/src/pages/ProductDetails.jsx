import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../services/api";
import Navbar from "../components/Navbar";
import WishlistButton from "../components/WishlistButton";
import useWishlist from "../hooks/useWishlist";
import CartButton from "../components/CartButton";

function ProductDetails() {
  const savedProducts = useWishlist();
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    api.get(`/products/${id}`, { signal: controller.signal })
      .then((response) => setProduct(response.data.product))
      .catch((requestError) => {
        if (requestError.code !== "ERR_CANCELED") setError(requestError.response?.status === 404 ? "This product could not be found." : "We couldn’t load this product right now.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id]);

  return (
    <div className="site-page">
      <Navbar wishlistCount={savedProducts.count} />
      <main className="details-page page-shell">
        <div className="breadcrumbs"><Link to="/products">Shop all</Link><span>/</span><span>{product?.name || "Product details"}</span></div>
        {loading ? (
          <div className="products-state"><span className="loader" /><h3>Loading product</h3></div>
        ) : error || !product ? (
          <div className="products-state"><span className="state-icon">!</span><h3>{error || "Product not found"}</h3><Link className="button button-dark" to="/products">Back to shop <span aria-hidden="true">↗</span></Link></div>
        ) : (
          <div className="detail-layout">
            <div className="detail-image-wrap"><img src={product.image} alt={product.name} onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = "/product-placeholder.svg"; }} /></div>
            <div className="detail-copy">
              <span className="section-kicker">{product.category}</span>
              <h1>{product.name}</h1>
              <p className="detail-price">₹{product.price.toLocaleString("en-IN")}</p>
              <div className="detail-rule" />
              <h2>Product details</h2>
              <p className="detail-description">{product.description}</p>
              <p className={product.stock > 0 ? "detail-stock" : "detail-stock unavailable"}><span />{product.stock > 0 ? `${product.stock} ${product.stock === 1 ? "item" : "items"} available` : "Currently out of stock"}</p>
              <CartButton product={product} className="button button-dark detail-action" />
              <p className="detail-note">A good find deserves a closer look.</p>
              {savedProducts.error && !savedProducts.needsLogin && <p className="wishlist-notice" role="alert">{savedProducts.error} <button type="button" onClick={() => savedProducts.fetchWishlist()}>Retry wishlist</button></p>}
              <WishlistButton product={product} saved={savedProducts.wishlist.some((item) => item._id === product._id)} onToggle={savedProducts.toggleProduct} loading={savedProducts.loading} needsLogin={savedProducts.needsLogin} />
            </div>
          </div>
        )}
        <Link to="/products" className="back-link"><span aria-hidden="true">←</span> Back to all products</Link>
      </main>
      <footer className="site-footer"><div className="page-shell"><strong>shopkart<span>.</span></strong><p>Good things, found here.</p><span>© {new Date().getFullYear()} ShopKart</span></div></footer>
    </div>
  );
}

export default ProductDetails;
