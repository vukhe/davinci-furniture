"""
routers/forecast.py
Bước 6: Dự đoán doanh thu / xu hướng mua hàng
"""
from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel
from typing import Optional
import httpx
import os

from models.forecaster import train_and_forecast, get_historical_summary

router = APIRouter(prefix="/forecast", tags=["Forecasting"])

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:5000")


class ForecastPoint(BaseModel):
    ds: str
    yhat: float
    yhat_lower: float
    yhat_upper: float


class ForecastResponse(BaseModel):
    method: str
    horizon_days: int
    forecast: list[ForecastPoint]
    mae: Optional[float]
    trained_on: int
    currency: str = "VND"


class HistoricalPoint(BaseModel):
    ds: str
    y: float


class HistoricalResponse(BaseModel):
    daily: list[dict]
    weekly: list[dict]
    monthly: list[dict]
    total: float
    avg_daily: float
    days_of_data: int


async def _fetch_orders(token: str = None) -> list[dict]:
    """Lấy toàn bộ orders từ backend (paginate hết tất cả trang)."""
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    all_orders = []
    page = 1
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            while True:
                resp = await client.get(
                    f"{BACKEND_URL}/api/admin/orders",
                    params={"limit": 200, "page": page},
                    headers=headers,
                )
                resp.raise_for_status()
                data = resp.json()

                if isinstance(data, list):
                    # Normalize field: total → total_amount
                    for o in data:
                        if "total_amount" not in o and "total" in o:
                            o["total_amount"] = o["total"]
                    all_orders.extend(data)
                    break

                orders = data.get("data", data.get("orders", []))
                # Normalize field: total → total_amount
                for o in orders:
                    if "total_amount" not in o and "total" in o:
                        o["total_amount"] = o["total"]
                all_orders.extend(orders)

                pagination = data.get("pagination", {})
                total_pages = pagination.get("pages", 1)
                if page >= total_pages or not orders:
                    break
                page += 1

        return all_orders
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Không thể lấy dữ liệu orders: {str(e)}")


@router.get("/revenue", response_model=ForecastResponse)
async def forecast_revenue(
    horizon: int = Query(30, ge=7, le=90, description="Số ngày dự đoán (7-90)"),
    admin_token: str = Query(..., description="Admin JWT token từ backend"),
):
    """
    Dự đoán doanh thu {horizon} ngày tới.
    Dùng cho AdminDashboard và AdminAnalytics.
    
    Method tự động:
    - ≥30 ngày data → Prophet (chính xác nhất)
    - 7-29 ngày data → LightGBM
    - <7 ngày data → Simple average
    """
    orders = await _fetch_orders(token=admin_token)

    if not orders:
        raise HTTPException(status_code=404, detail="Không có dữ liệu đơn hàng để dự đoán")

    result = train_and_forecast(orders, horizon=horizon)

    return ForecastResponse(
        method=result["method"],
        horizon_days=horizon,
        forecast=[ForecastPoint(**p) for p in result["forecast"]],
        mae=result.get("mae"),
        trained_on=result["trained_on"],
    )


@router.get("/historical", response_model=HistoricalResponse)
async def historical_revenue(
    admin_token: str = Query(..., description="Admin JWT token"),
):
    """
    Dữ liệu doanh thu lịch sử theo ngày/tuần/tháng.
    Dùng để vẽ biểu đồ trong AdminDashboard.
    """
    orders = await _fetch_orders(token=admin_token)

    if not orders:
        return HistoricalResponse(daily=[], weekly=[], monthly=[], total=0, avg_daily=0, days_of_data=0)

    summary = get_historical_summary(orders)
    return HistoricalResponse(**summary)


@router.get("/trending-products")
async def trending_products(
    admin_token: str = Query(...),
    days: int = Query(30, ge=7, le=90, description="Phân tích trong bao nhiêu ngày gần đây"),
    limit: int = Query(10, ge=1, le=30),
):
    """
    Phân tích xu hướng: sản phẩm nào đang tăng trưởng doanh số nhanh nhất.
    """
    import pandas as pd
    import numpy as np

    orders = await _fetch_orders(token=admin_token)
    if not orders:
        return {"trending": [], "period_days": days}

    rows = []
    for o in orders:
        created_at = o.get("created_at") or o.get("CreatedAt")
        items = o.get("items", o.get("OrderItems", []))
        for item in items:
            pid = item.get("product_id") or item.get("ProductID")
            qty = item.get("quantity") or item.get("Quantity") or 1
            price = item.get("price") or item.get("Price") or 0
            if pid and created_at:
                rows.append({
                    "product_id": str(pid),
                    "product_name": item.get("product_name") or item.get("ProductName") or str(pid),
                    "created_at": pd.to_datetime(created_at),
                    "quantity": int(qty),
                    "revenue": float(qty) * float(price),
                })

    if not rows:
        return {"trending": [], "period_days": days}

    df = pd.DataFrame(rows)
    cutoff = df["created_at"].max() - pd.Timedelta(days=days)
    half = df["created_at"].max() - pd.Timedelta(days=days // 2)

    recent = df[df["created_at"] >= half].groupby("product_id").agg(
        name=("product_name", "first"),
        qty_recent=("quantity", "sum"),
        rev_recent=("revenue", "sum"),
    )
    older = df[(df["created_at"] >= cutoff) & (df["created_at"] < half)].groupby("product_id").agg(
        qty_older=("quantity", "sum"),
        rev_older=("revenue", "sum"),
    )

    merged = recent.join(older, how="left").fillna(0)
    # Tính growth rate
    merged["growth"] = np.where(
        merged["qty_older"] > 0,
        (merged["qty_recent"] - merged["qty_older"]) / merged["qty_older"],
        merged["qty_recent"],  # Sản phẩm mới hoàn toàn
    )
    merged = merged.sort_values("growth", ascending=False).head(limit)

    return {
        "trending": [
            {
                "product_id": idx,
                "name": row["name"],
                "qty_recent_half": int(row["qty_recent"]),
                "qty_older_half": int(row["qty_older"]),
                "revenue_recent": float(row["rev_recent"]),
                "growth_rate": round(float(row["growth"]) * 100, 1),
            }
            for idx, row in merged.iterrows()
        ],
        "period_days": days,
    }