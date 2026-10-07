import { useCallback, useEffect, useRef, useState } from "react";
import api from "../services/api";
import { CartContext } from "./cartContextValue";

export function CartProvider({ children }) {
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);
  const [busyIds, setBusyIds] = useState([]);
  const pending = useRef(new Set());
  const queue = useRef(Promise.resolve());
  const revision = useRef(0);

  const refreshCart = useCallback(async () => {
    const requestRevision = ++revision.current;
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/cart");
      if (requestRevision === revision.current) {
        setCartItems(response.data.cart);
        setNeedsLogin(false);
      }
    } catch (requestError) {
      if (requestRevision === revision.current) {
        setCartItems([]);
        const guest = requestError.response?.status === 401;
        setNeedsLogin(guest);
        if (!guest) setError(requestError.response?.data?.message || "Unable to load your cart. Please try again.");
      }
    } finally {
      if (requestRevision === revision.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(refreshCart, 0);
    return () => clearTimeout(timer);
  }, [refreshCart]);

  const clearCart = useCallback(() => {
    revision.current += 1;
    setCartItems([]);
    setNeedsLogin(true);
    setError("");
    setLoading(false);
  }, []);

  const completeOrder = useCallback(() => {
    revision.current += 1;
    setCartItems([]);
    setNeedsLogin(false);
    setError("");
    setLoading(false);
  }, []);

  const mutate = (productId, request) => {
    if (pending.current.has(productId)) return Promise.reject(new Error("Please wait for this item to finish updating."));
    pending.current.add(productId);
    setBusyIds((ids) => [...ids, productId]);
    const run = queue.current.catch(() => {}).then(async () => {
      try {
        const response = await request();
        revision.current += 1;
        setCartItems(response.data.cart);
        setNeedsLogin(false);
        setError("");
        setLoading(false);
        return response.data.cart;
      } catch (requestError) {
        if (requestError.response?.status === 401) clearCart();
        throw new Error(requestError.response?.data?.message || "Unable to update your cart. Please try again.");
      } finally {
        pending.current.delete(productId);
        setBusyIds((ids) => ids.filter((id) => id !== productId));
      }
    });
    queue.current = run.catch(() => {});
    return run;
  };

  const addToCart = (productId) => mutate(productId, () => api.post(`/cart/${productId}`));
  const updateQuantity = (productId, quantity) => mutate(productId, () => api.patch(`/cart/${productId}`, { quantity }));
  const removeFromCart = (productId) => mutate(productId, () => api.delete(`/cart/${productId}`));

  const totalUnits = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cartItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const value = {
    cartItems, loading, error, needsLogin, busyIds, totalUnits, subtotal,
    refreshCart, clearCart, completeOrder, addToCart, updateQuantity, removeFromCart
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
