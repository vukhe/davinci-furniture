"""
ir/dense.py — IR #1: Dense Retrieval
======================================
ChromaDB + HNSW (Hierarchical Navigable Small World) index.

Kỹ thuật: Approximate Nearest Neighbor search trên dense vector space.
- Text collection:  Sentence-Transformers embeddings (semantic search)
- Image collection: CLIP embeddings (image search)
"""
import os
from pathlib import Path
import chromadb
from chromadb.config import Settings
from dotenv import load_dotenv

SERVICE_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(SERVICE_ROOT / ".env")

_configured_chroma_path = Path(os.getenv("CHROMA_PATH", "./data/chroma_db"))
CHROMA_PATH = str(
    _configured_chroma_path
    if _configured_chroma_path.is_absolute()
    else SERVICE_ROOT / _configured_chroma_path
)

# Singleton client
_client = None


def get_client() -> chromadb.ClientAPI:
    global _client
    if _client is None:
        _client = chromadb.PersistentClient(
            path=CHROMA_PATH,
            settings=Settings(anonymized_telemetry=False),
        )
    return _client


# ── Collections ──────────────────────────────────────────────────────────────

def get_product_text_collection():
    """Collection cho semantic search (text embeddings)."""
    return get_client().get_or_create_collection(
        name="product_text",
        metadata={"hnsw:space": "cosine"},
    )


def get_product_image_collection():
    """Collection cho image search (CLIP embeddings)."""
    return get_client().get_or_create_collection(
        name="product_image",
        metadata={"hnsw:space": "cosine"},
    )


# ── Helpers ───────────────────────────────────────────────────────────────────

def upsert_products_text(ids: list[str], embeddings: list, metadatas: list, documents: list):
    col = get_product_text_collection()
    col.upsert(ids=ids, embeddings=embeddings, metadatas=metadatas, documents=documents)


def upsert_products_image(ids: list[str], embeddings: list, metadatas: list):
    col = get_product_image_collection()
    col.upsert(ids=ids, embeddings=embeddings, metadatas=metadatas)


def query_text(embedding: list, n_results: int = 10, where: dict = None):
    col = get_product_text_collection()
    kwargs = dict(query_embeddings=[embedding], n_results=n_results, include=["metadatas", "distances", "documents"])
    if where:
        kwargs["where"] = where
    return col.query(**kwargs)


def query_image(embedding: list, n_results: int = 10):
    col = get_product_image_collection()
    return col.query(
        query_embeddings=[embedding],
        n_results=n_results,
        include=["metadatas", "distances"],
    )


def get_product_text_embedding(product_id: str):
    """Lấy embedding của 1 sản phẩm theo id (dùng cho similar products)."""
    col = get_product_text_collection()
    result = col.get(ids=[product_id], include=["embeddings", "metadatas"])
    if result["ids"]:
        return result["embeddings"][0], result["metadatas"][0]
    return None, None


def count_products():
    return get_product_text_collection().count()


def count_image_products():
    return get_product_image_collection().count()


def list_indexed_products(limit: int = 20, offset: int = 0):
    col = get_product_text_collection()
    return col.get(
        limit=limit,
        offset=offset,
        include=["metadatas", "documents"],
    )
