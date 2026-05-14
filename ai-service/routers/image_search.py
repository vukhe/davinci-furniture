"""
routers/image_search.py
DL #2 — CLIP ViT-B-32: tìm kiếm sản phẩm bằng hình ảnh
"""
from fastapi import APIRouter, UploadFile, File, Query, HTTPException
from pydantic import BaseModel
import math

from dl.clip_encoder import embed_image_bytes, embed_text_clip
from ir.dense import query_image

router = APIRouter(prefix="/image-search", tags=["Image Search"])

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_SIZE_MB   = 10


class ImageSearchResult(BaseModel):
    product_id: str
    name: str
    price: float
    category: str
    image_url: str
    score: float


class ImageSearchResponse(BaseModel):
    mode: str
    results: list[ImageSearchResult]
    total: int


def _safe_float(value, default=0.0):
    try:
        num = float(value)
        return num if math.isfinite(num) else default
    except (TypeError, ValueError):
        return default


@router.post("/by-image", response_model=ImageSearchResponse)
async def search_by_image(
    file:  UploadFile = File(..., description="Ảnh upload từ user (jpg/png/webp)"),
    limit: int        = Query(8, ge=1, le=20),
):
    """
    DL #2 — CLIP: user upload ảnh → tìm sản phẩm nội thất tương tự.
    VD: chụp ảnh sofa trong nhà, tìm sofa giống trong shop.
    """
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400,
            detail=f"Chỉ hỗ trợ JPG/PNG/WEBP. Nhận được: {file.content_type}")

    content = await file.read()
    if len(content) > MAX_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"Ảnh quá lớn (max {MAX_SIZE_MB}MB)")

    try:
        query_embedding = embed_image_bytes(content)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Không thể xử lý ảnh: {exc}") from exc

    results = query_image(query_embedding, n_results=limit)
    return _format_results(results, limit, mode="image")


@router.get("/by-text", response_model=ImageSearchResponse)
async def search_by_text_clip(
    q:     str = Query(..., min_length=1, description="Mô tả ảnh bằng văn bản (khuyến nghị tiếng Anh)"),
    limit: int = Query(8, ge=1, le=20),
):
    """
    DL #2 — CLIP text encoder: tìm bằng mô tả hình ảnh.
    VD: 'wooden chair with cushion', 'modern white sofa'
    """
    query_embedding = embed_text_clip(q)
    results         = query_image(query_embedding, n_results=limit)
    return _format_results(results, limit, mode="text")


def _format_results(raw: dict, limit: int, mode: str) -> ImageSearchResponse:
    ids       = raw.get("ids",       [[]])[0]
    metas     = raw.get("metadatas", [[]])[0]
    distances = raw.get("distances", [[]])[0]

    items = []
    for pid, meta, dist in zip(ids, metas, distances):
        score = round(1 - _safe_float(dist, 1.0), 4)
        if score < 0.1:
            continue
        items.append(ImageSearchResult(
            product_id = pid,
            name       = meta.get("name", ""),
            price      = _safe_float(meta.get("price"), 0.0),
            category   = meta.get("category", ""),
            image_url  = meta.get("image_url", ""),
            score      = score,
        ))

    return ImageSearchResponse(mode=mode, results=items[:limit], total=len(items[:limit]))
