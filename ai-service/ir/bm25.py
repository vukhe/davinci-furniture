"""
ir/bm25.py — IR #2: Sparse Retrieval
=======================================
BM25 (Best Match 25) — cải tiến của TF-IDF:
  - TF saturation theo k1 parameter (tránh spam từ khóa)
  - Document length normalization theo b parameter
  - Không cần train, không cần GPU, deterministic

Vai trò: bắt exact keyword match (tên sản phẩm, thương hiệu, mã)
mà Dense Retrieval (semantic) có thể bỏ qua.
Kết hợp với Dense qua Hybrid RRF (ir/hybrid.py).

FIX LOG (v2):
  - [②] Thêm Vietnamese fashion synonym expansion trong query
  - [③] Thêm stopword removal tiếng Việt
  - [④] Thêm bigrams để capture compound terms (áo sơ mi → ao_so, so_mi)
  - [⑤] Tăng limit fetch từ 2000 → 5000
  - [⑥] Tune k1=1.2, b=0.5 phù hợp corpus tên sản phẩm ngắn
"""

import os
import re
import unicodedata
import math
from typing import Optional

import httpx
from rank_bm25 import BM25Okapi

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:5000")


def _safe_float(value, default=0.0):
    try:
        num = float(value)
        return num if math.isfinite(num) else default
    except (TypeError, ValueError):
        return default


def _safe_optional_float(value):
    if value in (None, ""):
        return None
    return _safe_float(value, None)


def _safe_optional_int(value):
    try:
        return int(value) if value not in (None, "") else None
    except (TypeError, ValueError):
        return None


# ── Stopwords tiếng Việt ── FIX ③ ─────────────────────────────────────────────
# Lọc các từ không mang nghĩa → IDF của từ quan trọng tăng lên

_STOPWORDS = {
    "va", "cua", "cho", "voi", "cac", "nhung", "la", "co", "duoc",
    "trong", "ngoai", "tren", "duoi", "nay", "do", "kia", "mot",
    "de", "tu", "tai", "boi", "ve", "theo", "hay", "hoac", "nhu",
    "rat", "cung", "da", "se", "dang", "van", "ma", "thi", "nen",
    "bi", "lai", "ra", "vao", "len", "xuong", "di", "den", "qua",
    "the", "a", "an", "and", "or", "of", "for", "in", "on", "at",
    "to", "by", "is", "are", "was", "with",
}


# ── Synonym map — Fashion tiếng Việt ── FIX ② ────────────────────────────────
# Key = normalized (bỏ dấu, lowercase), value = list synonyms normalized
# Chỉ apply khi tokenize QUERY, không apply khi build index corpus

_SYNONYM_MAP: dict[str, list[str]] = {
    # Áo
    "ao phong":      ["ao thun", "tshirt"],
    "ao thun":       ["ao phong", "tshirt"],
    "tshirt":        ["ao thun", "ao phong"],
    "ao so mi":      ["so mi", "shirt"],
    "so mi":         ["ao so mi", "shirt"],
    "ao khoac":      ["jacket", "blazer"],
    "jacket":        ["ao khoac"],
    "blazer":        ["ao khoac", "vest"],
    "ao len":        ["sweater", "pullover", "ao ni"],
    "sweater":       ["ao len", "ao ni"],
    "hoodie":        ["ao mu", "sweatshirt"],
    "ao mu":         ["hoodie", "sweatshirt"],
    "ao ba lo":      ["tank top", "singlet"],
    "tank top":      ["ao ba lo"],
    # Quần
    "quan jean":     ["quan bo", "jeans", "denim"],
    "quan bo":       ["quan jean", "jeans"],
    "jeans":         ["quan jean", "quan bo", "denim"],
    "quan short":    ["quan ngan", "short"],
    "quan ngan":     ["quan short", "short"],
    "quan the thao": ["jogger", "trackpants"],
    "jogger":        ["quan the thao"],
    "legging":       ["quan om", "tights"],
    # Giày
    "giay the thao": ["sneaker", "sport shoes"],
    "sneaker":       ["giay the thao"],
    "giay cao got":  ["high heels", "heel"],
    "dep":           ["sandal", "flip flop"],
    "sandal":        ["dep"],
    "giay luoi":     ["loafer", "slip on"],
    # Phụ kiện
    "tui xach":      ["bag", "handbag"],
    "ba lo":         ["backpack", "balo"],
    "backpack":      ["ba lo", "balo"],
    "mu":            ["hat", "cap", "non"],
    "non":           ["mu", "hat", "cap"],
    # Chất liệu
    "cotton":        ["vai bong", "chat bong"],
    "len":           ["wool", "cashmere"],
    "lua":           ["silk", "satin"],
    "da":            ["leather"],
    # Màu (normalized, bỏ dấu)
    "den":           ["black"],
    "trang":         ["white"],
    "do":            ["red"],
    "xanh duong":    ["blue", "navy"],
    "xanh la":       ["green", "olive"],
    "vang":          ["yellow"],
    "hong":          ["pink"],
    "xam":           ["grey", "gray"],
    "nau":           ["brown"],
    "tim":           ["purple", "violet"],
    # Style / occasion
    "the thao":      ["sport", "athletic"],
    "cong so":       ["office", "formal", "business"],
    "ca tinh":       ["casual", "street", "streetwear"],
    "thanh lich":    ["elegant", "classic"],
    "di bien":       ["beach", "resort"],
}


def _expand_synonyms(tokens: list[str]) -> list[str]:
    """
    Mở rộng tokens với synonyms. Thử match unigram và bigram.
    Chỉ gọi khi tokenize QUERY, không gọi khi build corpus.
    """
    extra: list[str] = []
    seen = set(tokens)
    n = len(tokens)

    for i in range(n):
        # Unigram
        key = tokens[i]
        if key in _SYNONYM_MAP:
            for syn in _SYNONYM_MAP[key]:
                for t in syn.split():
                    if t not in seen:
                        extra.append(t)
                        seen.add(t)
        # Bigram
        if i < n - 1:
            bigram_key = f"{tokens[i]} {tokens[i+1]}"
            if bigram_key in _SYNONYM_MAP:
                for syn in _SYNONYM_MAP[bigram_key]:
                    for t in syn.split():
                        if t not in seen:
                            extra.append(t)
                            seen.add(t)

    return tokens + extra


# ── Tokenizer ──────────────────────────────────────────────────────────────────

def _normalize_text(text: str) -> str:
    """Lowercase, bỏ dấu tiếng Việt, giữ chữ/số để BM25 match ổn định."""
    text = unicodedata.normalize("NFD", str(text or ""))
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    text = text.replace("đ", "d").replace("Đ", "D")
    return text.lower().strip()


def _make_bigrams(tokens: list[str]) -> list[str]:
    """
    FIX ④: Thêm bigrams để capture compound terms.
    ['ao', 'so', 'mi'] → thêm ['ao_so', 'so_mi']
    Giữ recall từ unigrams, tăng precision từ bigrams.
    """
    return [f"{tokens[i]}_{tokens[i+1]}" for i in range(len(tokens) - 1)]


def _base_tokenize(text: str) -> list[str]:
    """Bước tokenize cơ bản: normalize → split → remove stopwords → bigrams."""
    text = _normalize_text(text)
    text = re.sub(r"[^\w\s]", " ", text, flags=re.UNICODE)
    text = re.sub(r"\s+", " ", text)
    tokens = [t for t in text.split() if t not in _STOPWORDS]  # FIX ③
    if not tokens:
        return tokens
    bigrams = _make_bigrams(tokens)                              # FIX ④
    return tokens + bigrams


def _tokenize_document(text: str) -> list[str]:
    """Tokenize document khi BUILD INDEX — không expand synonyms để tránh bloat."""
    return _base_tokenize(text)


def _tokenize_query(text: str) -> list[str]:
    """Tokenize query khi SEARCH — thêm synonym expansion để tăng recall."""
    tokens = _base_tokenize(text)
    return _expand_synonyms(tokens)  # FIX ②


# (giữ lại _tokenize cho backward compatibility nếu nơi khác import)
def _tokenize(text: str) -> list[str]:
    return _base_tokenize(text)


def _product_to_doc(product: dict) -> str:
    """Ghép các field metadata thành document text để index.
    name ×3 > category > description > collection > material > brand > color > style.
    """
    desc_raw = product.get("description", "") or ""
    desc = desc_raw[:300].strip()

    parts = [
        product.get("name", ""),
        product.get("name", ""),
        product.get("name", ""),
        product.get("category_name", ""),
        desc,
        product.get("collection_name", ""),
        product.get("material", ""),
        product.get("brand", ""),
        product.get("color", ""),
        product.get("style", ""),
    ]
    return " ".join(p for p in parts if p)


# ── BM25Retriever ──────────────────────────────────────────────────────────────

class BM25Retriever:
    """
    BM25 index trên toàn bộ catalog sản phẩm.

    FIX ⑥ — Tune parameters cho corpus fashion tiếng Việt ngắn:
      k1=1.2 (gốc 1.5): TF saturation nhẹ hơn — phù hợp doc ngắn
      b=0.5  (gốc 0.75): Length norm nhẹ hơn — tên sp đều ngắn tương đương
    """

    def __init__(self, k1: float = 1.2, b: float = 0.5):  # FIX ⑥
        self.k1 = k1
        self.b  = b
        self.bm25: Optional[BM25Okapi] = None
        self.product_ids: list[str]    = []
        self.metadatas:   list[dict]   = []
        self.is_ready = False

    # ── Build ──────────────────────────────────────────────────────────────────

    def build_index(self, products: list[dict]):
        """Build BM25 index từ danh sách products."""
        if not products:
            print("[BM25] Empty product list, index not built.")
            return

        self.product_ids = [
            str(p.get("product_id") or p.get("id") or i)
            for i, p in enumerate(products)
        ]
        self.metadatas = products
        corpus = [_tokenize_document(_product_to_doc(p)) for p in products]
        corpus = [doc if doc else ["[empty]"] for doc in corpus]

        self.bm25     = BM25Okapi(corpus, k1=self.k1, b=self.b)
        self.is_ready = True
        print(f"[BM25] Index built: {len(products)} products, vocab={len(self.bm25.idf)} terms, k1={self.k1}, b={self.b}")

    async def build_from_backend(self, limit: int = 5000):  # FIX ⑤: 2000 → 5000
        """Fetch từ backend rồi build index. Gọi trong lifespan startup."""
        try:
            products = []
            page = 1
            per_page = min(limit, 48)
            async with httpx.AsyncClient(timeout=15) as client:
                while len(products) < limit:
                    resp = await client.get(
                        f"{BACKEND_URL}/api/products",
                        params={"limit": per_page, "page": page},
                    )
                    resp.raise_for_status()
                    data = resp.json()

                    if isinstance(data, list):
                        products.extend(data)
                        break

                    page_products = data.get("products", data.get("data", data.get("items", [])))
                    if not page_products:
                        break
                    products.extend(page_products)

                    pagination = data.get("pagination", {})
                    total_pages = pagination.get("pages", 1)
                    if page >= total_pages:
                        break
                    page += 1

            products = products[:limit]
            if not products:
                print("[BM25][WARN] Backend trả về 0 sản phẩm.")
                return
            self.build_index(products)

        except Exception as exc:
            print(f"[BM25][WARN] Không thể fetch products: {exc}")

    # ── Search ─────────────────────────────────────────────────────────────────

    def search(self, query: str, n: int = 20) -> list[dict]:
        """
        BM25 search với synonym expansion trên query.
        Trả về top-n products kèm bm25_score (score > 0).
        """
        if not self.is_ready or self.bm25 is None:
            return []

        tokens = _tokenize_query(query)  # FIX ②: dùng query tokenizer có expansion
        if not tokens:
            return []

        scores  = self.bm25.get_scores(tokens)
        indices = scores.argsort()[::-1][:n]

        results = []
        for idx in indices:
            score = float(scores[idx])
            if score <= 0:
                break
            meta = self.metadatas[idx]
            results.append({
                "product_id": self.product_ids[idx],
                "bm25_score": round(score, 4),
                "name":       meta.get("name", ""),
                "price":      _safe_float(meta.get("price"), 0.0),
                "sale_price": _safe_optional_float(meta.get("sale_price")),
                "category":   meta.get("category_name", meta.get("category", "")),
                "material":   meta.get("material") or None,
                "image_url":  meta.get("image_url", ""),
                "avg_rating": _safe_optional_float(meta.get("avg_rating")),
                "sold":       _safe_optional_int(meta.get("sold")),
            })
        return results

    def stats(self) -> dict:
        return {
            "is_ready":   self.is_ready,
            "n_products": len(self.product_ids),
            "vocab_size": len(self.bm25.idf) if self.bm25 else 0,
            "k1": self.k1,
            "b":  self.b,
        }


# ── Singleton ──────────────────────────────────────────────────────────────────

_bm25: Optional[BM25Retriever] = None


def get_bm25_retriever() -> BM25Retriever:
    global _bm25
    if _bm25 is None:
        _bm25 = BM25Retriever()
    return _bm25