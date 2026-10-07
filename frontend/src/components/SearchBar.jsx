const categories = ["All", "Electronics", "Fashion", "Books", "Home"];

function SearchBar({ search, setSearch, category, setCategory }) {
  return (
    <div className="catalog-controls">
      <div className="category-tabs" role="group" aria-label="Filter by category">
        {categories.map((item) => (
          <button
            key={item}
            type="button"
            className={category === (item === "All" ? "" : item) ? "category-tab selected" : "category-tab"}
            onClick={() => setCategory(item === "All" ? "" : item)}
          >
            {item}
          </button>
        ))}
      </div>
      <label className="catalog-search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="10.8" cy="10.8" r="7.3"/><path d="m16.2 16.2 5 5"/></svg>
        <span className="sr-only">Search products</span>
        <input type="search" placeholder="Search products" value={search} onChange={(event) => setSearch(event.target.value)} />
      </label>
    </div>
  );
}

export default SearchBar;
