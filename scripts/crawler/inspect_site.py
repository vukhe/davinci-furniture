"""
╔══════════════════════════════════════════════════════╗
║   SELECTOR INSPECTOR                                 ║
║   Chạy TRƯỚC khi điều chỉnh selector trong crawler  ║
╚══════════════════════════════════════════════════════╝

Dùng:
    python inspect_site.py <URL>              # auto-detect static/JS
    python inspect_site.py <URL> --selenium   # ép dùng Selenium
    python inspect_site.py <URL> --requests   # ép dùng requests

Ví dụ:
    python inspect_site.py https://blanc.vn/sofa
    python inspect_site.py https://www.noithathoaphat.vn/sofa
    python inspect_site.py https://cdchomedesigncenter.com/product/ten-sp --selenium
"""

import argparse
import re
import sys
import time

import requests
from bs4 import BeautifulSoup

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8",
}

# Selector templates theo từng loại site
SELECTORS = {
    "name": [
        "h1", "h1.product-title", "h1.product__title",
        "h1.product-name", "h1.product_title", "h1.entry-title",
        ".title_product_Details", ".product__name", ".tit-product h1",
        "[itemprop='name']", ".product-name h1",
    ],
    "price": [
        ".price", ".product-price", ".product__price",
        "#price_pro", ".price_pro", ".woocommerce-Price-amount",
        "[itemprop='price']", ".price--sale", ".regular-price",
        "ins .woocommerce-Price-amount", "del .woocommerce-Price-amount",
        "#CurrentPrice", ".item-1 .gia",
        "[class*='price']",
    ],
    "image": [
        ".product-gallery img", ".product__media img",
        "[class*='gallery'] img", ".product-image img",
        ".product-images img", "#product-images img",
        ".swiper-slide img", ".woocommerce-product-gallery img",
        ".left_wp_main_details_product .pro-image",
        "#imageGallery img", ".gotoGallery1 img", ".slider-sp img",
        "img[itemprop='image']", ".product img",
    ],
    "description": [
        ".product-description", ".product__description",
        "[itemprop='description']", ".product-content",
        ".product-detail", "#tab-description",
        ".des_right_details_product", ".description_detail_product",
        ".detail-content-product", ".content",
        ".woocommerce-product-details__short-description",
        "[class*='description']",
    ],
    "rating": [
        "[itemprop='ratingValue']", ".rating-value",
        ".star-rating", ".rating", ".woocommerce-product-rating .rating",
        "[class*='rating']", "[class*='star']",
    ],
    "product_links": [
        "a.link_product[href]", ".content_product_tab > a[href]",
        "h3.product-name a[href]", ".product-item a.product-name[href]",
        ".product-list a[href]", "a.product-item__link[href]",
        ".woocommerce-loop-product__link[href]",
        ".products .product a[href]",
        "h2.woocommerce-loop-product__title a[href]",
        ".product-name a[href]", "h3 a[href]",
        ".slider-list-product .item .text h3 a[href]",
        ".slider-list-product .item .img a[href]",
    ],
}


def get_soup_requests(url: str) -> BeautifulSoup | None:
    try:
        r = requests.get(url, headers=HEADERS, timeout=15)
        print(f"  HTTP {r.status_code} | Content-Length: {len(r.content):,} bytes")
        if r.status_code == 200:
            return BeautifulSoup(r.text, "lxml")
        return None
    except Exception as e:
        print(f"  ❌ {e}")
        return None


def get_soup_selenium(url: str) -> BeautifulSoup | None:
    try:
        from selenium import webdriver
        from selenium.webdriver.chrome.options import Options
        from selenium.webdriver.chrome.service import Service
        from webdriver_manager.chrome import ChromeDriverManager

        opts = Options()
        opts.add_argument("--headless=new")
        opts.add_argument("--no-sandbox")
        opts.add_argument("--disable-dev-shm-usage")
        opts.add_argument("--window-size=1280,900")
        opts.add_argument(f"user-agent={HEADERS['User-Agent']}")
        service = Service(ChromeDriverManager().install())
        driver  = webdriver.Chrome(service=service, options=opts)
        driver.get(url)
        time.sleep(4)  # đợi JS render
        soup = BeautifulSoup(driver.page_source, "lxml")
        driver.quit()
        return soup
    except Exception as e:
        print(f"  ❌ Selenium error: {e}")
        return None


def detect_needs_selenium(soup_static: BeautifulSoup | None) -> bool:
    """Heuristic: nếu <body> quá ngắn, site dùng JS render."""
    if not soup_static:
        return True
    body = soup_static.find("body")
    if not body:
        return True
    text = body.get_text(strip=True)
    return len(text) < 200


def inspect(url: str, force_mode: str = "auto"):
    print(f"\n🔍 {url}")
    print("=" * 65)

    # Lấy soup
    if force_mode == "selenium":
        print("  Mode: Selenium")
        soup = get_soup_selenium(url)
    elif force_mode == "requests":
        print("  Mode: requests")
        soup = get_soup_requests(url)
    else:
        print("  Mode: auto-detect...")
        soup_static = get_soup_requests(url)
        if detect_needs_selenium(soup_static):
            print("  ⚡ Site có vẻ dùng JavaScript → dùng Selenium")
            soup = get_soup_selenium(url)
        else:
            print("  ✅ Site có vẻ static HTML → dùng requests")
            soup = soup_static

    if not soup:
        print("  ❌ Không lấy được HTML")
        return

    body_text_len = len(soup.get_text(strip=True))
    print(f"  Body text length: {body_text_len:,} chars\n")

    raw_html = str(soup)
    load_more = re.search(
        r"loadMoreContent\('(?P<page>\d+)'\s*,\s*'(?P<slug>[^']+)'\s*,\s*'(?P<module>\d+)'\s*,\s*'(?P<filter>[^']*)'\)",
        raw_html,
    )
    if load_more:
        print("  AJAX load-more detected:")
        print(
            "    "
            f"page={load_more.group('page')} | "
            f"slug={load_more.group('slug')} | "
            f"module={load_more.group('module')} | "
            f"filter={load_more.group('filter')!r}"
        )
        print("    endpoint: /Ajax/Content/LoadMore\n")

    for category, selectors in SELECTORS.items():
        print(f"{'─'*55}")
        print(f"  {category.upper()}")
        found_any = False
        for sel in selectors:
            els = soup.select(sel)
            if not els:
                continue
            found_any = True
            if category == "image":
                srcs = []
                for img in els[:3]:
                    src = (
                        img.get("src") or img.get("data-src") or
                        img.get("data-lazy") or img.get("style", "")
                    )
                    if src:
                        srcs.append(src[:70])
                if srcs:
                    print(f"  ✅ {sel!r:50s} → {len(els)} ảnh")
                    for s in srcs[:2]:
                        print(f"       {s}")
            elif category == "product_links":
                hrefs = [a.get("href", "")[:65] for a in els[:3] if a.get("href")]
                if hrefs:
                    print(f"  ✅ {sel!r:50s} → {len(els)} links")
                    for h in hrefs[:2]:
                        print(f"       {h}")
            else:
                texts = [e.get_text(strip=True)[:60] for e in els[:2]]
                print(f"  ✅ {sel!r:50s} → {texts}")
        if not found_any:
            print(f"  ❌ Không tìm thấy selector nào hoạt động")

    print(f"\n{'─'*55}")
    print("  TẤT CẢ CLASS chứa 'product' (15 đầu):")
    tables = soup.select("table")
    print(f"  TABLES: {len(tables)}")
    for idx, table in enumerate(tables[:2], start=1):
        print(f"    Table {idx}:")
        for row in table.select("tr")[:8]:
            cells = [" ".join(cell.get_text(' ', strip=True).split())[:80] for cell in row.select("td,th")]
            if cells:
                print(f"      {cells}")

    print(f"\n{'â”€'*55}")
    found_classes = set()
    for el in soup.find_all(class_=True):
        for cls in el.get("class", []):
            if "product" in cls.lower():
                found_classes.add(cls)
    for cls in sorted(found_classes)[:15]:
        print(f"    .{cls}")

    print(f"\n{'='*65}")
    print("💡 Dùng kết quả ✅ để cập nhật selector trong crawl_furniture.py")
    print("   Nếu tất cả ❌ → site cần Selenium, chạy lại với --selenium\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("url", nargs="?", default="https://blanc.vn/sofa")
    parser.add_argument("--selenium",  action="store_true")
    parser.add_argument("--requests",  action="store_true")
    args = parser.parse_args()

    mode = "auto"
    if args.selenium:
        mode = "selenium"
    elif args.requests:
        mode = "requests"

    inspect(args.url, force_mode=mode)
