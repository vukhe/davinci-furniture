"""
models/forecaster.py
Dự đoán doanh thu bằng Facebook Prophet
Fallback sang LightGBM nếu dữ liệu quá ít
"""
import os
import pickle
import warnings
import numpy as np
import pandas as pd
from pathlib import Path

warnings.filterwarnings("ignore")

MODEL_PATH = Path("./data/forecaster_model.pkl")
MIN_ROWS_PROPHET = 30   # Cần ít nhất 30 ngày để Prophet chạy tốt


def _build_daily_df(orders: list[dict]) -> pd.DataFrame:
    """
    orders: list of { created_at: datetime-str, total/total_amount: float }
    → DataFrame với cột ds (date) và y (revenue)
    """
    df = pd.DataFrame(orders)
    df["ds"] = pd.to_datetime(df["created_at"]).dt.normalize()
    # Hỗ trợ cả 2 tên cột: total_amount (cũ) và total (backend hiện tại)
    if "total_amount" in df.columns:
        df["y"] = pd.to_numeric(df["total_amount"], errors="coerce").fillna(0)
    elif "total" in df.columns:
        df["y"] = pd.to_numeric(df["total"], errors="coerce").fillna(0)
    else:
        df["y"] = 0.0
    daily = df.groupby("ds")["y"].sum().reset_index()
    daily = daily.sort_values("ds")
    return daily


def train_and_forecast(orders: list[dict], horizon: int = 30) -> dict:
    """
    Huấn luyện và dự đoán doanh thu cho `horizon` ngày tới.
    Returns:
        {
            "method": "prophet" | "lightgbm" | "simple",
            "forecast": [{"ds": "2025-01-01", "yhat": 12000000, "yhat_lower": ..., "yhat_upper": ...}],
            "mae": float,
            "trained_on": int  # số ngày dữ liệu
        }
    """
    daily = _build_daily_df(orders)

    if len(daily) >= MIN_ROWS_PROPHET:
        try:
            return _prophet_forecast(daily, horizon)
        except Exception:
            pass  # Prophet lỗi (Stan backend) → fallback LightGBM
    if len(daily) >= 7:
        try:
            return _lightgbm_forecast(daily, horizon)
        except Exception:
            pass
    return _simple_forecast(daily, horizon)


def _prophet_forecast(daily: pd.DataFrame, horizon: int) -> dict:
    from prophet import Prophet

    model = Prophet(
        yearly_seasonality=True,
        weekly_seasonality=True,
        daily_seasonality=False,
        changepoint_prior_scale=0.1,
    )
    model.fit(daily)

    future = model.make_future_dataframe(periods=horizon)
    forecast = model.predict(future)

    future_only = forecast[forecast["ds"] > daily["ds"].max()][
        ["ds", "yhat", "yhat_lower", "yhat_upper"]
    ].copy()
    future_only["ds"] = future_only["ds"].dt.strftime("%Y-%m-%d")
    future_only["yhat"] = future_only["yhat"].clip(lower=0)
    future_only["yhat_lower"] = future_only["yhat_lower"].clip(lower=0)
    future_only["yhat_upper"] = future_only["yhat_upper"].clip(lower=0)

    # Tính MAE trên dữ liệu train
    train_pred = forecast[forecast["ds"].isin(daily["ds"])]["yhat"].values
    mae = float(np.mean(np.abs(daily["y"].values - train_pred)))

    # Lưu model
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(MODEL_PATH, "wb") as f:
        pickle.dump(model, f)

    return {
        "method": "prophet",
        "forecast": future_only.to_dict("records"),
        "mae": mae,
        "trained_on": len(daily),
    }


def _lightgbm_forecast(daily: pd.DataFrame, horizon: int) -> dict:
    """Fallback khi dữ liệu ít: dùng LightGBM với lag features."""
    import lightgbm as lgb
    from sklearn.metrics import mean_absolute_error

    df = daily.copy()
    df["dayofweek"] = df["ds"].dt.dayofweek
    df["month"] = df["ds"].dt.month
    df["lag1"] = df["y"].shift(1)
    df["lag7"] = df["y"].shift(7)
    df["rolling7"] = df["y"].rolling(7).mean()
    df = df.dropna()

    features = ["dayofweek", "month", "lag1", "lag7", "rolling7"]
    X, y = df[features], df["y"]

    model = lgb.LGBMRegressor(n_estimators=100, learning_rate=0.1, verbosity=-1)
    model.fit(X, y)

    mae = float(mean_absolute_error(y, model.predict(X)))

    # Dự đoán tương lai bằng cách roll forward
    last_values = df["y"].tolist()
    last_date = daily["ds"].max()
    preds = []

    for i in range(horizon):
        next_date = last_date + pd.Timedelta(days=i + 1)
        lag1 = last_values[-1]
        lag7 = last_values[-7] if len(last_values) >= 7 else lag1
        roll7 = np.mean(last_values[-7:])
        row = pd.DataFrame([{
            "dayofweek": next_date.dayofweek,
            "month": next_date.month,
            "lag1": lag1, "lag7": lag7, "rolling7": roll7,
        }])
        yhat = max(0, float(model.predict(row)[0]))
        preds.append({"ds": next_date.strftime("%Y-%m-%d"), "yhat": yhat,
                      "yhat_lower": yhat * 0.8, "yhat_upper": yhat * 1.2})
        last_values.append(yhat)

    return {"method": "lightgbm", "forecast": preds, "mae": mae, "trained_on": len(daily)}


def _simple_forecast(daily: pd.DataFrame, horizon: int) -> dict:
    """Fallback đơn giản: dùng rolling average."""
    mean_rev = float(daily["y"].mean())
    last_date = daily["ds"].max()
    preds = []
    for i in range(horizon):
        d = (last_date + pd.Timedelta(days=i + 1)).strftime("%Y-%m-%d")
        preds.append({"ds": d, "yhat": mean_rev,
                      "yhat_lower": mean_rev * 0.7, "yhat_upper": mean_rev * 1.3})
    return {"method": "simple_average", "forecast": preds, "mae": None, "trained_on": len(daily)}


def get_historical_summary(orders: list[dict]) -> dict:
    """Tóm tắt doanh thu lịch sử theo ngày, tuần, tháng."""
    EMPTY = {"daily": [], "weekly": [], "monthly": [], "total": 0.0, "avg_daily": 0.0, "days_of_data": 0}
    if not orders:
        return EMPTY
    daily = _build_daily_df(orders)
    if daily.empty:
        return EMPTY

    daily["week"] = daily["ds"].dt.to_period("W").astype(str)
    daily["month"] = daily["ds"].dt.to_period("M").astype(str)

    return {
        "daily": daily[["ds", "y"]].assign(ds=daily["ds"].dt.strftime("%Y-%m-%d")).to_dict("records"),
        "weekly": daily.groupby("week")["y"].sum().reset_index().rename(columns={"week": "period", "y": "revenue"}).to_dict("records"),
        "monthly": daily.groupby("month")["y"].sum().reset_index().rename(columns={"month": "period", "y": "revenue"}).to_dict("records"),
        "total": float(daily["y"].sum()),
        "avg_daily": float(daily["y"].mean()),
        "days_of_data": len(daily),
    }