import { Link } from "react-router-dom";
import WishlistButton from "./WishlistButton";
import CartButton from "./CartButton";

function ProductCard({ product, saved = false, onToggleWishlist, wishlistLoading = false, needsLogin = false, removeOnly = false }) {
  return (
    <article className="product-card">
      <Link className="product-card-image" to={`/products/${product._id}`} aria-label={`View ${product.name}`}>
        <img
          src={product.image}
          alt={product.name}
          loading="lazy"
          onError={(event) => {
            event.currentTarget.onerror = null;
            event.currentTarget.src = "/product-placeholder.svg";
          }}
        />
        <span className="product-card-arrow" aria-hidden="true">↗</span>
      </Link>
      <div className="product-card-body">
        <div className="product-card-topline">
          <span className="eyebrow">{product.category}</span>
          <span className={product.stock > 0 ? "stock-label" : "stock-label unavailable"}>
            {product.stock > 0 ? "In stock" : "Sold out"}
          </span>
        </div>
        <Link className="product-card-title" to={`/products/${product._id}`}>{product.name}</Link>
        <div className="product-card-bottom">
          <span className="product-card-price">₹{product.price.toLocaleString("en-IN")}</span>
          <Link to={`/products/${product._id}`} className="text-link">View details <span aria-hidden="true">→</span></Link>
        </div>
        {onToggleWishlist && <WishlistButton product={product} saved={saved} onToggle={onToggleWishlist} loading={wishlistLoading} needsLogin={needsLogin} removeOnly={removeOnly} />}
        <CartButton product={product} />
      </div>
    </article>
  );
}

export default ProductCard;
