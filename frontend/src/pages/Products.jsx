import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../services/api";
import Navbar from "../components/Navbar";
import ProductCard from "../components/ProductCard";
import SearchBar from "../components/SearchBar";
import useWishlist from "../hooks/useWishlist";

function Products() {
  const savedProducts = useWishlist();
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [category, setCategory] = useState(searchParams.get("category") || "");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const nextParams = {};
    if (search.trim()) nextParams.search = search.trim();
    if (category) nextParams.category = category;
    setSearchParams(nextParams, { replace: true });

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        setError("");
        const response = await api.get("/products", { params: nextParams, signal: controller.signal });
        setProducts(response.data.products);
      } catch (requestError) {
        if (requestError.code !== "ERR_CANCELED") setError("We couldn’t load the collection. Please try again.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, search ? 350 : 0);

    return () => { clearTimeout(timer); controller.abort(); };
  }, [search, category, retry, setSearchParams]);

  return (
    <div className="site-page">
      <Navbar wishlistCount={savedProducts.count} />
      <main>
        <section className="catalog-hero">
          <div className="page-shell catalog-hero-inner">
            <div><span className="section-kicker light">THE SHOPKART EDIT</span><h1>Find something <em>good.</em></h1><p>Everyday essentials and unexpected favorites, all in one place.</p></div>
            <div className="catalog-hero-mark" aria-hidden="true">S<span>✳</span>K</div>
          </div>
        </section>
        <div className="page-shell catalog-content">
          <div className="catalog-title-row"><div><span className="section-kicker">THE COLLECTION</span><h2>Shop all products</h2></div><span className="results-count">{loading ? "Finding products..." : `${products.length} ${products.length === 1 ? "item" : "items"}`}</span></div>
          <SearchBar search={search} setSearch={setSearch} category={category} setCategory={setCategory} />
          {savedProducts.error && !savedProducts.needsLogin && <p className="wishlist-notice" role="alert">{savedProducts.error} <button type="button" onClick={() => savedProducts.fetchWishlist()}>Retry wishlist</button></p>}
          {loading ? (
            <div className="products-state"><span className="loader" /><h3>Finding the good stuff</h3><p>Just a moment while we load the collection.</p></div>
          ) : error ? (
            <div className="products-state"><span className="state-icon">!</span><h3>Something went wrong</h3><p>{error}</p><button className="button button-dark" onClick={() => setRetry((value) => value + 1)}>Try again <span aria-hidden="true">↗</span></button></div>
          ) : products.length === 0 ? (
            <div className="products-state"><span className="state-icon">⌕</span><h3>No matches just yet</h3><p>Try another search or explore a different category.</p><button className="button button-dark" onClick={() => { setSearch(""); setCategory(""); }}>Clear filters <span aria-hidden="true">↗</span></button></div>
          ) : (
            <div className="products-grid">{products.map((product) => <ProductCard key={product._id} product={product} saved={savedProducts.wishlist.some((item) => item._id === product._id)} onToggleWishlist={savedProducts.toggleProduct} wishlistLoading={savedProducts.loading} needsLogin={savedProducts.needsLogin} />)}</div>
          )}
        </div>
      </main>
      <footer className="site-footer"><div className="page-shell"><strong>shopkart<span>.</span></strong><p>Good things, found here.</p><span>© {new Date().getFullYear()} ShopKart</span></div></footer>
    </div>
  );
}

export default Products;
