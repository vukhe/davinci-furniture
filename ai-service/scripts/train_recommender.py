"""
scripts/train_recommender.py
============================
Train DL #3 NCF (Neural Collaborative Filtering — GMF + MLP) từ SQL Server.


Usage:
    python scripts/train_recommender.py
    python scripts/train_recommender.py --min-interactions 2
    python scripts/train_recommender.py --dry-run
"""

import argparse, hashlib, os, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
env_path = ROOT / ".env"
if not env_path.exists():
    print(f"[Warn] .env not found at {env_path}")
    import shutil; shutil.copy(ROOT / ".env.example", env_path)
load_dotenv(env_path, override=True)

import pandas as pd

try:
    import pyodbc
except ImportError:
    print("[Error] pyodbc chua cai. Chay: pip install pyodbc")
    sys.exit(1)


# ── DB connection ──────────────────────────────────────────────────────────────

def get_connection():
    server   = os.getenv("DB_SERVER",   "localhost")
    database = os.getenv("DB_NAME",     "DAVINCI_FURNITURE")
    user     = os.getenv("DB_USER",     "sa")
    password = os.getenv("DB_PASSWORD", "")
    driver   = os.getenv("DB_DRIVER",   "ODBC Driver 17 for SQL Server")
    conn_str = (
        f"DRIVER={{{driver}}};"
        f"SERVER={server};DATABASE={database};"
        f"UID={user};PWD={password};TrustServerCertificate=yes;"
    )
    try:
        conn = pyodbc.connect(conn_str, timeout=10)
        print(f"[DB] Connected to {server}/{database}")
        return conn
    except Exception as e:
        print(f"[Error] Khong ket noi duoc DB: {e}")
        sys.exit(1)


# ── Ensure UserInteractions table ─────────────────────────────────────────────

CREATE_TABLE_SQL = """
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='UserInteractions' AND xtype='U')
CREATE TABLE UserInteractions (
    id          INT IDENTITY(1,1) PRIMARY KEY,
    user_id     INT          NOT NULL,
    product_id  INT          NOT NULL,
    type        VARCHAR(20)  NOT NULL CHECK (type IN ('view','wishlist','purchase','rating')),
    score       FLOAT        NOT NULL DEFAULT 1.0,
    created_at  DATETIME     NOT NULL DEFAULT GETDATE()
);
"""

def ensure_table(conn):
    cur = conn.cursor()
    try:
        cur.execute(CREATE_TABLE_SQL); conn.commit()
        print("[DB] Bang UserInteractions san sang")
    except Exception as e:
        print(f"[Warn] {e}")
    finally:
        cur.close()


# ── Load tracked interactions from UserInteractions ───────────────────────────

def load_interactions(conn, min_interactions: int = 1) -> pd.DataFrame:
    try:
        tables = pd.read_sql(
            """SELECT s.name AS schema_name, t.name AS table_name
               FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
               WHERE LOWER(t.name) = LOWER('UserInteractions')
               ORDER BY CASE WHEN s.name='dbo' THEN 0 ELSE 1 END, s.name""",
            conn,
        )
    except Exception as e:
        print(f"[Error] Cannot inspect UserInteractions: {e}")
        return pd.DataFrame(columns=["user_id", "product_id", "score"])

    if tables.empty:
        print("[Error] Khong tim thay bang UserInteractions.")
        return pd.DataFrame(columns=["user_id", "product_id", "score"])

    schema_name = str(tables.iloc[0]["schema_name"])
    table_name  = str(tables.iloc[0]["table_name"])
    full_table  = f"[{schema_name}].[{table_name}]"

    sql = f"""
        SELECT ui.user_id, ui.product_id, ui.score,
               p.id AS matched_product_id,
               ISNULL(CAST(p.is_active AS INT), 0) AS product_active,
               u.id AS matched_user_id,
               ISNULL(CAST(u.is_active AS INT), 0) AS user_active
        FROM {full_table} ui
        LEFT JOIN Products p ON p.id = ui.product_id
        LEFT JOIN Users    u ON u.id = ui.user_id
        WHERE ui.user_id IS NOT NULL AND ui.product_id IS NOT NULL AND ui.score IS NOT NULL
    """
    try:
        diag = pd.read_sql(f"SELECT COUNT(*) AS n, COUNT(DISTINCT user_id) AS u, COUNT(DISTINCT product_id) AS p FROM {full_table}", conn).iloc[0]
        print(f"[Data] UserInteractions: {int(diag['n'])} rows | {int(diag['u'])} users | {int(diag['p'])} products")
        df = pd.read_sql(sql, conn)
    except Exception as e:
        print(f"[Error] Query failed: {e}")
        return pd.DataFrame(columns=["user_id", "product_id", "score"])

    if df.empty:
        return pd.DataFrame(columns=["user_id", "product_id", "score"])

    valid = df[
        df["matched_product_id"].notna() & df["matched_user_id"].notna() &
        (df["product_active"] == 1) & (df["user_active"] == 1)
    ][["user_id", "product_id", "score"]].copy()

    if valid.empty:
        valid = df[["user_id", "product_id", "score"]].copy()

    valid["user_id"]    = pd.to_numeric(valid["user_id"],    errors="coerce")
    valid["product_id"] = pd.to_numeric(valid["product_id"], errors="coerce")
    valid["score"]      = pd.to_numeric(valid["score"],      errors="coerce").fillna(1.0)
    valid = valid.dropna(subset=["user_id", "product_id"])
    valid["user_id"]    = valid["user_id"].astype(int)
    valid["product_id"] = valid["product_id"].astype(int)

    agg = valid.groupby(["user_id","product_id"])["score"].sum().clip(upper=10).reset_index()
    counts = agg.groupby("user_id")["product_id"].count()
    agg = agg[agg["user_id"].isin(counts[counts >= min_interactions].index)]
    print(f"[Data] {len(agg)} pairs | {agg['user_id'].nunique()} users | {agg['product_id'].nunique()} products")
    return agg


# ── Load derived interactions từ Orders / Wishlists / Reviews ─────────────────

def load_derived_interactions(conn, min_interactions: int = 2) -> pd.DataFrame:
    sql = """
        SELECT o.user_id, oi.product_id, CAST(5.0 AS FLOAT) AS score
        FROM Orders o
        JOIN OrderItems oi ON oi.order_id = o.id
        JOIN Products p ON p.id = oi.product_id AND p.is_active = 1
        JOIN Users    u ON u.id = o.user_id    AND u.is_active = 1
        WHERE o.user_id IS NOT NULL AND o.status <> 'cancelled'

        UNION ALL

        SELECT w.user_id, w.product_id, CAST(3.0 AS FLOAT) AS score
        FROM Wishlists w
        JOIN Products p ON p.id = w.product_id AND p.is_active = 1
        JOIN Users    u ON u.id = w.user_id    AND u.is_active = 1

        UNION ALL

        SELECT r.user_id, r.product_id, CAST(2.0 + CAST(r.rating AS FLOAT)/5.0 AS FLOAT) AS score
        FROM Reviews r
        JOIN Products p ON p.id = r.product_id AND p.is_active = 1
        JOIN Users    u ON u.id = r.user_id    AND u.is_active = 1
    """
    try:
        raw = pd.read_sql(sql, conn)
    except Exception as e:
        print(f"[Warn] load_derived_interactions: {e}")
        return pd.DataFrame(columns=["user_id", "product_id", "score"])

    if raw.empty:
        return pd.DataFrame(columns=["user_id", "product_id", "score"])

    agg = raw.groupby(["user_id","product_id"])["score"].sum().clip(upper=10).reset_index()
    counts = agg.groupby("user_id")["product_id"].count()
    agg = agg[agg["user_id"].isin(counts[counts >= min_interactions].index)]
    print(f"[Derived] {len(agg)} pairs tu Orders/Wishlists/Reviews")
    return agg


# ── Load popularity + build synthetic data ────────────────────────────────────

def load_popularity(conn) -> pd.DataFrame:
    sql = """
        SELECT p.id AS product_id,
               CAST(p.sold AS FLOAT) AS sold,
               CAST(COALESCE(p.sale_price, p.price) AS FLOAT) AS effective_price,
               p.category_id,
               ISNULL(p.material, '') AS material,
               CAST(p.is_featured AS INT) AS is_featured,
               ISNULL((SELECT AVG(CAST(r.rating AS FLOAT)) FROM Reviews r WHERE r.product_id = p.id), 3.0) AS avg_rating
        FROM Products p WHERE p.is_active = 1
    """
    try:
        df = pd.read_sql(sql, conn)
        print(f"[Catalog] {len(df)} active products loaded")
        return df
    except Exception as e:
        print(f"[Warn] load_popularity: {e}")
        return pd.DataFrame(columns=["product_id","sold","effective_price","category_id","material","is_featured","avg_rating"])


def build_synthetic(popularity_df: pd.DataFrame) -> pd.DataFrame:
    """Synthetic persona data khi UserInteractions con it."""
    if popularity_df.empty:
        return pd.DataFrame(columns=["user_id","product_id","score"])

    df = popularity_df.copy()
    sold_max     = float(df["sold"].max() or 0)
    price_series = df["effective_price"].fillna(0).astype(float)
    price_q33    = float(price_series.quantile(0.33)) if len(price_series) else 0.0
    price_q66    = float(price_series.quantile(0.66)) if len(price_series) else 0.0

    df["sold_norm"]   = (df["sold"].fillna(0).astype(float) / sold_max) if sold_max > 0 else 0.0
    df["rating_norm"] = df["avg_rating"].fillna(3.0).astype(float).clip(1,5) / 5.0

    rows = []
    for _, p in df.iterrows():
        pid   = int(p["product_id"])
        sold  = float(p["sold_norm"])
        rat   = float(p["rating_norm"])
        price = float(p.get("effective_price") or 0)
        feat  = 0.5 if int(p.get("is_featured") or 0) else 0.0
        cat   = p.get("category_id")
        mat   = str(p.get("material") or "").strip().lower()

        rows.append({"user_id": 9001, "product_id": pid, "score": 1.0 + 4.0*sold + feat})
        rows.append({"user_id": 9002, "product_id": pid, "score": 1.0 + 4.0*rat  + feat})

        ptier = 9201 if price <= price_q33 else (9202 if price <= price_q66 else 9203)
        rows.append({"user_id": ptier, "product_id": pid, "score": 3.0 + rat})

        if pd.notna(cat):
            rows.append({"user_id": 9300 + int(cat), "product_id": pid, "score": 3.0 + sold + rat})

        if mat:
            bucket = int(hashlib.md5(mat.encode()).hexdigest()[:8], 16) % 1000
            rows.append({"user_id": 10000 + bucket, "product_id": pid, "score": 2.5 + rat})

    synthetic = pd.DataFrame(rows)
    print(f"[Synthetic] {len(synthetic)} pairs | {synthetic['product_id'].nunique()} products | {synthetic['user_id'].nunique()} personas")
    return synthetic


# ── Main ───────────────────────────────────────────────────────────────────────

def parse_args():
    p = argparse.ArgumentParser(description="Train NCF (DL #3) cho DaVinci Furniture")
    p.add_argument("--min-interactions", type=int, default=1,
                   help="So tuong tac toi thieu cua 1 user de duoc dua vao train (default: 1)")
    p.add_argument("--dry-run", action="store_true",
                   help="Chay thu, khong luu model")
    return p.parse_args()


def main():
    args = parse_args()
    print("=" * 55)
    print("  DaVinci — NCF Training Script (DL #3)")
    print("=" * 55)

    conn = get_connection()
    ensure_table(conn)

    # Load data
    df = load_interactions(conn, args.min_interactions)
    derived = load_derived_interactions(conn, args.min_interactions)
    if not derived.empty:
        before = len(df)
        df = pd.concat([df, derived], ignore_index=True)
        df = df.groupby(["user_id","product_id"], as_index=False)["score"].sum()
        df["score"] = df["score"].clip(upper=10)
        print(f"[Data] Merged tracked + derived: {before} -> {len(df)} pairs")

    popularity = load_popularity(conn)
    conn.close()

    # Augment neu data qua it
    n_users = df["user_id"].nunique() if not df.empty else 0
    n_items = df["product_id"].nunique() if not df.empty else 0
    n_cat   = popularity["product_id"].nunique() if not popularity.empty else 0
    if len(df) < 10 or n_users < 2 or n_items < 2 or (n_cat > 0 and n_items < n_cat):
        print(f"[Warn] Data it ({len(df)} pairs, {n_users} users, {n_items}/{n_cat} products) — augment synthetic")
        synthetic = build_synthetic(popularity)
        df = pd.concat([df, synthetic], ignore_index=True)
        df = df.groupby(["user_id","product_id"], as_index=False)["score"].sum()
        df["score"] = df["score"].clip(upper=10)
        print(f"[Data] Sau augment: {len(df)} pairs")

    if df.empty:
        print("[Error] Khong co du lieu de train.")
        sys.exit(1)

    # Train NCF — DL #3
    print("\n[NCF] Training Neural Collaborative Filtering (GMF + MLP hidden=[64,32,16]) ...")
    try:
        from dl.ncf_model import NCFRecommender
        ncf = NCFRecommender(embed_dim=32, epochs=15)
        ncf.train(df)
        if ncf.is_trained:
            print(f"[NCF] Trained: {len(ncf.user_index)} users x {len(ncf.item_index)} items")
            print("[NCF] Test recommend user_id=1:")
            for r in ncf.recommend(user_id=1, n=3):
                print(f"      product_id={r['product_id']}  score={r['score']:.4f}")
            if not args.dry_run:
                ncf.save()
                print("[Done] NCF model da duoc luu vao data/ncf_model.pkl")
            else:
                print("[Dry-run] NCF KHONG duoc luu.")
        else:
            print("[Error] NCF training that bai.")
    except Exception as e:
        print(f"[Error] NCF: {e}")
        import traceback; traceback.print_exc()
        sys.exit(1)

    print("=" * 55)


if __name__ == "__main__":
    main()
