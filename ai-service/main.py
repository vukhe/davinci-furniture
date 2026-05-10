"""
DaVinci AI Service — FastAPI entry point
"""
import warnings
warnings.filterwarnings("ignore", category=FutureWarning, module="timm")

import os
import time
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

load_dotenv(Path(__file__).resolve().parent / ".env")

from routers.forecast     import router as forecast_router
from routers.image_search import router as image_search_router
from routers.recommend    import router as recommend_router
from routers.search       import router as search_router

DEFAULT_ALLOWED_ORIGINS = ",".join([
    "http://localhost:3000", "http://localhost:4173",
    "http://localhost:5000", "http://localhost:5173",
    "http://127.0.0.1:3000", "http://127.0.0.1:4173",
    "http://127.0.0.1:5000", "http://127.0.0.1:5173",
])
ALLOWED_ORIGINS = [
    o.strip()
    for o in os.getenv("ALLOWED_ORIGINS", DEFAULT_ALLOWED_ORIGINS).split(",")
    if o.strip()
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("\n[Startup] DaVinci AI Service starting up...")

    # ── DL #1 — Sentence-Transformers ────────────────────────────────────────
    try:
        from dl.embedder import get_model
        get_model()
        print("[Startup] DL #1 Sentence-Transformers loaded")
    except Exception as exc:
        print(f"[Startup][WARN] DL #1 embedder: {exc}")

    # ── DL #3 — NCF ──────────────────────────────────────────────────────────
    try:
        from dl.ncf_model import get_ncf_recommender
        ncf = get_ncf_recommender()
        if ncf.is_trained:
            print(f"[Startup] DL #3 NCF loaded ({len(ncf.user_index)} users, {len(ncf.item_index)} items)")
        else:
            print("[Startup][WARN] DL #3 NCF not trained. Run: python scripts/train_recommender.py")
    except Exception as exc:
        print(f"[Startup][WARN] DL #3 NCF: {exc}")

    # ── IR #1 — Dense (ChromaDB) ──────────────────────────────────────────────
    try:
        from ir.dense import count_products, count_image_products
        n_text  = count_products()
        n_image = count_image_products()
        if n_text > 0:
            print(f"[Startup] IR #1 Dense index ready ({n_text} text, {n_image} image products)")
        else:
            print("[Startup][WARN] IR #1 Dense index empty. Run: python scripts/index_products.py")
    except Exception as exc:
        print(f"[Startup][WARN] IR #1 dense: {exc}")

    # ── IR #2 — BM25 ─────────────────────────────────────────────────────────
    try:
        from ir.bm25 import get_bm25_retriever
        bm25 = get_bm25_retriever()
        await bm25.build_from_backend()
        if bm25.is_ready:
            print(f"[Startup] IR #2 BM25 index ready ({bm25.stats()['n_products']} products)")
    except Exception as exc:
        print(f"[Startup][WARN] IR #2 BM25: {exc}")

    print("[Startup] AI Service ready\n")
    yield
    print("[Shutdown] AI Service shutting down...")


app = FastAPI(
    title="DaVinci Furniture — AI Service",
    description="""
AI-powered features cho DaVinci Furniture:

**Deep Learning (dl/)**
- DL #1 `Sentence-Transformers` paraphrase-multilingual-MiniLM-L12-v2
- DL #2 `CLIP ViT-B-32` image + text embeddings
- DL #3 `NCF` Neural Collaborative Filtering (GMF + MLP)

**Information Retrieval (ir/)**
- IR #1 `Dense Retrieval` ChromaDB HNSW cosine similarity
- IR #2 `BM25` Sparse keyword retrieval (Okapi BM25)
- IR #3 `Hybrid RRF` Reciprocal Rank Fusion (Dense + BM25)

**Forecasting (models/)**
- Prophet + LightGBM revenue forecasting
    """,
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(CORSMiddleware, allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"])


@app.middleware("http")
async def add_process_time(request: Request, call_next):
    start    = time.time()
    response = await call_next(request)
    response.headers["X-Process-Time-Ms"] = str(round((time.time() - start) * 1000, 1))
    return response


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(status_code=500, content={"error": str(exc), "path": str(request.url)})


app.include_router(search_router,       prefix="/api/ai")
app.include_router(image_search_router, prefix="/api/ai")
app.include_router(recommend_router,    prefix="/api/ai")
app.include_router(forecast_router,     prefix="/api/ai")


@app.get("/", tags=["Root"])
async def root():
    return {
        "service": "DaVinci AI Service",
        "version": "2.0.0",
        "docs":    "/docs",
        "structure": {
            "dl/":     "Deep Learning — embedder.py | clip_encoder.py | ncf_model.py",
            "ir/":     "Information Retrieval — dense.py | bm25.py | hybrid.py",
            "models/": "Forecasting — forecaster.py | query_processor.py",
        },
        "endpoints": {
            "semantic_search":  "GET  /api/ai/search/semantic?q=...",
            "hybrid_search":    "GET  /api/ai/search/hybrid?q=...",
            "similar_products": "GET  /api/ai/search/similar/{product_id}",
            "autocomplete":     "GET  /api/ai/search/autocomplete?q=...",
            "image_search":     "POST /api/ai/image-search/by-image",
            "recommend_ncf":    "GET  /api/ai/recommend/ncf/{user_id}",
            "forecast":         "GET  /api/ai/forecast/revenue?horizon=30",
            "trending":         "GET  /api/ai/forecast/trending-products",
        },
    }


@app.get("/health", tags=["Root"])
async def health():
    from ir.dense import count_products, count_image_products
    from dl.ncf_model import get_ncf_recommender
    from ir.bm25 import get_bm25_retriever

    ncf  = get_ncf_recommender()
    bm25 = get_bm25_retriever()

    return {
        "status": "healthy",
        "dl": {
            "sentence_transformers": "loaded",
            "clip":                  "lazy_loaded",
            "ncf_trained":           ncf.is_trained,
            "ncf_users":             len(ncf.user_index) if ncf.is_trained else 0,
            "ncf_items":             len(ncf.item_index) if ncf.is_trained else 0,
        },
        "ir": {
            "dense_products":  count_products(),
            "dense_images":    count_image_products(),
            "bm25_ready":      bm25.is_ready,
            "bm25_products":   bm25.stats()["n_products"],
        },
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
