import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import WishlistCard from "../components/WishlistCard";
import useWishlist from "../hooks/useWishlist";

function Wishlist() {
  const { wishlist, count, loading, error, needsLogin, fetchWishlist, toggleProduct } = useWishlist();

  return (
    <div className="site-page">
      <Navbar wishlistCount={count} />
      <main className="page-shell catalog-content wishlist-page">
        <div className="catalog-title-row">
          <div><span className="section-kicker">KEEP YOUR FAVORITES CLOSE</span><h1>My Wishlist</h1></div>
          {!loading && !error && <span className="results-count">{wishlist.length} {wishlist.length === 1 ? "product" : "products"} saved</span>}
        </div>
        <p className="wishlist-intro">The things you love, saved for another day.</p>
        {loading ? (
          <div className="products-state" role="status"><span className="loader" /><h2>Loading your wishlist...</h2></div>
        ) : needsLogin ? (
          <div className="products-state"><span className="state-icon" aria-hidden="true">♡</span><h2>Your favorites are personal</h2><p>Sign in to view and save your wishlist.</p><Link to="/login" className="button button-dark">Sign in <span aria-hidden="true">↗</span></Link></div>
        ) : error ? (
          <div className="products-state" role="alert"><span className="state-icon" aria-hidden="true">!</span><h2>Something went wrong</h2><p>{error}</p><button type="button" className="button button-dark" onClick={() => fetchWishlist()}>Try again <span aria-hidden="true">↗</span></button></div>
        ) : wishlist.length === 0 ? (
          <div className="products-state"><span className="state-icon" aria-hidden="true">♡</span><h2>Your wishlist is empty</h2><p>Save products you love and find them here later.</p><Link to="/products" className="button button-dark">Browse Products <span aria-hidden="true">↗</span></Link></div>
        ) : (
          <div className="products-grid">{wishlist.map((product) => <WishlistCard key={product._id} product={product} onRemove={toggleProduct} />)}</div>
        )}
        <Link to="/products" className="back-link">← Continue shopping</Link>
      </main>
      <footer className="site-footer"><div className="page-shell"><strong>shopkart<span>.</span></strong><p>Good things, found here.</p><span>© {new Date().getFullYear()} ShopKart</span></div></footer>
    </div>
  );
}

export default Wishlist;
