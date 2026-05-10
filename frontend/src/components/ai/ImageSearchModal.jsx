/**
 * frontend/src/components/ai/ImageSearchModal.jsx
 * Modal tìm kiếm bằng hình ảnh – drag & drop hoặc camera upload
 * Thêm nút trigger vào Header.jsx hoặc ProductsPage.jsx
 */
import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";

const AI_SERVICE_URL = import.meta.env.VITE_AI_SERVICE_URL || "http://localhost:8000";

export default function ImageSearchModal({ isOpen, onClose }) {
  const [preview, setPreview] = useState(null);
  const [file, setFile] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  const handleFile = (f) => {
    if (!f || !f.type.startsWith("image/")) {
      setError("Chỉ hỗ trợ file ảnh (JPG, PNG, WEBP)");
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setError("Ảnh không được vượt quá 10MB");
      return;
    }
    setError(null);
    setFile(f);
    setResults([]);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target.result);
    reader.readAsDataURL(f);
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    handleFile(dropped);
  }, []);

  const handleDragOver = (e) => { e.preventDefault(); setDragging(true); };
  const handleDragLeave = () => setDragging(false);

  const handleSearch = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${AI_SERVICE_URL}/api/ai/image-search/by-image?limit=8`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setResults(data.results || []);
    } catch (err) {
      setError("Tìm kiếm thất bại. Vui lòng thử lại.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleProductClick = (productId) => {
    navigate(`/products/${productId}`);
    handleClose();
  };

  const handleClose = () => {
    setPreview(null);
    setFile(null);
    setResults([]);
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-stone-100">
          <div>
            <h2 className="text-lg font-heading font-semibold text-stone-800">
              🔍 Tìm kiếm bằng hình ảnh
            </h2>
            <p className="text-xs text-stone-400 mt-0.5">
              Upload ảnh nội thất bạn thích – AI sẽ tìm sản phẩm tương tự
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-stone-400 hover:text-stone-600 transition-colors text-xl leading-none"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-xl transition-all cursor-pointer
              ${dragging ? "border-davinci-gold bg-amber-50" : "border-stone-200 hover:border-davinci-gold hover:bg-amber-50/40"}
              ${preview ? "p-2" : "p-10 text-center"}`}
          >
            {preview ? (
              <div className="relative">
                <img
                  src={preview}
                  alt="Preview"
                  className="w-full max-h-48 object-contain rounded-lg"
                />
                <button
                  onClick={(e) => { e.stopPropagation(); setPreview(null); setFile(null); setResults([]); }}
                  className="absolute top-2 right-2 bg-white/90 hover:bg-white text-stone-600 rounded-full w-7 h-7 flex items-center justify-center shadow text-sm"
                >
                  ✕
                </button>
              </div>
            ) : (
              <>
                <div className="text-4xl mb-3">📷</div>
                <p className="text-stone-600 font-medium">Kéo thả ảnh vào đây</p>
                <p className="text-stone-400 text-sm mt-1">hoặc click để chọn file</p>
                <p className="text-stone-300 text-xs mt-2">JPG, PNG, WEBP – tối đa 10MB</p>
              </>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFile(e.target.files[0])}
          />

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          {/* Search button */}
          {file && !results.length && (
            <button
              onClick={handleSearch}
              disabled={loading}
              className="w-full bg-davinci-gold text-white rounded-xl py-3 font-medium hover:bg-amber-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  AI đang phân tích ảnh...
                </>
              ) : (
                "🔍 Tìm sản phẩm tương tự"
              )}
            </button>
          )}

          {/* Results */}
          {results.length > 0 && (
            <div>
              <p className="text-sm font-medium text-stone-600 mb-3">
                Tìm thấy {results.length} sản phẩm tương tự
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {results.map((product) => (
                  <button
                    key={product.product_id}
                    onClick={() => handleProductClick(product.product_id)}
                    className="group text-left border border-stone-100 rounded-xl overflow-hidden hover:border-davinci-gold hover:shadow-md transition-all"
                  >
                    <div className="aspect-square bg-stone-50 overflow-hidden">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          onError={(e) => (e.target.src = "/placeholder.jpg")}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-stone-300 text-2xl">🛋️</div>
                      )}
                    </div>
                    <div className="p-2">
                      <p className="text-xs font-medium text-stone-700 line-clamp-2 leading-tight">{product.name}</p>
                      <p className="text-xs text-davinci-gold font-semibold mt-1">
                        {new Intl.NumberFormat("vi-VN").format(product.price)}₫
                      </p>
                      <div className="mt-1 bg-stone-100 rounded-full h-1 overflow-hidden">
                        <div
                          className="h-full bg-davinci-gold rounded-full"
                          style={{ width: `${Math.round(product.score * 100)}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-stone-400 mt-0.5">
                        {Math.round(product.score * 100)}% phù hợp
                      </p>
                    </div>
                  </button>
                ))}
              </div>

              <button
                onClick={() => { setResults([]); setPreview(null); setFile(null); }}
                className="mt-4 w-full text-sm text-stone-400 hover:text-stone-600 transition-colors"
              >
                ← Tìm kiếm lại
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}