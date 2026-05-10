# 🕷️ DaVinci – Multi-Site Furniture Crawler

Crawl sản phẩm nội thất từ **4 website**, sinh file SQL import thẳng vào SQL Server.

| Site | Render | Crawler class |
|------|--------|---------------|
| blanc.vn | JavaScript (Selenium) | `BlancCrawler` |
| noithathoaphat.vn | Static HTML (requests) | `HoaphatVnCrawler` |
| noithathoaphat.com.vn | Static HTML (requests) | `HoaphatComVnCrawler` |
| cdchomedesigncenter.com | JavaScript (Selenium) | `CDCCrawler` |

**Dữ liệu thu thập:** tên, giá, giá khuyến mãi, mô tả, chất liệu, thương hiệu, kích thước (W×D×H), rating, ảnh (tối đa 5/sp).  
**Dữ liệu giả lập:** lượt xem, variants (màu/size), reviews, UserInteractions (cho AI recommender).

---

## ⚙️ Cài đặt (chạy 1 lần)

```bash
cd scripts/crawler

# Tạo venv
python -m venv venv
venv\Scripts\activate       # Windows
# source venv/bin/activate  # macOS/Linux

pip install -r requirements.txt
```

Kiểm tra:
```bash
python -c "from selenium import webdriver; from bs4 import BeautifulSoup; print('OK')"
```

> **Yêu cầu:** Google Chrome đã cài. ChromeDriver được `webdriver-manager` tự tải.

---

## 🚀 Chạy crawler

```bash
# Crawl tất cả 4 sites (mặc định tối đa 3000 sp)
python crawl_furniture.py

# Chỉ crawl 1 site
python crawl_furniture.py --site blanc
python crawl_furniture.py --site hoaphat
python crawl_furniture.py --site hoaphat2


# Giới hạn số lượng
python crawl_furniture.py --max 100

# Tiếp tục từ lần dừng trước (Ctrl+C hoặc lỗi mạng)
python crawl_furniture.py --resume

# Debug — hiện Chrome để xem đang crawl gì
python crawl_furniture.py --debug --site blanc --max 5
```

**Output duy nhất:** `output_products.sql` — mở trong SSMS và nhấn F5.

---

## 🔄 Tính năng Resume

Crawler tự lưu checkpoint vào `.crawl_checkpoint.pkl` sau mỗi 10 sản phẩm.  
Nếu bị gián đoạn (mất mạng, tắt máy, Ctrl+C):

```bash
python crawl_furniture.py --resume
```

Sẽ bỏ qua các URL đã crawl và tiếp tục từ chỗ dừng.  
Checkpoint tự xóa khi crawl hoàn tất.

---

## 🔍 Inspect selector khi cần debug

Nếu 1 site không lấy được data (tên/giá bị `None`), chạy inspector:

```bash
# Auto-detect static hay JS
python inspect_site.py https://blanc.vn/sofa/ten-sofa

# Ép dùng Selenium
python inspect_site.py https://cdchomedesigncenter.com/product/sp --selenium

# Ép dùng requests (nhanh hơn)
python inspect_site.py https://www.noithathoaphat.vn/sofa --requests
```

Output sẽ in ✅/❌ cho từng selector → dùng kết quả đó cập nhật hàm `parse_product()` của site đó trong `crawl_furniture.py`.

---

## 📥 Import SQL vào SQL Server

1. Mở SSMS → kết nối server → chọn database `DAVINCI_FURNITURE`
2. **File → Open → File...** → chọn `output_products.sql`
3. Nhấn **F5**
4. Kiểm tra 4 dòng cuối:

```
total_products     → số sản phẩm
total_images       → số ảnh
total_reviews      → số reviews giả
total_interactions → số UserInteractions giả
```

> ⚠️ File SQL đã có `DELETE` xóa data cũ trước khi insert. Không cần xóa thủ công.

---

## ⚙️ Cấu hình

Chỉnh `CONFIG` ở đầu `crawl_furniture.py`:

```python
CONFIG = {
    "max_products":   500,   # Tổng số sản phẩm tối đa
    "delay_min":      1.5,   # Delay tối thiểu giữa request (giây)
    "delay_max":      3.0,   # Delay tối đa
    "headless":       True,  # False = hiện Chrome để debug
    "fake_users":     50,    # Số user giả cho Reviews & UserInteractions
    "interactions_per_product": 8,   # Số interaction giả mỗi sản phẩm
    "reviews_per_product":      3,   # Số review giả mỗi sản phẩm
}
```

**Thêm/bỏ danh mục:** chỉnh `CATEGORY_URLS` trong từng class crawler.  
**Thêm site mới:** tạo class kế thừa `BaseCrawler`, implement `get_product_links()` và `parse_product()`, rồi đăng ký vào dict `ALL_CRAWLERS`.

---

## 🐛 Lỗi thường gặp

| Lỗi | Nguyên nhân | Giải pháp |
|-----|-------------|-----------|
| `SessionNotCreatedException` | Chrome chưa cài hoặc driver lệch version | `pip install --upgrade webdriver-manager` |
| 0 sản phẩm từ 1 site | Site cập nhật HTML, selector sai | Chạy `inspect_site.py` tìm selector mới |
| HTTP 429 / 403 | Request quá nhanh | Tăng `delay_min/max` lên 4–8 giây |
| Ảnh hiện `None` | URL ảnh dạng relative | Kiểm tra hàm `fix_image_url()` |
| Giá = 0 | Selector giá sai hoặc format lạ | Chạy inspector, cập nhật selector giá |
