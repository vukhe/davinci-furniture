"""
routers/recommend.py
Recommendation System — chỉ dùng DL #3 NCF (Neural Collaborative Filtering).
SVD và Item-CF đã được loại bỏ.
"""
from fastapi import APIRouter, Query, BackgroundTasks, Body
from pydantic import BaseModel

from dl.ncf_model import get_ncf_recommender

router = APIRouter(prefix="/recommend", tags=["Recommendations"])


class RecommendedProduct(BaseModel):
    product_id: str
    score: float

class RecommendResponse(BaseModel):
    user_id: int | None = None
    mode: str
    results: list[RecommendedProduct]
    total: int


@router.get("/ncf/{user_id}", response_model=RecommendResponse)
async def ncf_recommend(
    user_id: int,
    limit:   int = Query(10, ge=1, le=30),
):
    """
    DL #3 — Neural Collaborative Filtering (GMF + MLP).
    Học non-linear interaction giữa user và item qua embedding layer.
    Trả về cold_start nếu NCF chưa train hoặc user chưa có trong model.
    """
    ncf = get_ncf_recommender()
    if not ncf.is_trained:
        return RecommendResponse(
            user_id=user_id, mode="not_trained", results=[], total=0
        )
    results = ncf.recommend(user_id=user_id, n=limit)
    mode    = "ncf" if user_id in ncf.user_index else "ncf_cold_start"
    return RecommendResponse(
        user_id=user_id, mode=mode,
        results=[RecommendedProduct(**r) for r in results],
        total=len(results),
    )


@router.post("/retrain")
async def retrain_ncf(background_tasks: BackgroundTasks):
    """Trigger retrain NCF trong background."""
    def _retrain():
        import subprocess, sys
        subprocess.run(
            [sys.executable, "scripts/train_recommender.py"],
            check=False,
        )
    background_tasks.add_task(_retrain)
    return {"message": "NCF retraining started in background."}


@router.get("/status")
async def recommend_status():
    ncf = get_ncf_recommender()
    return {
        "ncf": {
            "is_trained": ncf.is_trained,
            "n_users":    len(ncf.user_index) if ncf.is_trained else 0,
            "n_items":    len(ncf.item_index) if ncf.is_trained else 0,
        },
    }
