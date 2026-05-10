"""
ir/ — Information Retrieval
============================
IR #1  dense.py    Dense Retrieval — ChromaDB HNSW (cosine ANN search)
IR #2  bm25.py     Sparse Retrieval — BM25 Okapi (keyword-based)
IR #3  hybrid.py   Hybrid Retrieval — Reciprocal Rank Fusion
"""
from .dense  import (
    query_text, query_image,
    upsert_products_text, upsert_products_image,
    get_product_text_embedding,
    count_products, count_image_products,
    list_indexed_products,
)
from .bm25   import BM25Retriever, get_bm25_retriever
from .hybrid import reciprocal_rank_fusion

__all__ = [
    # IR #1 — Dense
    "query_text", "query_image",
    "upsert_products_text", "upsert_products_image",
    "get_product_text_embedding",
    "count_products", "count_image_products",
    "list_indexed_products",
    # IR #2 — BM25
    "BM25Retriever", "get_bm25_retriever",
    # IR #3 — RRF
    "reciprocal_rank_fusion",
]
