import ProductCard from "./ProductCard";

function WishlistCard({ product, onRemove }) {
  return <ProductCard product={product} saved onToggleWishlist={onRemove} removeOnly />;
}

export default WishlistCard;
