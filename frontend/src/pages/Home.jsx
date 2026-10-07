import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api";
import Navbar from "../components/Navbar";
import ProductCard from "../components/ProductCard";
import useWishlist from "../hooks/useWishlist";

const categories = [
  { name: "Electronics", symbol: "◉", tone: "category-electronics" },
  { name: "Fashion", symbol: "✳", tone: "category-fashion" },
  { name: "Books", symbol: "▤", tone: "category-books" },
  { name: "Home", symbol: "⌂", tone: "category-home" },
];

function Home() {
  const savedProducts = useWishlist();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [featured, setFeatured] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api.get("/customers/me")
      .then((response) => {
        if (active) setCustomer(response.data.customer);
      })
      .catch(() => {
        if (active) navigate("/login", { replace: true });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    api.get("/products")
      .then((response) => {
        if (active) setFeatured(response.data.products.slice(0, 3));
      })
      .catch(() => {});
    return () => { active = false; };
  }, [navigate]);

  if (loading) return <div className="page-loader"><span className="loader" />Loading your space...</div>;
  if (!customer) return null;

  const firstName = customer.fullName?.split(" ")[0] || "there";

  return (
    <div className="site-page">
      <Navbar wishlistCount={savedProducts.count} />
      <main>
        <section className="home-hero page-shell">
          <div className="home-hero-copy">
            <span className="section-kicker light">THE GOOD STUFF STARTS HERE</span>
            <h1>Welcome back,<br /><em>{firstName}.</em></h1>
            <p>Fresh finds, familiar favorites, and a little inspiration for whatever today brings.</p>
            <Link to="/products" className="button button-lime">Explore the collection <span aria-hidden="true">↗</span></Link>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" />
            <div className="hero-display"><span>SK</span><small>GOOD THINGS<br />LIVE HERE</small></div>
            <div className="hero-sticker">Curated<br />for you ✳</div>
          </div>
          <span className="hero-index">01 / YOUR SPACE</span>
        </section>

        <section className="home-section page-shell">
          <div className="section-heading">
            <div><span className="section-kicker">EXPLORE BY CATEGORY</span><h2>Find your kind of thing.</h2></div>
            <Link className="text-link" to="/products">Shop everything <span aria-hidden="true">→</span></Link>
          </div>
          <div className="category-grid">
            {categories.map((item) => (
              <Link key={item.name} className={`category-card ${item.tone}`} to={`/products?category=${encodeURIComponent(item.name)}`}>
                <span className="category-symbol" aria-hidden="true">{item.symbol}</span>
                <span className="category-card-bottom"><strong>{item.name}</strong><span aria-hidden="true">↗</span></span>
              </Link>
            ))}
          </div>
        </section>

        {featured.length > 0 && (
          <section className="home-section page-shell">
            <div className="section-heading">
              <div><span className="section-kicker">HANDPICKED FOR YOU</span><h2>Worth a closer look.</h2></div>
              <Link className="text-link" to="/products">View all products <span aria-hidden="true">→</span></Link>
            </div>
            {savedProducts.error && !savedProducts.needsLogin && <p className="wishlist-notice" role="alert">{savedProducts.error} <button type="button" onClick={() => savedProducts.fetchWishlist()}>Retry wishlist</button></p>}
            <div className="products-grid">{featured.map((product) => <ProductCard key={product._id} product={product} saved={savedProducts.wishlist.some((item) => item._id === product._id)} onToggleWishlist={savedProducts.toggleProduct} wishlistLoading={savedProducts.loading} needsLogin={savedProducts.needsLogin} />)}</div>
          </section>
        )}

        <section className="account-section page-shell">
          <div className="account-intro"><span className="section-kicker">YOUR ACCOUNT</span><h2>A place for the details.</h2><p>Keep your information close and your shopping simple.</p></div>
          <div className="account-card">
            <div className="account-card-top"><div className="account-avatar">{firstName.charAt(0).toUpperCase()}</div><span className="account-status"><span /> Account active</span></div>
            <dl>
              <div><dt>Full name</dt><dd>{customer.fullName}</dd></div>
              <div><dt>Email address</dt><dd>{customer.email}</dd></div>
              <div><dt>Phone number</dt><dd>{customer.phone}</dd></div>
            </dl>
          </div>
        </section>
      </main>
      <footer className="site-footer"><div className="page-shell"><strong>shopkart<span>.</span></strong><p>Good things, found here.</p><span>© {new Date().getFullYear()} ShopKart</span></div></footer>
    </div>
  );
}

export default Home;
