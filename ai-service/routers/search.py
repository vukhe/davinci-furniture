"""
routers/search.py
Semantic Search (Dense) + Hybrid Search (Dense + BM25 + RRF)
"""
from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel

from dl.embedder import embed_text
from models.query_processor import normalize_query, expand_query
from ir.dense import (
    query_text,
    get_product_text_embedding,
    count_products,
    list_indexed_products,
)

router = APIRouter(prefix="/search", tags=["Search"])


class SearchResult(BaseModel):
    product_id: str
    name: str
    price: float
    sale_price: float | None
    category: str
    material: str | None
    image_url: str
    semantic_score: float
    business_score: float
    avg_rating: float | None
    sold: int | None


class SearchResponse(BaseModel):
    query: str
    normalized_query: str
    results: list[SearchResult]
    total: int
    filters_applied: dict


def rerank(items, sw=0.65, rw=0.15, soldw=0.12, dw=0.08):
    for item in items:
        sem  = item.get("semantic_score", 0.0)
        rat  = min(float(item.get("avg_rating") or 0) / 5.0, 1.0)
        sold = min(float(item.get("sold") or 0) / 500.0, 1.0)
        disc = 1.0 if item.get("sale_price") else 0.0
        item["business_score"] = round(sw*sem + rw*rat + soldw*sold + dw*disc, 4)
    return sorted(items, key=lambda x: x["business_score"], reverse=True)


def _parse_result(pid, meta, dist):
    return {
        "product_id":     pid,
        "name":           meta.get("name", ""),
        "price":          float(meta.get("price", 0) or 0),
        "sale_price":     float(meta["sale_price"]) if meta.get("sale_price") else None,
        "category":       meta.get("category", meta.get("category_name", "")),
        "material":       meta.get("material") or None,
        "image_url":      meta.get("image_url", ""),
        "semantic_score": round(1 - dist, 4),
        "business_score": 0.0,
        "avg_rating":     float(meta["avg_rating"]) if meta.get("avg_rating") else None,
        "sold":           int(meta["sold"]) if meta.get("sold") else None,
    }


def _build_where(category, material, price_min, price_max):
    conditions = []
    if category:  conditions.append({"category": {"$eq": category}})
    if material:  conditions.append({"material": {"$eq": material}})
    if price_min is not None: conditions.append({"price": {"$gte": price_min}})
    if price_max is not None: conditions.append({"price": {"$lte": price_max}})
    if not conditions: return None
    return {"$and": conditions} if len(conditions) > 1 else conditions[0]


@router.get("/semantic", response_model=SearchResponse)
async def semantic_search(
    q: str = Query(..., min_length=1),
    limit: int = Query(12, ge=1, le=50),
    category: str = Query(None),
    material: str = Query(None),
    price_min: float = Query(None),
    price_max: float = Query(None),
):
    """IR #1 — Dense Retrieval: Sentence-Transformers + ChromaDB HNSW + re-ranking."""
    if count_products() == 0:
        return SearchResponse(query=q, normalized_query=q, results=[], total=0,
            filters_applied={"error": "Vector index empty. Run: python scripts/index_products.py"})

    normalized = normalize_query(q)
    expanded   = expand_query(normalized)
    embedding  = embed_text(expanded)
    where      = _build_where(category, material, price_min, price_max)
    raw        = query_text(embedding, n_results=min(limit * 3, 60), where=where)

    candidates = [_parse_result(pid, meta, dist) for pid, meta, dist in zip(
        raw.get("ids", [[]])[0],
        raw.get("metadatas", [[]])[0],
        raw.get("distances", [[]])[0],
    )]
    reranked = rerank(candidates)[:limit]

    return SearchResponse(
        query=q, normalized_query=normalized,
        results=[SearchResult(**r) for r in reranked],
        total=len(reranked),
        filters_applied={"mode": "dense_retrieval", "category": category,
                         "material": material, "price_min": price_min, "price_max": price_max},
    )


@router.get("/hybrid", response_model=SearchResponse)
async def hybrid_search_endpoint(
    q: str = Query(..., min_length=1),
    limit: int = Query(12, ge=1, le=50),
    dense_weight: float = Query(0.6, ge=0.0, le=1.0),
    sparse_weight: float = Query(0.4, ge=0.0, le=1.0),
):
    """IR #1 + IR #2 + IR #3 — Dense + BM25 + Reciprocal Rank Fusion."""
    from ir.bm25 import get_bm25_retriever
    from ir.hybrid import reciprocal_rank_fusion

    normalized = normalize_query(q)
    expanded   = expand_query(normalized)

    dense_candidates = []
    if count_products() > 0:
        raw = query_text(embed_text(expanded), n_results=limit * 2)
        for pid, meta, dist in zip(raw.get("ids",[[]])[0], raw.get("metadatas",[[]])[0], raw.get("distances",[[]])[0]):
            dense_candidates.append(_parse_result(pid, meta, dist))

    bm25_results = get_bm25_retriever().search(normalized, n=limit * 2)

    merged = reciprocal_rank_fusion(dense_candidates, bm25_results, k=60,
                                    dense_weight=dense_weight, sparse_weight=sparse_weight)[:limit]

    results = [SearchResult(
        product_id=str(i.get("product_id","")), name=i.get("name",""),
        price=float(i.get("price",0) or 0), sale_price=i.get("sale_price"),
        category=i.get("category",""), material=i.get("material"),
        image_url=i.get("image_url",""),
        semantic_score=i.get("semantic_score", i.get("rrf_score",0.0)),
        business_score=i.get("rrf_score",0.0),
        avg_rating=i.get("avg_rating"), sold=i.get("sold"),
    ) for i in merged]

    return SearchResponse(query=q, normalized_query=normalized, results=results, total=len(results),
        filters_applied={"mode":"hybrid_rrf","dense_weight":dense_weight,"sparse_weight":sparse_weight,
                         "dense_n":len(dense_candidates),"bm25_n":len(bm25_results)})


@router.get("/similar/{product_id}", response_model=SearchResponse)
async def similar_products(product_id: str, limit: int = Query(8, ge=1, le=20)):
    """Tìm sản phẩm tương tự dùng Dense Retrieval trên vector của sản phẩm."""
    embedding, meta = get_product_text_embedding(product_id)
    if embedding is None:
        raise HTTPException(status_code=404, detail=f"Product {product_id} not found in index")

    raw     = query_text(embedding, n_results=limit + 1)
    results = []
    for pid, m, dist in zip(raw.get("ids",[[]])[0], raw.get("metadatas",[[]])[0], raw.get("distances",[[]])[0]):
        if pid == product_id: continue
        r = _parse_result(pid, m, dist)
        r["business_score"] = r["semantic_score"]
        results.append(SearchResult(**r))
        if len(results) >= limit: break

    return SearchResponse(query=product_id, normalized_query=product_id,
        results=results, total=len(results), filters_applied={"mode":"similar_dense"})


@router.get("/autocomplete")
async def autocomplete(q: str = Query(..., min_length=1), limit: int = Query(5, ge=1, le=10)):
    """Autocomplete gợi ý tên sản phẩm."""
    if count_products() == 0:
        return {"suggestions": []}
    normalized = normalize_query(q)
    raw = query_text(embed_text(normalized), n_results=limit * 2)
    seen, suggestions = set(), []
    for pid, meta, dist in zip(raw.get("ids",[[]])[0], raw.get("metadatas",[[]])[0], raw.get("distances",[[]])[0]):
        name = meta.get("name","")
        if name and name not in seen and (1-dist) > 0.3:
            seen.add(name)
            suggestions.append({"product_id": pid, "name": name, "score": round(1-dist, 3)})
        if len(suggestions) >= limit: break
    return {"query": q, "suggestions": suggestions}


@router.get("/indexed-products")
async def indexed_products(limit: int = Query(20, ge=1, le=100), offset: int = Query(0, ge=0)):
    """Xem sản phẩm đã được index trong vector store."""
    raw   = list_indexed_products(limit=limit, offset=offset)
    ids   = raw.get("ids", [])
    metas = raw.get("metadatas", [])
    docs  = raw.get("documents", [])
    products = [{"product_id": pid, "name": (meta or {}).get("name",""),
                 "category": (meta or {}).get("category",""), "document": (doc or "")[:100]}
                for pid, meta, doc in zip(ids, metas, docs)]
    return {"status":"ready" if count_products()>0 else "empty",
            "total":count_products(), "limit":limit, "offset":offset, "products":products}
