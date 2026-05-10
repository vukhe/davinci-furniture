"""
scripts/index_products.py
Build ChromaDB vector index từ backend API.

  text mode:  DL #1 Sentence-Transformers → ir/dense.py text collection
  image mode: DL #2 CLIP ViT-B-32         → ir/dense.py image collection

Run:
    python scripts/index_products.py           # default: text + image
    python scripts/index_products.py text      # text only
    python scripts/index_products.py image     # image only (chậm hơn)
"""
import os
import sys
import argparse
from pathlib import Path

import httpx
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
load_dotenv(ROOT / ".env")

from dl.clip_encoder import embed_image_url
from models.query_processor import build_product_text_v2
from dl.embedder import embed_batch
from ir.dense import (
    count_products,
    count_image_products,
    upsert_products_image,
    upsert_products_text,
)

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:5000")
BATCH_SIZE  = 32
PAGE_SIZE   = 2000

def fetch_all_products() -> list[dict]:
    """Fetch ALL products from backend API with pagination."""
    print(f"[Index] Fetching products from {BACKEND_URL} ...")
    all_products: list[dict] = []
    page = 1

    while True:
        try:
            res = httpx.get(
                f"{BACKEND_URL}/api/products",
                params={"limit": PAGE_SIZE, "page": page, "include_ratings": "true"},
                timeout=30,
            )
        except httpx.ConnectError:
            print(f"[Index] ERROR: Cannot connect to {BACKEND_URL}")
            sys.exit(1)
        except httpx.TimeoutException:
            print(f"[Index] ERROR: Timeout on page {page}")
            sys.exit(1)

        if res.status_code != 200:
            print(f"[Index] ERROR: HTTP {res.status_code}")
            sys.exit(1)

        data = res.json()

        if isinstance(data, list):
            all_products.extend(data)
            break

        page_products = data.get("data") or data.get("products") or []
        all_products.extend(page_products)

        pagination  = data.get("pagination", {})
        total_pages = pagination.get("pages", 1)
        total       = pagination.get("total", 0)

        if page == 1:
            print(f"[Index] {total} products across {total_pages} pages")

        if page >= total_pages or not page_products:
            break
        page += 1

    return all_products

def _extract_metadata(product: dict) -> dict:
    """Extract normalized metadata for ChromaDB."""
    pid       = str(product.get("product_id") or product.get("id") or product.get("ProductID") or "")
    name      = str(product.get("name", product.get("ProductName", "")))
    price     = float(product.get("price", product.get("Price", 0)) or 0)
    sale_price = product.get("sale_price")
    category  = str(product.get("category_name", product.get("CategoryName", "")))
    category_id = product.get("category_id") or product.get("CategoryID")
    material  = str(product.get("material", "") or "")
    brand     = str(product.get("brand", "") or "")
    image_url = str(
        product.get("image_url") or product.get("ImageURL") or product.get("image") or ""
    )
    sold      = int(product.get("sold", 0) or 0)
    is_active = int(product.get("is_active", 1) or 1)

    # avg_rating may be joined from backend or absent
    avg_rating = product.get("avg_rating") or product.get("avgRating")

    meta: dict = {
        "product_id": pid,
        "name": name,
        "price": price,
        "category": category,
        "material": material,
        "brand": brand,
        "image_url": image_url,
        "sold": sold,
        "is_active": is_active,
    }

    if category_id is not None:
        meta["category_id"] = int(category_id)

    # Only set if available (ChromaDB metadata values must be str/int/float/bool)
    if sale_price is not None:
        meta["sale_price"] = float(sale_price)
    if avg_rating is not None:
        meta["avg_rating"] = float(avg_rating)

    return meta

def index_text_embeddings(products: list[dict]):
    print(f"\n[Index] Indexing {len(products)} products (text) ...")

    ids, texts, metadatas = [], [], []

    for product in products:
        pid = str(product.get("product_id") or product.get("id") or product.get("ProductID") or "")
        if not pid:
            continue

        meta = _extract_metadata(product)
        text = build_product_text_v2(product)  # richer text with expansions

        ids.append(pid)
        texts.append(text)
        metadatas.append(meta)

    for i in range(0, len(ids), BATCH_SIZE):
        batch_ids   = ids[i:i + BATCH_SIZE]
        batch_texts = texts[i:i + BATCH_SIZE]
        batch_meta  = metadatas[i:i + BATCH_SIZE]

        embeddings = embed_batch(batch_texts)
        upsert_products_text(
            ids=batch_ids,
            embeddings=embeddings,
            metadatas=batch_meta,
            documents=batch_texts,
        )
        print(f"  [OK] {min(i + BATCH_SIZE, len(ids))}/{len(ids)}")

    print(f"[Index] Text indexing done. Total in DB: {count_products()}")

def index_image_embeddings(products: list[dict]):
    print("\n[Index] Indexing image embeddings (CLIP) ...")
    indexed, skipped = 0, 0

    for product in products:
        pid = str(product.get("product_id") or product.get("id") or product.get("ProductID") or "")
        image_url = product.get("image_url") or product.get("ImageURL") or product.get("image") or ""

        if not pid or not image_url:
            skipped += 1
            continue

        try:
            embedding = embed_image_url(image_url)
            upsert_products_image(
                ids=[pid],
                embeddings=[embedding],
                metadatas=[_extract_metadata(product)],
            )
            indexed += 1
            print(f"  [OK] [{indexed}] {pid}")
        except Exception as exc:
            print(f"  [SKIP] {pid}: {exc}")
            skipped += 1

    print(f"[Index] Image done. Indexed: {indexed}, Skipped: {skipped}")

def main():
    print("=" * 50)
    print("DaVinci AI – Product Indexer v2")
    print("=" * 50)

    parser = argparse.ArgumentParser(description="Index products into ChromaDB")
    parser.add_argument(
        "positional_mode",
        nargs="?",
        choices=["text", "image", "all"],
        help="Backward-compatible mode argument",
    )
    parser.add_argument(
        "--mode",
        choices=["text", "image", "all"],
        default=None,
        help="Index mode",
    )
    args = parser.parse_args()
    mode = args.mode or args.positional_mode or "all"
    products = fetch_all_products()

    if not products:
        print("[Index] No products found.")
        sys.exit(1)

    print(f"[Index] Found {len(products)} products")

    if mode in ("all", "text"):
        index_text_embeddings(products)
    if mode in ("all", "image"):
        index_image_embeddings(products)

    print("\n[Index] Complete. Run 'uvicorn main:app' to start AI service.")

if __name__ == "__main__":
    main()
