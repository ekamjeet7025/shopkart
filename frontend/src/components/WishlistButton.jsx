import { useRef, useState } from "react";
import { Link } from "react-router-dom";

function WishlistButton({ product, saved, onToggle, loading = false, needsLogin = false, removeOnly = false }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [justSaved, setJustSaved] = useState(false);
  const requestInProgress = useRef(false);

  const handleClick = async () => {
    if (requestInProgress.current) return;
    requestInProgress.current = true;
    setBusy(true);
    setError("");
    try {
      await onToggle(product);
      setJustSaved(!saved);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      requestInProgress.current = false;
      setBusy(false);
    }
  };

  const text = loading ? "Checking wishlist..." : busy ? (saved ? "Removing..." : "Saving...")
    : removeOnly ? "Remove from Wishlist" : saved ? (justSaved ? "Added to Wishlist · Remove" : "Remove from Wishlist") : "Add to Wishlist";

  return (
    <div className="wishlist-action">
      <button type="button" className={`wishlist-button ${saved ? "saved" : ""}`} disabled={loading || busy} onClick={handleClick} aria-pressed={saved}>
        <span aria-hidden="true">{saved ? "♥" : "♡"}</span> {text}
      </button>
      {error && <p className="wishlist-action-error" role="alert">{error} {needsLogin && <Link to="/login">Sign in →</Link>}</p>}
    </div>
  );
}

export default WishlistButton;
