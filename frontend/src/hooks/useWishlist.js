import { useCallback, useEffect, useState } from "react";
import api from "../services/api";

// Each page owns its API state. MongoDB, not a global frontend store, persists it.
function useWishlist() {
  const [wishlist, setWishlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const fetchWishlist = useCallback((signal) => {
    return api.get("/wishlist", { signal }).then((response) => {
      setError("");
      setWishlist(response.data.wishlist);
      setNeedsLogin(false);
      setLoaded(true);
    }).catch((requestError) => {
      if (requestError.code === "ERR_CANCELED") return;
      setNeedsLogin(requestError.response?.status === 401);
      setLoaded(false);
      setError(requestError.response?.data?.message || "We couldn’t load your wishlist. Please try again.");
    }).finally(() => {
      if (!signal?.aborted) setLoading(false);
    });
  }, []);

  const refreshWishlist = () => {
    setLoading(true);
    setError("");
    return fetchWishlist();
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchWishlist(controller.signal);
    return () => controller.abort();
  }, [fetchWishlist]);

  const toggleProduct = async (product) => {
    const saved = wishlist.some((item) => item._id === product._id);
    try {
      if (saved) {
        await api.delete(`/wishlist/${product._id}`);
        setWishlist((items) => items.filter((item) => item._id !== product._id));
      } else {
        await api.post(`/wishlist/${product._id}`);
        setWishlist((items) => items.some((item) => item._id === product._id) ? items : [...items, product]);
      }
    } catch (requestError) {
      // Another tab may have saved/removed this item. Reconcile with the server.
      if ((!saved && requestError.response?.status === 409) || (saved && requestError.response?.status === 404)) {
        await refreshWishlist();
        return;
      }
      if (requestError.response?.status === 401) {
        setNeedsLogin(true);
        setLoaded(false);
        throw new Error("Please sign in to save products to your wishlist.");
      }
      throw new Error(requestError.response?.data?.message || `Unable to ${saved ? "remove" : "save"} product. Please try again.`);
    }
  };

  return { wishlist, loading, error, needsLogin, fetchWishlist: refreshWishlist, toggleProduct, count: loaded ? wishlist.length : undefined };
}

export default useWishlist;
