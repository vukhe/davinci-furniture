/**
 * frontend/src/components/ai/SemanticSearchBar.jsx
 * Thanh tìm kiếm ngữ nghĩa – thay thế/bổ sung cho search box hiện tại
 * Tích hợp vào Header.jsx hoặc ProductsPage.jsx
 */
import { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useDebounce } from "../../hooks/useDebounce";

const BACKEND = (import.meta.env.VITE_BACKEND_URL || "").replace(/\/$/, "");

export default function SemanticSearchBar({ onResults, className = "", initialQuery = "" }) {
  const [query, setQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debouncedQuery = useDebounce(query, 400);
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    setQuery(initialQuery || "");
  }, [initialQuery]);

  // Close dropdown khi click bên ngoài
  useEffect(() => {
    const handler = (e) => {
      if (!dropdownRef.current?.contains(e.target) && !inputRef.current?.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Auto-suggest khi gõ
  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    fetchSuggestions(debouncedQuery);
  }, [debouncedQuery]);

  const fetchSuggestions = async (q) => {
    try {
      setLoading(true);
      const res = await fetch(
        `${BACKEND}/api/ai-proxy/search/autocomplete?q=${encodeURIComponent(q)}`
      );
      const data = await res.json();
      setSuggestions(data.suggestions || []);
      setOpen((data.suggestions || []).length > 0);
    } catch {
      setSuggestions([]);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = useCallback(async (q = query) => {
    const normalizedQuery = q.trim();
    if (!normalizedQuery) return;
    setOpen(false);

    try {
      setLoading(true);
      const res = await fetch(
        `${BACKEND}/api/ai-proxy/search?q=${encodeURIComponent(normalizedQuery)}&limit=20`
      );
      const data = await res.json();

      if (onResults) {
        onResults(data.results || [], normalizedQuery);
      } else {
        navigate(`/products?semantic=${encodeURIComponent(normalizedQuery)}`);
      }
    } catch (err) {
      console.error("Semantic search error:", err);
    } finally {
      setLoading(false);
    }
  }, [query, onResults, navigate]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSearch();
    if (e.key === "Escape") setOpen(false);
  };

  const handleSuggestionClick = (product) => {
    navigate(`/products/${product.product_id}`);
    setOpen(false);
    setQuery("");
  };

  return (
    <div className={`relative w-full ${className}`}>
      {/* Input */}
      <div className="flex items-center gap-2 border border-stone-300 rounded-lg bg-white px-3 py-2 focus-within:border-davinci-gold focus-within:ring-1 focus-within:ring-davinci-gold transition-all">
        {/* AI badge */}
        <span className="text-[10px] font-semibold text-davinci-gold bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 shrink-0">
          AI
        </span>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder="Tìm kiếm thông minh... VD: ghế gỗ phong cách Bắc Âu"
          className="flex-1 outline-none text-sm text-stone-700 placeholder:text-stone-400 bg-transparent"
        />

        {loading && (
          <svg className="animate-spin h-4 w-4 text-davinci-gold shrink-0" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
        )}

        <button
          onClick={() => handleSearch()}
          className="shrink-0 bg-davinci-gold text-white rounded-md px-3 py-1 text-sm font-medium hover:bg-amber-700 transition-colors"
        >
          Tìm
        </button>
      </div>

      {/* Suggestions dropdown */}
      {open && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute top-full mt-1 left-0 right-0 bg-white border border-stone-200 rounded-lg shadow-lg z-50 overflow-hidden"
        >
          <p className="text-[11px] text-stone-400 px-3 pt-2 pb-1">Gợi ý từ AI</p>
          {suggestions.map((product) => (
            <button
              key={product.product_id}
              onClick={() => handleSuggestionClick(product)}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-amber-50 transition-colors text-left"
            >
              {product.image_url && (
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="w-10 h-10 object-cover rounded shrink-0 bg-stone-100"
                  onError={(e) => (e.target.style.display = "none")}
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-stone-800 truncate">{product.name}</p>
                <p className="text-xs text-stone-400">{product.category}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-medium text-davinci-gold">
                  {new Intl.NumberFormat("vi-VN").format(product.price)}₫
                </p>
                {product.score ? (
                  <p className="text-[10px] text-stone-300">
                    {Math.round(product.score * 100)}% phù hợp
                  </p>
                ) : null}
              </div>
            </button>
          ))}
          <div className="border-t border-stone-100 px-3 py-2">
            <button
              onClick={() => handleSearch()}
              className="text-xs text-davinci-gold hover:underline"
            >
              Xem tất cả kết quả cho "{query.trim()}" →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
