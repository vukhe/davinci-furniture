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
"""

import os
import re
from typing import Optional

import httpx
from rank_bm25 import BM25Okapi

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:5000")


# ── Tokenizer ──────────────────────────────────────────────────────────────────

def _tokenize(text: str) -> list[str]:
    """Lowercase + tách từ tiếng Việt/Anh. Giữ recall cao, không remove stopwords."""
    text = text.lower().strip()
    text = re.sub(r"[^\w\s]", " ", text, flags=re.UNICODE)
    text = re.sub(r"\s+", " ", text)
    return text.split()


def _product_to_doc(product: dict) -> str:
    """Ghép các field metadata thành document text để index."""
    parts = [
        product.get("name", ""),
        product.get("name", ""),          # lặp 2x để tăng trọng số tên
        product.get("category_name", ""),
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

    k1=1.5: TF saturation — giá trị cao hơn TF ảnh hưởng nhiều hơn.
    b=0.75:  Document length normalization.
    """

    def __init__(self, k1: float = 1.5, b: float = 0.75):
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
        corpus = [_tokenize(_product_to_doc(p)) for p in products]
        corpus = [doc if doc else ["[empty]"] for doc in corpus]

        self.bm25     = BM25Okapi(corpus, k1=self.k1, b=self.b)
        self.is_ready = True
        print(f"[BM25] Index built: {len(products)} products, vocab={len(self.bm25.idf)} terms")

    async def build_from_backend(self, limit: int = 2000):
        """Fetch từ backend rồi build index. Gọi trong lifespan startup."""
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(
                    f"{BACKEND_URL}/api/products",
                    params={"limit": limit, "page": 1},
                )
                resp.raise_for_status()
                data = resp.json()

            products = (
                data if isinstance(data, list)
                else data.get("products", data.get("data", []))
            )
            if not products:
                print("[BM25][WARN] Backend trả về 0 sản phẩm.")
                return
            self.build_index(products)

        except Exception as exc:
            print(f"[BM25][WARN] Không thể fetch products: {exc}")

    # ── Search ─────────────────────────────────────────────────────────────────

    def search(self, query: str, n: int = 20) -> list[dict]:
        """
        BM25 search. Trả về top-n products kèm bm25_score.
        Score > 0 mới được trả về.
        """
        if not self.is_ready or self.bm25 is None:
            return []

        tokens = _tokenize(query)
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
                "price":      float(meta.get("price", 0) or 0),
                "sale_price": float(meta["sale_price"]) if meta.get("sale_price") else None,
                "category":   meta.get("category_name", meta.get("category", "")),
                "material":   meta.get("material") or None,
                "image_url":  meta.get("image_url", ""),
                "avg_rating": float(meta["avg_rating"]) if meta.get("avg_rating") else None,
                "sold":       int(meta["sold"]) if meta.get("sold") else None,
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
