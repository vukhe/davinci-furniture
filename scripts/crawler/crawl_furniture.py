from __future__ import annotations

"""
╔══════════════════════════════════════════════════════════════╗
║   DAVINCI FURNITURE – Multi-Site Crawler                     ║
║   Sites: blanc.vn · noithathoaphat.vn                        ║
║          noithathoaphat.com.vn · cdchomedesigncenter.com     ║
║   Output: INSERT SQL cho SQL Server                          ║
╚══════════════════════════════════════════════════════════════╝

Cài đặt:
    pip install -r requirements.txt

Chạy:
    python crawl_furniture.py                     # crawl tất cả sites
    python crawl_furniture.py --site blanc        # crawl 1 site
    python crawl_furniture.py --resume            # tiếp tục từ checkpoint
    python crawl_furniture.py --max 100           # giới hạn số sản phẩm
"""

import argparse
import json
import pickle
import random
import re
import time
import unicodedata
from datetime import datetime, timedelta
from pathlib import Path
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

# Chọn parser tốt nhất hiện có
try:
    import lxml  # noqa: F401
    _BS4_PARSER = "lxml"
except ImportError:
    _BS4_PARSER = "html.parser"
    print("[INFO] lxml không có, dùng html.parser (pip install lxml để nhanh hơn)")

try:
    from selenium import webdriver
    from selenium.webdriver.chrome.options import Options
    from selenium.webdriver.chrome.service import Service
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from webdriver_manager.chrome import ChromeDriverManager
except ImportError:
    webdriver = None
    Options = None
    Service = None
    By = None
    WebDriverWait = None
    ChromeDriverManager = None

SCRIPT_DIR = Path(__file__).resolve().parent

# ══════════════════════════════════════════════════════════════
# CẤU HÌNH
# ══════════════════════════════════════════════════════════════
CONFIG = {
    "max_products":   3000,    # giới hạn tổng sản phẩm
    "delay_min":      1.5,    # delay tối thiểu giữa request (giây)
    "delay_max":      3.0,    # delay tối đa
    "page_timeout":   15,     # timeout tải trang (giây)
    "headless":       True,   # False = hiện Chrome để debug
    "output_sql":     SCRIPT_DIR / "output_products.sql",
    "checkpoint":     SCRIPT_DIR / ".crawl_checkpoint.pkl",  # file resume
    # Giả lập dữ liệu người dùng
    "fake_users":     50,     # số user giả
    "interactions_per_product": 8,   # số interaction giả mỗi sản phẩm
    "reviews_per_product":      3,   # số review giả mỗi sản phẩm
}

# User-Agent pool để random xoay vòng
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0",
]

# ══════════════════════════════════════════════════════════════
# DANH MỤC (khớp với schema Categories)
# ══════════════════════════════════════════════════════════════
CATEGORY_DEFINITIONS = [
    {"id": 1,  "name": "Phòng khách",        "slug": "phong-khach",       "parent_id": None, "sort_order": 1},
    {"id": 2,  "name": "Phòng ngủ",          "slug": "phong-ngu",         "parent_id": None, "sort_order": 2},
    {"id": 3,  "name": "Phòng ăn",           "slug": "phong-an",          "parent_id": None, "sort_order": 3},
    {"id": 4,  "name": "Văn phòng",          "slug": "van-phong",         "parent_id": None, "sort_order": 4},
    {"id": 7,  "name": "Sofa & Ghế thư giãn","slug": "sofa-ghe-thu-gian", "parent_id": 1,    "sort_order": 10},
    {"id": 8,  "name": "Bàn trà & Kệ tivi",  "slug": "ban-tra-ke-tivi",   "parent_id": 1,    "sort_order": 20},
    {"id": 10, "name": "Giường ngủ",         "slug": "giuong-ngu",        "parent_id": 2,    "sort_order": 10},
    {"id": 11, "name": "Tủ quần áo",         "slug": "tu-quan-ao",        "parent_id": 2,    "sort_order": 20},
    {"id": 13, "name": "Bàn ăn",             "slug": "ban-an",            "parent_id": 3,    "sort_order": 10},
    {"id": 14, "name": "Ghế ăn",             "slug": "ghe-an",            "parent_id": 3,    "sort_order": 20},
    {"id": 16, "name": "Bàn làm việc",       "slug": "ban-lam-viec",      "parent_id": 4,    "sort_order": 10},
    {"id": 17, "name": "Ghế văn phòng",      "slug": "ghe-van-phong",     "parent_id": 4,    "sort_order": 20},
    {"id": 18, "name": "Kệ sách",            "slug": "ke-sach",           "parent_id": 4,    "sort_order": 30},
]

FAKE_REVIEW_COMMENTS = [
    "Sản phẩm rất đẹp, chất lượng tốt, đóng gói cẩn thận.",
    "Hài lòng với sản phẩm này, giao hàng nhanh.",
    "Chất liệu tốt, đúng như mô tả, sẽ mua lại.",
    "Sản phẩm ổn, lắp ráp dễ, nhìn sang trọng.",
    "Mua về rất vừa ý, không gian nhà thêm phần hiện đại.",
    "Giá cả hợp lý, chất lượng xứng đáng.",
    "Màu sắc đẹp, kích thước phù hợp phòng khách.",
    "Giao hàng đúng hẹn, sản phẩm nguyên vẹn.",
    "Thiết kế tinh tế, phù hợp phong cách minimalist.",
    "Gia đình rất thích, sẽ giới thiệu cho bạn bè.",
    "Chất gỗ tốt, bền chắc, đáng tiền.",
    "Nhân viên tư vấn nhiệt tình, sản phẩm như kỳ vọng.",
]


# ══════════════════════════════════════════════════════════════
# HELPERS
# ══════════════════════════════════════════════════════════════
def slugify(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text.lower())
    ascii_text = normalized.encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", "-", ascii_text).strip("-")


def parse_price(text: str):
    if not text:
        return None
    cleaned = re.sub(r"[^\d]", "", str(text))
    if not cleaned:
        return None
    val = float(cleaned)
    return val if 100_000 <= val <= 500_000_000 else None


def fix_image_url(src: str, base_url: str = "") -> str | None:
    if not src or src.startswith("data:"):
        return None
    src = src.strip()
    if src.startswith("//"):
        src = "https:" + src
    elif src.startswith("/"):
        # extract domain from base_url
        m = re.match(r"(https?://[^/]+)", base_url)
        domain = m.group(1) if m else ""
        src = domain + src
    # remove thumbnail resize params (blanc.vn pattern)
    src = re.sub(r"/thumb/[^/]+/", "/", src)
    src = re.sub(r"_\d+x\d*\.", ".", src)
    return src if src.startswith("http") else None


def normalize_url(href: str, base_url: str) -> str | None:
    if not href or href.startswith(("javascript:", "#", "tel:", "mailto:")):
        return None
    return urljoin(base_url, href.strip())


def clean_text(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def parse_simple_int(value: str | None, default: int = 0) -> int:
    if value is None:
        return default
    digits = re.sub(r"[^\d-]", "", str(value))
    if not digits or digits == "-":
        return default
    try:
        return int(digits)
    except ValueError:
        return default


def extract_dimensions(text: str) -> dict:
    """Trích kích thước W×D×H hoặc dạng 'Rộng 120cm, Sâu 60cm, Cao 75cm'."""
    dims = {"width_cm": None, "depth_cm": None, "height_cm": None}
    if not text:
        return dims
    # Dạng WxDxH (e.g. 120x60x75)
    m = re.search(r"(\d+(?:[.,]\d+)?)\s*[xX×]\s*(\d+(?:[.,]\d+)?)\s*[xX×]\s*(\d+(?:[.,]\d+)?)", text)
    if m:
        dims["width_cm"]  = float(m.group(1).replace(",", "."))
        dims["depth_cm"]  = float(m.group(2).replace(",", "."))
        dims["height_cm"] = float(m.group(3).replace(",", "."))
        return dims
    # Dạng từ khóa
    patterns = {
        "width_cm":  r"(?:r[oộ]ng|w(?:idth)?)[:\s]*(\d+(?:[.,]\d+)?)\s*(?:cm)?",
        "depth_cm":  r"(?:s[aâ]u|d(?:epth)?)[:\s]*(\d+(?:[.,]\d+)?)\s*(?:cm)?",
        "height_cm": r"(?:cao|h(?:eight)?)[:\s]*(\d+(?:[.,]\d+)?)\s*(?:cm)?",
    }
    text_lower = text.lower()
    for key, pat in patterns.items():
        m = re.search(pat, text_lower)
        if m:
            dims[key] = float(m.group(1).replace(",", "."))
    return dims


def random_delay():
    time.sleep(random.uniform(CONFIG["delay_min"], CONFIG["delay_max"]))


def _random_rating() -> int:
    """Trả về rating ngẫu nhiên 4 hoặc 5 khi không có đánh giá thực."""
    return random.choice([4, 5])


def random_ua() -> str:
    return random.choice(USER_AGENTS)


# ══════════════════════════════════════════════════════════════
# SELENIUM DRIVER
# ══════════════════════════════════════════════════════════════
def make_driver() -> webdriver.Chrome:
    if not all([webdriver, Options, Service, By, WebDriverWait, ChromeDriverManager]):
        raise RuntimeError(
            "Selenium dependencies are not installed. Run `pip install -r requirements.txt` "
            "or crawl a requests-only site such as `--site hoaphat`."
        )
    opts = Options()
    if CONFIG["headless"]:
        opts.add_argument("--headless=new")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument("--disable-gpu")
    opts.add_argument("--window-size=1280,900")
    opts.add_argument("--log-level=3")
    opts.add_argument(f"user-agent={random_ua()}")
    opts.add_experimental_option("excludeSwitches", ["enable-automation"])
    opts.add_experimental_option("useAutomationExtension", False)

    # Thử dùng chromedriver.exe local trước, fallback sang webdriver-manager
    local_driver = SCRIPT_DIR / "chromedriver.exe"
    if local_driver.exists():
        print(f"  ✅ Dùng chromedriver local: {local_driver}")
        service = Service(executable_path=str(local_driver))
    else:
        print("  ⚡ Dùng webdriver-manager tải chromedriver...")
        service = Service(ChromeDriverManager().install())

    driver = webdriver.Chrome(service=service, options=opts)
    driver.execute_cdp_cmd(
        "Page.addScriptToEvaluateOnNewDocument",
        {"source": "Object.defineProperty(navigator,'webdriver',{get:()=>undefined})"},
    )
    return driver


def selenium_soup(driver: webdriver.Chrome, url: str, wait_selectors: list[str], timeout: int = None) -> BeautifulSoup | None:
    try:
        driver.get(url)
        t = timeout or CONFIG["page_timeout"]
        WebDriverWait(driver, t).until(
            lambda d: any(d.find_elements(By.CSS_SELECTOR, s) for s in wait_selectors)
        )
        return BeautifulSoup(driver.page_source, _BS4_PARSER)
    except Exception as e:
        print(f"    ⚠️  Selenium timeout/error: {e.__class__.__name__}")
        return None


# ══════════════════════════════════════════════════════════════
# REQUESTS HELPER (cho site static HTML)
# ══════════════════════════════════════════════════════════════
def requests_soup(url: str) -> BeautifulSoup | None:
    headers = {
        "User-Agent": random_ua(),
        "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Referer": "https://www.google.com/",
    }
    try:
        r = requests.get(url, headers=headers, timeout=15)
        if r.status_code == 200:
            return BeautifulSoup(r.text, _BS4_PARSER)
        print(f"    ⚠️  HTTP {r.status_code}")
        return None
    except Exception as e:
        print(f"    ⚠️  Request error: {e.__class__.__name__}")
        return None


# ══════════════════════════════════════════════════════════════
# BASE CRAWLER CLASS
# ══════════════════════════════════════════════════════════════
class BaseCrawler:
    SITE_KEY   = ""       # định danh ngắn (blanc | hoaphat | hoaphat2 | cdc)
    BASE_URL   = ""
    USE_SELENIUM = True   # False = dùng requests (site HTML tĩnh)
    CATEGORY_URLS: list[tuple[str, int]] = []  # (path, category_id)
    MAX_PAGES  = 5

    def __init__(self, driver: webdriver.Chrome | None = None):
        self.driver = driver  # None nếu USE_SELENIUM=False

    # --- override trong subclass ---
    def get_product_links(self, category_path: str) -> list[str]:
        raise NotImplementedError

    def parse_product(self, url: str, category_id: int) -> dict | None:
        raise NotImplementedError

    # --- shared ---
    def _soup_selenium(self, url: str, wait_selectors: list[str]) -> BeautifulSoup | None:
        return selenium_soup(self.driver, url, wait_selectors)

    def _soup_requests(self, url: str) -> BeautifulSoup | None:
        return requests_soup(url)


# ══════════════════════════════════════════════════════════════
# SITE 1: blanc.vn  (JavaScript render → Selenium)
# ══════════════════════════════════════════════════════════════
class BlancCrawler(BaseCrawler):
    SITE_KEY     = "blanc"
    BASE_URL     = "https://blanc.vn"
    USE_SELENIUM = True
    CATEGORY_URLS = [
        ("/sofa",           7),
        ("/ghe-thu-gian",   7),
        ("/ban-tra",        8),
        ("/ke-tivi",        8),
        ("/giuong-ngu",    10),
        ("/tu-quan-ao",    11),
        ("/ban-an",        13),
        ("/ghe-an",        14),
        ("/ban-lam-viec",  16),
        ("/ghe-van-phong", 17),
        ("/ke-sach",       18),
    ]

    def _extract_image_url(self, style: str) -> str | None:
        m = re.search(r'url\((["\']?)(.*?)\1\)', style or "")
        return fix_image_url(m.group(2).strip(), self.BASE_URL) if m else None

    def get_product_links(self, category_path: str) -> list[str]:
        links, seen = [], set()
        for page in range(1, self.MAX_PAGES + 1):
            url  = f"{self.BASE_URL}{category_path}?page={page}"
            print(f"    📄 {url}")
            soup = self._soup_selenium(url, ["a.link_product", ".box_product", ".content_product_tab a"])
            if not soup:
                break
            anchors = soup.select("a.link_product[href]") or soup.select(".content_product_tab > a[href]")
            new = 0
            for a in anchors:
                href = a.get("href", "").strip()
                if not href or href.startswith("javascript"):
                    continue
                full = href if href.startswith("http") else self.BASE_URL + "/" + href.lstrip("/")
                if full not in seen and "blanc.vn" in full:
                    seen.add(full); links.append(full); new += 1
            print(f"       → {new} link mới (tổng: {len(links)})")
            if new == 0:
                break
            random_delay()
        return links

    def parse_product(self, url: str, category_id: int) -> dict | None:
        soup = self._soup_selenium(
            url,
            [".title_product_Details", "h1", "#price_pro", ".des_right_details_product"],
        )
        if not soup:
            return None
        try:
            name_el = soup.select_one(".title_product_Details") or soup.select_one("h1")
            name = clean_text(name_el.get_text()) if name_el else None
            if not name or len(name) < 3:
                return None

            price_el   = soup.select_one("#price_pro") or soup.select_one(".price_pro")
            compare_el = soup.select_one("#compare_at_price_pro")
            current    = parse_price(price_el.get_text() if price_el else "")
            compare    = parse_price(compare_el.get_text() if compare_el else "")
            price, sale_price = int(current or 0), None
            if compare and current and compare > current:
                price, sale_price = int(compare), int(current)

            desc_parts = []
            for sel in [".des_right_details_product", ".description_detail_product"]:
                el = soup.select_one(sel)
                if el:
                    t = clean_text(el.get_text(" ", strip=True))
                    if t and t not in desc_parts:
                        desc_parts.append(t)
            description = " ".join(desc_parts)[:1000]

            # Kích thước
            dims_text = clean_text(soup.get_text(" "))
            dims = extract_dimensions(dims_text)

            # Chất liệu + brand
            material = None
            desc_detail = soup.select_one(".description_detail_product")
            if desc_detail:
                mats = []
                for item in desc_detail.select("li"):
                    label_el = item.select_one("div span")
                    label = slugify(clean_text(label_el.get_text())) if label_el else ""
                    value_el = item.select_one("strong")
                    value = clean_text(value_el.get_text()) if value_el else ""
                    if not value:
                        continue
                    if "chat-lieu" in label:
                        mats.append(value)
                if mats:
                    material = " / ".join(mats)[:100]

            # Rating (nếu có)
            rating_el = soup.select_one(".rating-value, [itemprop='ratingValue'], .star-rating")
            rating = None
            if rating_el:
                try:
                    raw = float(clean_text(rating_el.get_text()).replace(",", "."))
                    rating = _random_rating() if raw <= 0 else min(5.0, max(1.0, raw))
                except Exception:
                    rating = _random_rating()
            if rating is None:
                rating = _random_rating()

            # Ảnh
            images, seen_img = [], set()
            for block in soup.select(".left_wp_main_details_product .pro-image"):
                src = self._extract_image_url(block.get("style", ""))
                if not src:
                    continue
                fname = src.split("/")[-1].split("?")[0]
                if fname not in seen_img:
                    seen_img.add(fname); images.append(src)
                if len(images) >= 5:
                    break
            if len(images) < 5:
                for img in soup.select(".description_detail_product .list_img_des img"):
                    src = fix_image_url(
                        img.get("src") or img.get("data-src") or img.get("data-lazy", ""),
                        self.BASE_URL,
                    )
                    if not src:
                        continue
                    fname = src.split("/")[-1].split("?")[0]
                    if fname not in seen_img:
                        seen_img.add(fname); images.append(src)
                    if len(images) >= 5:
                        break

            return {
                "name": name, "url": url, "slug": slugify(name),
                "category_id": category_id, "price": price, "sale_price": sale_price,
                "description": description, "material": material or "Chưa cập nhật",
                "brand": "Blanc", "images": images,
                "rating": rating, **dims,
                "stock": random.randint(5, 100), "sold": random.randint(0, 300),
                "view_count": random.randint(50, 5000),
            }
        except Exception as e:
            print(f"    ❌ Parse lỗi: {e}")
            return None


# ══════════════════════════════════════════════════════════════
# SITE 2: noithathoaphat.vn  (static HTML → requests)
# ══════════════════════════════════════════════════════════════
class HoaphatVnCrawler(BaseCrawler):
    SITE_KEY     = "hoaphat"
    BASE_URL     = "https://noithathoaphat.com"
    USE_SELENIUM = False
    CATEGORY_URLS = [
        ("/sofa-van-phong",     7),   # Sofa văn phòng → cat 7
        ("/ghe-sofa",           7),   # Ghế sofa phòng khách → cat 7
        ("/ban-sofa",           8),
        ("/giuong-ngu",        10),   # Giường ngủ → cat 10
        ("/tu-quan-ao",        11),
        ("/ban-ghe-an",        13),   # Bàn ăn – _infer_category_id sẽ tách ghế sang cat 14
        ("/ban-ghe-an",        14),   # Probe lần 2 với hint ghế ăn (infer đảm bảo tách)
        ("/ban-lam-viec",      16),
        ("/ghe-van-phong",     17),
    ]

    def _request_soup(self, url: str, method: str = "get", data: dict | None = None) -> BeautifulSoup | None:
        headers = {
            "User-Agent": random_ua(),
            "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
            "Referer": self.BASE_URL,
        }
        try:
            if method == "post":
                resp = requests.post(url, headers=headers, data=data or {}, timeout=20)
            else:
                resp = requests.get(url, headers=headers, timeout=20)
            if resp.status_code == 200:
                return BeautifulSoup(resp.text, "lxml")
            print(f"    ⚠️  HTTP {resp.status_code}: {url}")
        except Exception as e:
            print(f"    ⚠️  Request error ({method.upper()} {url}): {e.__class__.__name__}")
        return None

    def _is_error_page(self, soup: BeautifulSoup | None) -> bool:
        if not soup:
            return True
        title = clean_text(soup.title.get_text(" ")) if soup.title else ""
        return "404" in title or "file or directory not found" in title.lower()

    def _extract_listing_links(self, soup: BeautifulSoup) -> list[str]:
        links = []
        seen = set()
        for item in soup.select(".slider-list-product .item"):
            anchor = item.select_one(".text h3 a[href]") or item.select_one(".img a[href]")
            if not anchor:
                continue
            full = normalize_url(anchor.get("href", ""), self.BASE_URL)
            if not full or full in seen or not full.startswith(self.BASE_URL):
                continue
            seen.add(full)
            links.append(full)
        return links

    def _extract_loadmore_state(self, soup: BeautifulSoup) -> dict | None:
        trigger = soup.select_one(".show.loadmore a[onclick]")
        if not trigger:
            return None
        onclick = trigger.get("onclick", "")
        match = re.search(
            r"loadMoreContent\('(?P<page>\d+)'\s*,\s*'(?P<slug>[^']+)'\s*,\s*'(?P<module>\d+)'\s*,\s*'(?P<filter>[^']*)'\)",
            onclick,
        )
        if not match:
            return None
        return match.groupdict()

    def _extract_detail_rows(self, soup: BeautifulSoup) -> list[tuple[str, str]]:
        rows = []
        for tr in soup.select(".content table tr"):
            cells = [clean_text(cell.get_text(" ")) for cell in tr.select("td, th")]
            if len(cells) >= 2 and cells[0] and cells[1]:
                rows.append((cells[0].rstrip(" :"), cells[1]))

        if rows:
            return rows

        paragraphs = []
        for p in soup.select(".content p"):
            text = clean_text(p.get_text(" "))
            if not text:
                continue
            paragraphs.append(text)

        for idx, text in enumerate(paragraphs):
            if ":" not in text:
                continue
            key, value = text.split(":", 1)
            key = key.strip()
            value = value.strip()
            if not value and idx + 1 < len(paragraphs) and ":" not in paragraphs[idx + 1]:
                value = paragraphs[idx + 1]
            if key and value:
                rows.append((key, value))
        return rows

    def _build_variants(self, soup: BeautifulSoup, base_price: int, sku_codes: list[str]) -> list[dict]:
        variants = []
        attr_groups = soup.select(".attrgroup .attr")
        if attr_groups:
            base_sku = sku_codes[0] if sku_codes else None
            for attr in attr_groups:
                attr_name_el = attr.select_one("p")
                attr_name = clean_text(attr_name_el.get_text()) if attr_name_el else ""
                is_color = "màu" in attr_name.lower()
                is_size = any(word in attr_name.lower() for word in ["kích thước", "size", "rộng", "dài"])
                for idx, label in enumerate(attr.select("label.opt"), start=1):
                    option_text = clean_text(label.get_text(" "))
                    if not option_text:
                        continue
                    input_el = label.select_one("input")
                    price_delta = parse_simple_int(input_el.get("data-price")) if input_el else 0
                    variants.append(
                        {
                            "color": option_text[:50] if is_color else None,
                            "size": option_text[:50] if is_size or not is_color else None,
                            "price": base_price + price_delta if base_price else None,
                            "stock": random.randint(2, 30),
                            "sku": f"{base_sku}-{idx}" if base_sku else None,
                        }
                    )
            return variants

        if len(sku_codes) > 1:
            for sku in sku_codes:
                variants.append(
                    {
                        "color": None,
                        "size": None,
                        "price": base_price or None,
                        "stock": random.randint(2, 30),
                        "sku": sku[:100],
                    }
                )
        return variants

    # Từ khóa nhận dạng ghế ăn (ưu tiên tên sản phẩm)
    _CHAIR_KEYWORDS = (
        "ghế ăn", "ghế bàn ăn", "ghế ngồi ăn", "ghế gỗ ăn", "ghế mây ăn",
        "ghế nệm", "ghế tựa", "ghế lưng",
    )
    _CHAIR_PREFIXES = ("ghế",)  # tên bắt đầu bằng "ghế" (nếu thuộc cat phòng ăn)

    def _infer_category_id(self, category_id: int, name: str) -> int:
        """Tách bàn ăn (13) và ghế ăn (14) từ danh mục /ban-ghe-an gộp chung."""
        if category_id not in (13, 14):
            return category_id
        lower_name = clean_text(name).lower()
        # Bất kỳ từ khóa nào liên quan ghế → cat 14
        if any(kw in lower_name for kw in self._CHAIR_KEYWORDS):
            return 14
        # Tên BẮT ĐẦU bằng "ghế" trong nhóm phòng ăn → cat 14
        if any(lower_name.startswith(p) for p in self._CHAIR_PREFIXES):
            return 14
        # Bộ bàn ghế, bộ bàn ăn → cat 13
        if any(kw in lower_name for kw in ("bộ bàn", "bàn ăn", "bàn gỗ", "bàn mdf")):
            return 13
        # Fallback: hint gốc từ CATEGORY_URLS
        return category_id

    def get_product_links(self, category_path: str) -> list[str]:
        links, seen = [], set()
        category_url = f"{self.BASE_URL}{category_path}"
        print(f"    📄 {category_url}")
        soup = self._request_soup(category_url)
        if not soup or self._is_error_page(soup):
            return links

        def append_links(page_soup: BeautifulSoup) -> int:
            new_links = 0
            for full in self._extract_listing_links(page_soup):
                if full not in seen:
                    seen.add(full)
                    links.append(full)
                    new_links += 1
            return new_links

        new = append_links(soup)
        print(f"       → {new} link mới (tổng: {len(links)})")

        state = self._extract_loadmore_state(soup)
        page_count = 1
        while state and page_count < self.MAX_PAGES:
            page_count += 1
            payload = {
                "page": state["page"],
                "nameascii": state["slug"],
                "moduleIds": state["module"],
                "filter": state["filter"],
            }
            print(f"    ↳ AJAX page {payload['page']} | slug={payload['nameascii']} | module={payload['moduleIds']}")
            ajax_soup = self._request_soup(
                f"{self.BASE_URL}/Ajax/Content/LoadMore",
                method="post",
                data=payload,
            )
            if not ajax_soup:
                break
            new = append_links(ajax_soup)
            print(f"       → {new} link mới (tổng: {len(links)})")
            if new == 0:
                break
            state = self._extract_loadmore_state(ajax_soup)
            random_delay()
        return links

    def parse_product(self, url: str, category_id: int) -> dict | None:
        soup = self._request_soup(url)
        if not soup or self._is_error_page(soup):
            return None
        try:
            detail_root = soup.select_one(".detail-content-product") or soup
            name_el = detail_root.select_one(".tit-product h1") or detail_root.select_one("h1")
            name = clean_text(name_el.get_text()) if name_el else None
            if not name or len(name) < 3:
                return None

            sku_line = next(
                (p for p in detail_root.select(".item-1 p") if "mã hàng" in clean_text(p.get_text(" ")).lower()),
                None,
            )
            sku_codes = []
            if sku_line:
                sku_text = clean_text(sku_line.get_text(" "))
                _, _, sku_value = sku_text.partition(":")
                sku_codes = [part.strip()[:100] for part in sku_value.split(",") if part.strip()]

            price_el = detail_root.select_one("#CurrentPrice") or detail_root.select_one(".item-1 .gia")
            current = parse_price(price_el.get_text() if price_el else "")
            price = int(current or 0)
            sale_price = None

            detail_rows = self._extract_detail_rows(soup)
            detail_map = {clean_text(key).lower(): clean_text(value) for key, value in detail_rows}

            content_root = soup.select_one(".content")
            description = clean_text(content_root.get_text(" ")) if content_root else ""
            description = re.sub(r"\s*Sản phẩm cùng danh mục.*$", "", description, flags=re.IGNORECASE)
            description = description[:2000]

            dim_source = " ".join(
                value for key, value in detail_rows if "kích thước" in clean_text(key).lower()
            )
            if not dim_source:
                dim_source = description
            dims = extract_dimensions(dim_source + " " + description)

            brand = "Hòa Phát"
            material = None
            for key, value in detail_rows:
                normalized_key = clean_text(key).lower()
                if "chất liệu" in normalized_key or "vật liệu" in normalized_key:
                    material = value[:100]
                    break

            rating = None
            review_text = clean_text(detail_root.get_text(" "))
            review_match = re.search(r"(\d+(?:[.,]\d+)?)\s*đánh giá", review_text, re.IGNORECASE)
            if review_match:
                try:
                    raw = float(review_match.group(1).replace(",", "."))
                    rating = _random_rating() if raw <= 0 else min(5.0, max(1.0, raw))
                except ValueError:
                    rating = None
            if rating is None:
                rating = _random_rating()

            images, seen_img = [], set()
            for img in detail_root.select("#imageGallery img, .gotoGallery1 img, .slider-sp img"):
                src = fix_image_url(
                    img.get("src") or img.get("data-src") or img.get("data-original", ""),
                    self.BASE_URL,
                )
                if not src:
                    continue
                src_lower = src.lower()
                if "/uploads/images/" not in src_lower:
                    continue
                if any(x in src_lower for x in ["logo", "banner", "showroom", "duantieubieu", "tieuchuanchatluong", "thanhtuunoibat"]):
                    continue
                fname = src.split("/")[-1].split("?")[0]
                if fname not in seen_img:
                    seen_img.add(fname)
                    images.append(src)
                if len(images) >= 5:
                    break

            if not images:
                og_image = soup.select_one("meta[property='og:image']")
                src = fix_image_url(og_image.get("content", "") if og_image else "", self.BASE_URL)
                if src:
                    images.append(src)

            variants = self._build_variants(soup, price, sku_codes)

            return {
                "name": name, "url": url, "slug": slugify(name),
                "category_id": self._infer_category_id(category_id, name),
                "price": price, "sale_price": sale_price,
                "description": description, "material": material or "Chưa cập nhật",
                "brand": brand, "images": images,
                "rating": rating, **dims,
                "variants": variants,
                "stock": random.randint(5, 100), "sold": random.randint(0, 300),
                "view_count": random.randint(50, 5000),
            }
        except Exception as e:
            print(f"    ❌ Parse lỗi: {e}")
            return None


# ══════════════════════════════════════════════════════════════
# SITE 3: noithathoaphat.com.vn  (static HTML → requests)
# ══════════════════════════════════════════════════════════════
class HoaphatComVnCrawler(BaseCrawler):
    SITE_KEY     = "hoaphat2"
    BASE_URL     = "https://noithathoaphat.com.vn"
    USE_SELENIUM = False
    CATEGORY_URLS = [
        # Phòng khách – đã verify 200 OK
        ("/categories/Sofa-v%C4%83n-ph%C3%B2ng/",                                                7),   # Sofa văn phòng
        ("/categories/Sofa-v%C4%83n-ph%C3%B2ng/Gh%E1%BA%BF-Sofa/",                              7),   # Ghế Sofa
        ("/categories/N%E1%BB%99i-Th%E1%BA%A5t-Gia-%C4%90%C3%ACnh/Sofa-Gia-%C4%90%C3%ACnh/",  7),   # Sofa gia đình
        ("/categories/N%E1%BB%99i-Th%E1%BA%A5t-Gia-%C4%90%C3%ACnh/Gh%E1%BA%BF-Th%C6%B0-Gi%C3%A3n/", 7), # Ghế thư giãn
        # Phòng ngủ
        ("/categories/Gi%C6%B0%E1%BB%9Dng-H%C3%B2a-Ph%C3%A1t/",                                10),   # Giường Hòa Phát
        # Phòng ăn (gộp chung, _infer_cat tự tách)
        ("/categories/N%E1%BB%99i-Th%E1%BA%A5t-Gia-%C4%90%C3%ACnh/B%C3%A0n-Gh%E1%BA%BF-%C4%82n-H%C3%B2a-Ph%C3%A1t/", 13),
        # Văn phòng
        ("/categories/B%C3%80N-L%C3%80M-VI%E1%BB%86C-H%C3%92A-PH%C3%81T/",                    16),   # Bàn làm việc
    ]

    _CHAIR_KEYWORDS = ("ghế ăn", "ghế bàn ăn", "ghế ngồi", "ghế nệm", "ghế tựa")

    def _infer_cat(self, category_id: int, name: str) -> int:
        """Tách bàn ăn (13) / ghế ăn (14) khi danh mục gộp chung."""
        if category_id not in (13, 14):
            return category_id
        lower = clean_text(name).lower()
        if any(kw in lower for kw in self._CHAIR_KEYWORDS) or lower.startswith("ghế"):
            return 14
        return 13

    def get_product_links(self, category_path: str) -> list[str]:
        links, seen = [], set()
        for page in range(1, self.MAX_PAGES + 1):
            url = f"{self.BASE_URL}{category_path}?page={page}"
            print(f"    📄 {url}")
            soup = self._soup_requests(url)
            if not soup:
                break
            # noithathoaphat.com.vn: mỗi sản phẩm có link chứa /products/
            # Cấu trúc: ul.ProductList > li.ProductItem > a[href*='/products/']
            anchors = soup.select("a[href*='/products/']")
            new = 0
            seen_this_page = set()
            for a in anchors:
                href = a.get("href", "").strip()
                if not href or href.startswith("javascript") or href == "#":
                    continue
                full = href if href.startswith("http") else self.BASE_URL + "/" + href.lstrip("/")
                # Loại bỏ duplicate trên cùng 1 trang (mỗi sản phẩm có 2 link: ảnh + tên)
                if full in seen_this_page:
                    continue
                seen_this_page.add(full)
                if full not in seen and "noithathoaphat.com.vn" in full:
                    seen.add(full)
                    links.append(full)
                    new += 1
            print(f"       → {new} link mới (tổng: {len(links)})")
            if new == 0:
                break
            random_delay()
        return links

    def parse_product(self, url: str, category_id: int) -> dict | None:
        soup = self._soup_requests(url)
        if not soup:
            return None
        try:
            # Tên sản phẩm – noithathoaphat.com.vn dùng <h1> trực tiếp
            name_el = soup.select_one(".ProductName h1") or soup.select_one("h1")
            name = clean_text(name_el.get_text()) if name_el else None
            if not name or len(name) < 3:
                return None

            # Giá – .VariationProductPrice hoặc .ProductPrice
            price_el = (
                soup.select_one(".VariationProductPrice") or
                soup.select_one(".ProductPrice")
            )
            current = parse_price(price_el.get_text() if price_el else "")
            price = int(current or 0)

            # Mô tả – .ProductDescriptionContainer
            desc_el = (
                soup.select_one(".ProductDescriptionContainer") or
                soup.select_one(".ProductDescription") or
                soup.select_one("#ProductDescription")
            )
            description = clean_text(desc_el.get_text(" ")) if desc_el else ""
            description = description[:1500]

            # Kích thước
            full_text = description + " " + clean_text(soup.get_text(" "))
            dims = extract_dimensions(full_text)

            # Chất liệu – tìm trong .ProductDescriptionContainer
            material = None
            if desc_el:
                desc_text = desc_el.get_text(" ")
                for line in desc_text.split("\n"):
                    line_lower = line.lower()
                    if "chất liệu" in line_lower or "vật liệu" in line_lower:
                        if ":" in line:
                            material = line.split(":", 1)[-1].strip()[:100]
                        break
            # Fallback: tìm trong bảng thông số .ProductDetailsGrid
            if not material:
                for row in soup.select(".ProductDetailsGrid .DetailRow"):
                    label_el = row.select_one(".Label")
                    value_el = row.select_one(".Value")
                    if label_el and value_el:
                        label_txt = clean_text(label_el.get_text()).lower()
                        if "chất liệu" in label_txt or "vật liệu" in label_txt:
                            material = clean_text(value_el.get_text())[:100]
                            break

            # Rating – .ProductRating chứa img với alt="N stars"
            rating = None
            rating_el = soup.select_one(".ProductRating")
            if rating_el:
                img_el = rating_el.select_one("img[alt]")
                if img_el:
                    alt_text = img_el.get("alt", "")
                    m = re.search(r"(\d+(?:[.,]\d+)?)", alt_text)
                    if m:
                        try:
                            raw = float(m.group(1).replace(",", "."))
                            rating = _random_rating() if raw <= 0 else min(5.0, max(1.0, raw))
                        except Exception:
                            pass
            if rating is None:
                rating = _random_rating()

            # Ảnh sản phẩm – .ProductTinyImageList li img (thumbnails)
            images, seen_img = [], set()
            for img in soup.select(".ProductTinyImageList li img, #TinyImageBox_0 img"):
                src = fix_image_url(
                    img.get("src") or img.get("data-src") or img.get("data-original", ""),
                    self.BASE_URL,
                )
                if not src or any(x in src.lower() for x in ["icon", "logo", "banner"]):
                    continue
                fname = src.split("/")[-1].split("?")[0]
                if fname not in seen_img:
                    seen_img.add(fname)
                    images.append(src)
                if len(images) >= 5:
                    break

            # Fallback: ảnh chính trong .ProductThumb
            if not images:
                for img in soup.select(".ProductThumb img"):
                    src = fix_image_url(
                        img.get("src") or img.get("data-src", ""),
                        self.BASE_URL,
                    )
                    if src and not any(x in src.lower() for x in ["icon", "logo", "banner"]):
                        fname = src.split("/")[-1].split("?")[0]
                        if fname not in seen_img:
                            seen_img.add(fname)
                            images.append(src)
                        if len(images) >= 5:
                            break

            # Fallback ảnh từ og:image
            if not images:
                og = soup.select_one("meta[property='og:image']")
                src = fix_image_url(og.get("content", "") if og else "", self.BASE_URL)
                if src:
                    images.append(src)

            return {
                "name": name, "url": url, "slug": slugify(name),
                "category_id": self._infer_cat(category_id, name),
                "price": price, "sale_price": None,
                "description": description, "material": material or "Chưa cập nhật",
                "brand": "Hòa Phát", "images": images,
                "rating": rating, **dims,
                "stock": random.randint(5, 100), "sold": random.randint(0, 300),
                "view_count": random.randint(50, 5000),
            }
        except Exception as e:
            print(f"    ❌ Parse lỗi: {e}")
            return None



# ══════════════════════════════════════════════════════════════
# CHECKPOINT / RESUME
# ══════════════════════════════════════════════════════════════
def load_checkpoint() -> dict:
    path = CONFIG["checkpoint"]
    if path.exists():
        try:
            with open(path, "rb") as f:
                ck = pickle.load(f)
            print(f"📂 Đã tải checkpoint: {ck['total']} sản phẩm đã crawl")
            return ck
        except Exception:
            pass
    return {"products": [], "done_urls": set(), "total": 0}


def save_checkpoint(ck: dict):
    with open(CONFIG["checkpoint"], "wb") as f:
        pickle.dump(ck, f)


def clear_checkpoint():
    p = CONFIG["checkpoint"]
    if p.exists():
        p.unlink()


# ══════════════════════════════════════════════════════════════
# SQL GENERATOR
# ══════════════════════════════════════════════════════════════
COLORS = ["Nâu walnut", "Trắng tinh", "Đen tuyền", "Xám bạc", "Be sữa", "Tự nhiên"]
SIZES  = ["Nhỏ (S)", "Vừa (M)", "Lớn (L)"]

FAKE_NAMES = [f"Khách hàng {i}" for i in range(1, CONFIG["fake_users"] + 1)]


class SQLGenerator:
    def __init__(self):
        self.product_id    = 1
        self.image_count   = 0
        self.variant_count = 0
        self.review_count  = 0
        self.interaction_count = 0
        self.used_slugs    = set()
        self.lines: list[str] = []

    def header(self):
        self.lines += [
            "-- ============================================",
            f"-- DAVINCI – Multi-site crawl",
            f"-- {datetime.now().strftime('%Y-%m-%d %H:%M')}",
            "-- ============================================",
            "SET NOCOUNT ON;",
            "",
            "-- Xóa dữ liệu cũ (giữ đúng thứ tự FK)",
            "DELETE FROM UserInteractions;",
            "DELETE FROM Reviews;",
            "DELETE FROM ProductVariants;",
            "DELETE FROM ProductImages;",
            "DELETE FROM OrderItems;",
            "DELETE FROM CartItems;",
            "DELETE FROM Wishlists;",
            "DELETE FROM Products;",
            "",
            "DBCC CHECKIDENT ('UserInteractions', RESEED, 0);",
            "DBCC CHECKIDENT ('Reviews',          RESEED, 0);",
            "DBCC CHECKIDENT ('ProductVariants',  RESEED, 0);",
            "DBCC CHECKIDENT ('ProductImages',    RESEED, 0);",
            "DBCC CHECKIDENT ('Products',         RESEED, 0);",
            "",
            "-- Seed categories",
            "SET IDENTITY_INSERT Categories ON;",
        ]
        for cat in CATEGORY_DEFINITIONS:
            pid = "NULL" if cat["parent_id"] is None else str(cat["parent_id"])
            n   = cat["name"].replace("'", "''")
            self.lines.append(
                f"IF EXISTS (SELECT 1 FROM Categories WHERE id={cat['id']}) "
                f"UPDATE Categories SET name=N'{n}',slug='{cat['slug']}',"
                f"parent_id={pid},sort_order={cat['sort_order']},is_active=1 "
                f"WHERE id={cat['id']}; "
                f"ELSE INSERT INTO Categories(id,name,slug,parent_id,image,sort_order,is_active) "
                f"VALUES({cat['id']},N'{n}','{cat['slug']}',{pid},NULL,{cat['sort_order']},1);"
            )
        self.lines += [
            "SET IDENTITY_INSERT Categories OFF;",
            "",
            "-- Seed fake users (cho Reviews & UserInteractions)",
            "-- Chỉ insert nếu chưa tồn tại (tránh lỗi UNIQUE email)",
        ]
        for i in range(1, CONFIG["fake_users"] + 1):
            self.lines.append(
                f"IF NOT EXISTS (SELECT 1 FROM Users WHERE email='fakeuser{i}@davinci.test') "
                f"INSERT INTO Users(name,email,password,role,is_active) "
                f"VALUES(N'Khách hàng {i}','fakeuser{i}@davinci.test',"
                f"'$2b$12$placeholder_hashed_pw','user',1);"
            )
        self.lines += [
            "",
            "SET IDENTITY_INSERT Products ON;",
        ]

    def _null(self, val):
        return "NULL" if val is None else str(val)

    def add_product(self, p: dict):
        base = p["slug"][:200]
        slug, n = base, 1
        while slug in self.used_slugs:
            slug = f"{base}-{n}"; n += 1
        self.used_slugs.add(slug)

        name  = p["name"].replace("'", "''")
        desc  = (p.get("description") or "").replace("'", "''")[:500]
        mat   = (p.get("material") or "Chưa cập nhật").replace("'", "''")
        brand = (p.get("brand") or "").replace("'", "''")
        price = int(p.get("price") or 0)
        sale  = self._null(int(p["sale_price"]) if p.get("sale_price") else None)
        w     = self._null(p.get("width_cm"))
        d     = self._null(p.get("depth_cm"))
        h     = self._null(p.get("height_cm"))

        self.lines.append(
            f"INSERT INTO Products"
            f"(id,name,slug,category_id,description,brand,material,"
            f"width_cm,depth_cm,height_cm,"
            f"price,sale_price,stock,sold,is_featured,is_active,created_at,updated_at) "
            f"VALUES({self.product_id},N'{name}','{slug}',{p['category_id']},"
            f"N'{desc}',N'{brand}',N'{mat}',"
            f"{w},{d},{h},"
            f"{price},{sale},{p['stock']},{p['sold']},0,1,GETDATE(),GETDATE());"
        )

        # Images
        for idx, img in enumerate(p.get("images", [])[:5]):
            self.lines.append(
                f"INSERT INTO ProductImages(product_id,url,public_id,is_primary,sort_order) "
                f"VALUES({self.product_id},'{img}',NULL,{1 if idx==0 else 0},{idx});"
            )
            self.image_count += 1

        # Variants
        variants = p.get("variants") or []
        if variants:
            for idx, variant in enumerate(variants, start=1):
                color = variant.get("color")
                size = variant.get("size")
                variant_price = variant.get("price")
                stock = int(variant.get("stock") or random.randint(2, 30))
                sku = (variant.get("sku") or f"P{self.product_id:04d}-V{idx}")[:100]
                color_escaped = str(color).replace("'", "''") if color else None
                size_escaped = str(size).replace("'", "''") if size else None
                color_sql = f"N'{color_escaped}'" if color_escaped else "NULL"
                size_sql = f"N'{size_escaped}'" if size_escaped else "NULL"
                price_sql = self._null(int(variant_price) if variant_price else None)
                self.lines.append(
                    f"INSERT INTO ProductVariants(product_id,color,size,price,stock,sku) "
                    f"VALUES({self.product_id},{color_sql},{size_sql},{price_sql},{stock},'{sku}');"
                )
                self.variant_count += 1
        else:
            for i in range(2):
                self.lines.append(
                    f"INSERT INTO ProductVariants(product_id,color,size,price,stock,sku) "
                    f"VALUES({self.product_id},"
                    f"N'{COLORS[i]}',N'{SIZES[i]}',NULL,{random.randint(2,30)},'P{self.product_id:04d}-V{i+1}');"
                )
                self.variant_count += 1

        # Fake Reviews
        n_reviews = min(CONFIG["reviews_per_product"], CONFIG["fake_users"])
        user_ids  = random.sample(range(1, CONFIG["fake_users"] + 1), n_reviews)
        rating_raw = p.get("rating")
        for uid in user_ids:
            if rating_raw:
                # Xoay quanh rating thật ±0.5, clamped [1,5]
                r = min(5, max(1, round(rating_raw + random.uniform(-0.5, 0.5))))
            else:
                r = random.choices([3, 4, 4, 5, 5], k=1)[0]
            comment = random.choice(FAKE_REVIEW_COMMENTS).replace("'", "''")
            days_ago = random.randint(1, 180)
            self.lines.append(
                f"INSERT INTO Reviews(product_id,user_id,rating,comment,created_at) "
                f"VALUES({self.product_id},{uid},{r},N'{comment}',DATEADD(day,-{days_ago},GETDATE()));"
            )
            self.review_count += 1

        # Fake UserInteractions (view/wishlist/purchase)
        n_inter = CONFIG["interactions_per_product"]
        user_ids_inter = random.choices(range(1, CONFIG["fake_users"] + 1), k=n_inter)
        view_count = p.get("view_count", random.randint(50, 3000))
        # Phân bổ theo tỉ lệ thực tế: 80% view, 15% wishlist, 5% purchase
        types_scores = (
            [("view", 1.0)] * max(1, round(n_inter * 0.7)) +
            [("wishlist", 3.0)] * max(1, round(n_inter * 0.2)) +
            [("purchase", 5.0)] * max(1, round(n_inter * 0.1))
        )
        random.shuffle(types_scores)
        for uid, (itype, score) in zip(user_ids_inter, types_scores[:n_inter]):
            days_ago = random.randint(0, 365)
            self.lines.append(
                f"INSERT INTO UserInteractions(user_id,product_id,type,score,created_at) "
                f"VALUES({uid},{self.product_id},'{itype}',{score},"
                f"DATEADD(day,-{days_ago},GETDATE()));"
            )
            self.interaction_count += 1

        self.product_id += 1

    def footer(self, products: list[dict]):
        total = self.product_id - 1
        # Tính rating trung bình mỗi sản phẩm để UPDATE
        self.lines += [
            "",
            "SET IDENTITY_INSERT Products OFF;",
            "",
            "-- Cập nhật rating trung bình từ bảng Reviews",
            "UPDATE p SET p.sold = (",
            "    SELECT ISNULL(SUM(CASE type WHEN 'purchase' THEN 1 ELSE 0 END), 0)",
            "    FROM UserInteractions WHERE product_id = p.id",
            ") FROM Products p;",
            "",
            f"-- Tổng kết: {total} sản phẩm | {self.image_count} ảnh | "
            f"{self.variant_count} variants | {self.review_count} reviews | "
            f"{self.interaction_count} interactions",
            "SELECT COUNT(*) AS total_products  FROM Products;",
            "SELECT COUNT(*) AS total_images    FROM ProductImages;",
            "SELECT COUNT(*) AS total_reviews   FROM Reviews;",
            "SELECT COUNT(*) AS total_interactions FROM UserInteractions;",
        ]

    def save(self, path: Path):
        with open(path, "w", encoding="utf-8-sig") as f:
            f.write("\n".join(self.lines))
        print(f"\n✅ SQL saved: {path}  ({len(self.lines)} dòng)")


# ══════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════
ALL_CRAWLERS = {
    "blanc":   BlancCrawler,
    "hoaphat": HoaphatVnCrawler,
    "hoaphat2":HoaphatComVnCrawler,
}


def main():
    parser = argparse.ArgumentParser(description="DaVinci Multi-Site Crawler")
    parser.add_argument("--site",   choices=list(ALL_CRAWLERS.keys()), help="Chỉ crawl 1 site cụ thể")
    parser.add_argument("--resume", action="store_true",               help="Tiếp tục từ checkpoint")
    parser.add_argument("--max",    type=int, default=CONFIG["max_products"], help="Giới hạn số sản phẩm")
    parser.add_argument("--debug",  action="store_true",               help="Hiện Chrome (tắt headless)")
    args = parser.parse_args()

    CONFIG["max_products"] = args.max
    if args.debug:
        CONFIG["headless"] = False

    # Chọn sites cần crawl
    site_keys = [args.site] if args.site else list(ALL_CRAWLERS.keys())
    needs_selenium = any(ALL_CRAWLERS[k].USE_SELENIUM for k in site_keys)

    print("=" * 60)
    print("  DAVINCI MULTI-SITE CRAWLER")
    print(f"  Sites: {', '.join(site_keys)}")
    print(f"  Max: {CONFIG['max_products']} sản phẩm | Resume: {args.resume}")
    print("=" * 60)

    # Load checkpoint nếu resume
    ck = load_checkpoint() if args.resume else {"products": [], "done_urls": set(), "total": 0}
    all_products = ck["products"]
    done_urls    = ck["done_urls"]
    total        = ck["total"]

    # Khởi động Selenium nếu cần
    driver = None
    if needs_selenium:
        print("\n🚀 Khởi động Chrome driver...")
        driver = make_driver()

    generator = SQLGenerator()
    generator.header()

    # Replay các sản phẩm đã crawl vào generator (để SQL đầy đủ)
    for p in all_products:
        generator.add_product(p)

    try:
        for site_key in site_keys:
            if total >= CONFIG["max_products"]:
                break
            CrawlerClass = ALL_CRAWLERS[site_key]
            crawler_instance = CrawlerClass(driver=driver if CrawlerClass.USE_SELENIUM else None)
            print(f"\n{'='*60}")
            print(f"  🌐 {CrawlerClass.BASE_URL}")
            print(f"{'='*60}")

            for cat_path, cat_id in crawler_instance.CATEGORY_URLS:
                if total >= CONFIG["max_products"]:
                    break
                print(f"\n📂 {cat_path}  (category_id={cat_id})")
                links = crawler_instance.get_product_links(cat_path)
                print(f"   🔗 {len(links)} link tìm được")

                for url in links:
                    if total >= CONFIG["max_products"]:
                        break
                    if url in done_urls:
                        print(f"   [skip] {url[:65]}")
                        continue

                    print(f"   [{total+1:>3}] {url[:65]}")
                    p = crawler_instance.parse_product(url, cat_id)
                    if p:
                        all_products.append(p)
                        done_urls.add(url)
                        generator.add_product(p)
                        total += 1
                        sale = f" → sale {int(p['sale_price']):,}đ" if p.get("sale_price") else ""
                        rating_str = f" ⭐{p['rating']}" if p.get("rating") else ""
                        print(f"        ✅ {p['name'][:40]} | {int(p['price']):,}đ{sale}{rating_str} | {len(p['images'])} ảnh")
                        # Lưu checkpoint mỗi 10 sản phẩm
                        if total % 10 == 0:
                            save_checkpoint({"products": all_products, "done_urls": done_urls, "total": total})
                            print(f"        💾 Checkpoint saved ({total} sản phẩm)")
                    else:
                        print(f"        ⚠️  Bỏ qua")
                        done_urls.add(url)  # tránh retry lần sau

                    random_delay()

        generator.footer(all_products)
        generator.save(CONFIG["output_sql"])
        clear_checkpoint()
        print(f"\n🎉 Xong! {total} sản phẩm — mở {CONFIG['output_sql']} trong SSMS và chạy.")

    except KeyboardInterrupt:
        print(f"\n\n⚠️  Bị dừng! Đang lưu checkpoint...")
        save_checkpoint({"products": all_products, "done_urls": done_urls, "total": total})
        generator.footer(all_products)
        generator.save(CONFIG["output_sql"])
        print(f"💾 Checkpoint saved. Chạy lại với --resume để tiếp tục.")
    finally:
        if driver:
            driver.quit()
            print("🔒 Chrome đã đóng.")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        import traceback
        print(f"\n❌ LỖI: {e}")
        traceback.print_exc()
