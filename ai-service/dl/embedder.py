"""
dl/embedder.py — DL #1: Sentence-Transformers
================================================
Model: paraphrase-multilingual-MiniLM-L12-v2
  - Hỗ trợ tiếng Việt + tiếng Anh (multilingual)
  - 384-dim embeddings, nhẹ (~120MB), tốc độ tốt
  - Normalize L2 để cosine similarity = dot product
"""
import os
from sentence_transformers import SentenceTransformer
from dotenv import load_dotenv

load_dotenv()

MODEL_NAME = os.getenv(
    "EMBEDDING_MODEL",
    "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
)

_model: SentenceTransformer | None = None


def get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        print(f"[Embedder] Loading: {MODEL_NAME}")
        _model = SentenceTransformer(MODEL_NAME)
        print("[Embedder] Model loaded OK")
    return _model


def embed_text(text: str) -> list[float]:
    return get_model().encode(text, normalize_embeddings=True).tolist()


def embed_batch(texts: list[str], batch_size: int = 32) -> list[list[float]]:
    return get_model().encode(
        texts,
        normalize_embeddings=True,
        batch_size=batch_size,
        show_progress_bar=len(texts) > 50,
    ).tolist()


def embed_batch_safe(texts: list[str], batch_size: int = 32) -> list[list[float] | None]:
    """Embed batch, trả về None cho item nào lỗi (không crash cả batch)."""
    try:
        return embed_batch(texts, batch_size)
    except Exception as exc:
        print(f"[Embedder][WARN] Batch failed ({exc}), fallback per-item")
        results = []
        for text in texts:
            try:
                results.append(embed_text(text))
            except Exception as e:
                print(f"[Embedder][WARN] Item failed: {e}")
                results.append(None)
        return results


def build_product_text(product: dict) -> str:
    """Ghép các field sản phẩm thành text để embed."""
    parts = [
        product.get("name", ""),
        product.get("category_name", ""),
        product.get("collection_name", ""),
        product.get("material", ""),
        product.get("color", ""),
        product.get("description", ""),
        product.get("style", ""),
    ]
    return " | ".join(p for p in parts if p)
