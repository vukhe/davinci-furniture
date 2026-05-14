import os
import re
import unicodedata
import math
from typing import Optional

import httpx
from rank_bm25 import BM25Okapi
from pyvi import ViTokenizer

# Lấy URL của backend
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:5000")


# BỘ HÀM ÉP KIỂU AN TOÀN (SAFE CASTING)
# Giúp hệ thống không bị crash nếu dữ liệu từ Backend lỗi hoặc null

def _safe_float(value, default=0.0):
    """Chuyển đổi an toàn sang kiểu float, xử lý cả trường hợp vô cực hoặc không phải là số (NaN/Inf)."""
    try:
        num = float(value)
        # Nếu là số hữu hạn thì trả về num
        return num if math.isfinite(num) else default
    except (TypeError, ValueError):
        # Trả về giá trị mặc định
        return default


def _safe_optional_float(value):
    """Chuyển đổi sang float cho các trường có thể để trống (như giá khuyến mãi sale_price)."""
    if value in (None, ""):
        return None
    return _safe_float(value, None)


def _safe_optional_int(value):
    """Chuyển đổi an toàn sang kiểu int (áp dụng cho các trường như số lượng đã bán sold)."""
    try:
        return int(value) if value not in (None, "") else None
    except (TypeError, ValueError):
        return None


# TIỀN XỬ LÝ VĂN BẢN & TÁCH TỪ (TOKENIZER)

def _normalize_text(text: str) -> str:
    """Chuẩn hóa chuỗi văn bản: Viết thường, loại bỏ hoàn toàn dấu tiếng Việt."""
    # Phân rã ký tự Unicode tổ hợp (Ví dụ: 'á' -> chữ 'a' + 'dấu sắc')
    text = unicodedata.normalize("NFD", str(text or ""))
    # Lọc bỏ các ký tự dấu (nhóm 'Mn' - Mark Nonspacing trong bảng mã Unicode)
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    # Thay thế thủ công chữ đ/Đ vì chuẩn NFD không tự bóc tách được chữ này
    text = text.replace("đ", "d").replace("Đ", "D")
    # Chuyển về chữ thường, xóa khoảng trắng thừa ở 2 đầu chuỗi
    return text.lower().strip()


def _tokenize(text: str) -> list[str]:
    """Tiền xử lý nâng cao: Chuẩn hóa + Tách từ ghép tiếng Việt + Cắt thành mảng các token."""
    # Bước 1: Xóa dấu và đưa về chữ thường
    text = _normalize_text(text)
    
    # Bước 2: Dùng PyVi để nối từ ghép (Ví dụ: "ban lam viec" -> "ban_lam_viec")
    text = ViTokenizer.tokenize(text)
    
    # Bước 3: Dùng Regex xóa ký tự đặc biệt, chỉ giữ lại chữ, số và dấu gạch dưới (_) do PyVi tạo ra
    text = re.sub(r"[^\w\s]", " ", text, flags=re.UNICODE)
    
    # Bước 4: Thu gọn nhiều khoảng trắng liên tiếp thành 1 khoảng trắng duy nhất
    text = re.sub(r"\s+", " ", text)
    
    # Bước 5: Cắt chuỗi thành mảng các từ dựa trên khoảng trắng và trả về
    return text.split()

# stopwords = ["va", "hoac", "nhung", "cac", "cho"]
# tokens = [t for t in tokens if t not in stopwords]

def _product_to_doc(product: dict) -> str:
    """Ghép nối và phân cấp trọng số các trường thông tin của sản phẩm thành một văn bản tổng hợp."""
    desc_raw = product.get("description", "") or ""
    # Truncate (Cắt ngắn) mô tả ở 300 ký tự đầu để tránh mô tả quá dài làm loãng điểm IDF của từ khóa
    desc = desc_raw[:300].strip()

    # Áp dụng kỹ thuật lặp trường (Field Repetition): Trường 'name' được lặp lại 3 lần
    # Mục đích nhằm tăng tần suất xuất hiện (TF) của từ khóa nếu nó nằm ở Tên sản phẩm, giúp tên được ưu tiên hơn mô tả
    parts = [
        product.get("name", ""),
        product.get("name", ""),          
        product.get("name", ""),
        product.get("category_name", ""),
        desc,                             
        product.get("collection_name", ""),
        product.get("material", ""),
        product.get("brand", ""),
        product.get("color", ""),
        product.get("style", ""),
    ]
    # Nối tất cả các phần thông tin không bị rỗng lại với nhau bằng dấu cách
    return " ".join(p for p in parts if p)


# LỚP QUẢN LÝ CHỈ MỤC BM25RETRIEVER (HỖ TRỢ REALTIME)

class BM25Retriever:
    """
    Bộ quản lý vòng đời và chỉ mục tìm kiếm văn bản thưa (BM25 Okapi index).
    Hoạt động hoàn toàn In-Memory trên RAM.
    """
    def __init__(self, k1: float = 1.5, b: float = 0.75):
        # k1: Tham số điều chỉnh mức độ bão hòa của tần suất từ (TF saturation)
        # b: Tham số điều chỉnh mức độ phạt/chuẩn hóa theo độ dài văn bản (Length normalization)
        self.k1 = k1
        self.b  = b
        self.bm25: Optional[BM25Okapi] = None # Đối tượng index cốt lõi của thư viện rank_bm25
        self.product_ids: list[str]    = []   # Mảng lưu ID sản phẩm tương ứng với vị trí trong index
        self.metadatas:   list[dict]   = []   # Mảng lưu data gốc của sản phẩm để trả về khi khớp kết quả
        self.is_ready = False                 # Cờ trạng thái báo hiệu index đã dựng xong và sẵn sàng tìm kiếm

    # TẦNG DỰNG CHỈ MỤC (BUILD INDEX)

    def build_index(self, products: list[dict]):
        """Xây dựng hoặc làm mới (Re-build) toàn bộ ma trận chỉ mục BM25 trên RAM."""
        # Nếu danh sách sản phẩm rỗng, tiến hành xóa sạch bộ nhớ index hiện tại
        if not products:
            self.bm25 = None
            self.product_ids = []
            self.metadatas = []
            self.is_ready = False
            print("[BM25] Index cleared (empty product list).")
            return

        # Trích xuất và chuẩn hóa danh sách ID sản phẩm về dạng chuỗi (string)
        self.product_ids = [
            str(p.get("product_id") or p.get("id") or i)
            for i, p in enumerate(products)
        ]
        # Lưu trữ danh sách dữ liệu gốc
        self.metadatas = products
        
        # Biến đổi danh sách sản phẩm thành một ma trận các mảng từ (Corpus Tokenized)
        corpus = [_tokenize(_product_to_doc(p)) for p in products]
        # Xử lý phòng vệ: Nếu sản phẩm nào hoàn toàn trống chữ, thay bằng token ẩn để tránh lỗi thư viện
        corpus = [doc if doc else ["[empty]"] for doc in corpus]

        # Khởi tạo thuật toán tính toán điểm BM25Okapi với cấu hình tham số k1, b
        self.bm25     = BM25Okapi(corpus, k1=self.k1, b=self.b)
        self.is_ready = True
        print(f"[BM25] Index updated: {len(products)} products, vocab={len(self.bm25.idf)} terms")

    async def build_from_backend(self, limit: int = 2000):
        """Tải dữ liệu bất đồng bộ (Async) từ Backend API về và kích hoạt dựng index."""
        try:
            products = []
            page = 1
            per_page = min(limit, 48) # Quy định số sản phẩm trên mỗi trang gọi API (tối đa 48)
            
            # Khởi tạo HTTP Client async với thời gian timeout kết nối là 15 giây
            async with httpx.AsyncClient(timeout=15) as client:
                while len(products) < limit:
                    # Gửi request GET kèm tham số phân trang tới Backend
                    resp = await client.get(
                        f"{BACKEND_URL}/api/products",
                        params={"limit": per_page, "page": page},
                    )
                    resp.raise_for_status() # Kích hoạt lỗi ngoại lệ nếu HTTP Status >= 400
                    data = resp.json()

                    # Trường hợp API trả về mảng phẳng trực tiếp [{}, {}, ...]
                    if isinstance(data, list):
                        products.extend(data)
                        break

                    # Trường hợp API trả về object bọc dữ liệu, tiến hành bóc tách lấy mảng sản phẩm bên trong
                    page_products = data.get("products", data.get("data", data.get("items", [])))
                    if not page_products:
                        break # Nếu trang hiện tại không có sản phẩm nào chứng tỏ đã hết dữ liệu, thoát vòng lặp
                    products.extend(page_products)

                    # Kiểm tra thông tin phân trang từ backend để dừng khi đi hết số trang
                    pagination = data.get("pagination", {})
                    total_pages = pagination.get("pages", 1)
                    if page >= total_pages:
                        break
                    page += 1

            # Cắt mảng để đảm bảo số lượng sản phẩm không vượt quá giới hạn cấu hình
            products = products[:limit]
            if not products:
                print("[BM25][WARN] Backend trả về 0 sản phẩm.")
                return
            # Đưa mảng sản phẩm vừa tải về vào hàm dựng index
            self.build_index(products)

        except Exception as exc:
            print(f"[BM25][WARN] Không thể fetch products: {exc}")

    # TẦNG CẬP NHẬT THỜI GIAN THỰC (REAL-TIME MUTATION)

    def upsert_product(self, product: dict):
        """Thêm mới sản phẩm hoặc cập nhật thông tin sản phẩm có sẵn ngay trên RAM mà không cần restart."""
        pid = str(product.get("product_id") or product.get("id"))
        if not pid:
            return

        # Tạo một bản sao độc lập của mảng dữ liệu hiện tại để đảm bảo an toàn dữ liệu (Thread-safety)
        current_products = list(self.metadatas)
        
        # Duyệt mảng tìm vị trí (index) của sản phẩm xem đã tồn tại trong bộ nhớ chưa
        found_idx = None
        for i, p in enumerate(current_products):
            p_id = str(p.get("product_id") or p.get("id"))
            if p_id == pid:
                found_idx = i
                break

        # Nếu tìm thấy, tiến hành ghi đè dữ liệu mới lên vị trí cũ (Update)
        if found_idx is not None:
            current_products[found_idx] = product
            print(f"[BM25][Realtime] Updated product ID: {pid}")
        # Nếu không tìm thấy, thêm mới hoàn toàn vào cuối mảng (Insert)
        else:
            current_products.append(product)
            print(f"[BM25][Realtime] Added new product ID: {pid}")

        # Gọi lại hàm build_index để tái cấu trúc lại ma trận tính điểm BM25 với tập dữ liệu mới
        self.build_index(current_products)

    def delete_product(self, product_id: str):
        """Xóa bỏ một sản phẩm khỏi bộ nhớ tìm kiếm ngay lập tức."""
        pid = str(product_id)
        current_products = list(self.metadatas)
        
        # Dùng List Comprehension lọc bỏ sản phẩm trùng ID ra khỏi mảng dữ liệu
        new_products = [p for p in current_products if str(p.get("product_id") or p.get("id")) != pid]
        
        # Nếu kích thước mảng mới thay đổi chứng tỏ đã xóa thành công sản phẩm
        if len(new_products) != len(current_products):
            print(f"[BM25][Realtime] Deleted product ID: {pid}")
            # Re-build lại chỉ mục tìm kiếm bằng mảng dữ liệu sạch vừa lọc
            self.build_index(new_products)

    # TẦNG HÀM TÌM KIẾM (SEARCH ENGINE)

    def search(self, query: str, n: int = 20) -> list[dict]:
        """Thực hiện tìm kiếm từ khóa chính xác, trả về top n kết quả có điểm số lớn hơn 0."""
        # Kiểm tra phòng vệ, nếu bộ index chưa sẵn sàng thì hủy tìm kiếm, trả về mảng rỗng
        if not self.is_ready or self.bm25 is None:
            return []

        # Tách từ câu truy vấn (query) đầu vào của người dùng thành danh sách token
        tokens = _tokenize(query)
        if not tokens:
            return []

        # Gọi thư viện tính toán điểm số BM25 của câu query trên toàn bộ tập dữ liệu tài liệu
        scores  = self.bm25.get_scores(tokens)
        # Sử dụng hàm argsort()[::-1] của numpy (nền tảng của thư viện) để lấy ra danh sách các vị trí
        # có điểm số xếp hạng từ cao xuống thấp, giới hạn lấy n phần tử đầu tiên
        indices = scores.argsort()[::-1][:n]

        results = []
        for idx in indices:
            score = float(scores[idx])
            # Quy tắc nghiêm ngặt: Điểm số nhỏ hơn hoặc bằng 0 nghĩa là hoàn toàn không khớp từ khóa, dừng vòng lặp
            if score <= 0:
                break
            
            meta = self.metadatas[idx]
            # Đóng gói kết quả đầu ra và ép kiểu dữ liệu an toàn phòng trường hợp DB chứa dữ liệu lỗi
            results.append({
                "product_id": self.product_ids[idx],
                "bm25_score": round(score, 4), # Làm tròn điểm số tìm kiếm 4 chữ số thập phân
                "name":       meta.get("name", ""),
                "price":      _safe_float(meta.get("price"), 0.0),
                "sale_price": _safe_optional_float(meta.get("sale_price")),
                "category":   meta.get("category_name", meta.get("category", "")),
                "material":   meta.get("material") or None,
                "image_url":  meta.get("image_url", ""),
                "avg_rating": _safe_optional_float(meta.get("avg_rating")),
                "sold":       _safe_optional_int(meta.get("sold")),
            })
        return results

    def stats(self) -> dict:
        """Trả về báo cáo trạng thái và các thông số hiện tại của hệ thống chỉ mục."""
        return {
            "is_ready":   self.is_ready,
            "n_products": len(self.product_ids),
            "vocab_size": len(self.bm25.idf) if self.bm25 else 0, # Kích thước từ điển từ khóa đã thu thập
            "k1": self.k1,
            "b":  self.b,
        }


# KHỞI TẠO SINGLETON PATTERN
# Đảm bảo duy nhất 1 thực thể bộ nhớ BM25Retriever tồn tại xuyên suốt vòng đời ứng dụng

_bm25: Optional[BM25Retriever] = None

def get_bm25_retriever() -> BM25Retriever:
    """Hàm Factory lấy thực thể duy nhất (Singleton Instance) của BM25Retriever."""
    global _bm25
    if _bm25 is None:
        # Nếu chưa có thực thể nào thì khởi tạo mới
        _bm25 = BM25Retriever()
    return _bm25