"""
models/query_processor.py
Xử lý query trước khi embed:
  - Normalize: lowercase, bỏ dấu câu thừa, chuẩn hóa khoảng trắng
  - Expand: thêm từ đồng nghĩa Việt-Anh để giải quyết semantic mismatch
  - Typo tolerance: simple heuristics (không cần Levenshtein nặng)
"""
import re
import unicodedata

# Bổ sung theo catalog nội thất của DaVinci
SYNONYM_MAP: dict[str, list[str]] = {
    # Loại sản phẩm
    "ghế": ["ghế", "chair", "seat", "stool"],
    "bàn": ["bàn", "table", "desk"],
    "sofa": ["sofa", "couch", "settee", "loveseat"],
    "tủ": ["tủ", "cabinet", "wardrobe", "closet", "shelf"],
    "giường": ["giường", "bed", "bedframe"],
    "kệ": ["kệ", "shelf", "rack", "shelving"],
    "đèn": ["đèn", "lamp", "light", "lighting"],
    "gương": ["gương", "mirror"],
    "thảm": ["thảm", "rug", "carpet", "mat"],

    # Phong cách
    "bắc âu": ["bắc âu", "scandinavian", "nordic", "minimalist"],
    "hiện đại": ["hiện đại", "modern", "contemporary"],
    "cổ điển": ["cổ điển", "classic", "traditional", "vintage"],
    "công nghiệp": ["công nghiệp", "industrial"],
    "tối giản": ["tối giản", "minimalist", "minimal"],
    "sang trọng": ["sang trọng", "luxury", "premium", "elegant"],

    # Chất liệu
    "gỗ": ["gỗ", "wood", "wooden", "timber"],
    "vải": ["vải", "fabric", "upholstered", "textile"],
    "da": ["da", "leather", "faux leather"],
    "kim loại": ["kim loại", "metal", "steel", "iron"],
    "nhựa": ["nhựa", "plastic", "acrylic"],
    "kính": ["kính", "glass", "tempered glass"],
    "mây": ["mây", "rattan", "wicker"],
    "tre": ["tre", "bamboo"],

    # Màu sắc
    "trắng": ["trắng", "white"],
    "đen": ["đen", "black"],
    "nâu": ["nâu", "brown", "walnut"],
    "xám": ["xám", "gray", "grey"],
    "be": ["be", "beige", "cream"],
    "xanh": ["xanh", "blue", "green"],

    # Không gian
    "phòng khách": ["phòng khách", "living room", "lounge"],
    "phòng ngủ": ["phòng ngủ", "bedroom"],
    "phòng ăn": ["phòng ăn", "dining room"],
    "văn phòng": ["văn phòng", "office", "workspace", "study"],
    "phòng tắm": ["phòng tắm", "bathroom"],
    "ban công": ["ban công", "balcony", "outdoor", "patio"],

    # Kích thước / đặc điểm
    "nhỏ": ["nhỏ", "small", "compact"],
    "lớn": ["lớn", "large", "big"],
    "thấp": ["thấp", "low"],
    "cao": ["cao", "tall", "high"],
    "thoải mái": ["thoải mái", "comfortable", "ergonomic"],
    "đa năng": ["đa năng", "multifunctional", "versatile"],
}

# Pre-build reverse lookup: từ viết thường → expanded
_expanded_cache: dict[str, str] = {}

def normalize_query(query: str) -> str:
    """
    Làm sạch query:
      - Strip whitespace, lowercase
      - Bỏ ký tự đặc biệt thừa (giữ tiếng Việt có dấu)
      - Chuẩn hóa khoảng trắng
    """
    q = query.strip().lower()
    # Bỏ dấu câu thừa nhưng giữ chữ cái tiếng Việt (Unicode)
    q = re.sub(r"[^\w\s]", " ", q, flags=re.UNICODE)
    q = re.sub(r"\s+", " ", q).strip()
    return q

def expand_query(query: str) -> str:
    """
    Mở rộng query bằng synonym mapping.
    Giải quyết semantic mismatch giữa query tiếng Việt và text embedding.

    VD: "ghế làm việc" → "ghế chair seat làm việc office workspace"
    """
    if query in _expanded_cache:
        return _expanded_cache[query]

    tokens = query.split()
    expanded_tokens = list(tokens)  # copy

    # Single-token matching
    for i, token in enumerate(tokens):
        if token in SYNONYM_MAP:
            synonyms = SYNONYM_MAP[token]
            # Add English synonyms not already in query
            for syn in synonyms:
                if syn not in expanded_tokens:
                    expanded_tokens.append(syn)

    # Bigram matching (e.g., "bắc âu", "phòng khách")
    for i in range(len(tokens) - 1):
        bigram = f"{tokens[i]} {tokens[i+1]}"
        if bigram in SYNONYM_MAP:
            for syn in SYNONYM_MAP[bigram]:
                if syn not in expanded_tokens:
                    expanded_tokens.append(syn)

    result = " ".join(expanded_tokens)
    _expanded_cache[query] = result
    return result

def build_product_text_v2(product: dict) -> str:
    """
    Build richer product text document for embedding.
    Includes both Vietnamese and English field values for multilingual matching.
    """
    fields = [
        product.get("name", ""),
        product.get("category_name", ""),
        product.get("collection_name", ""),
        product.get("material", ""),
        product.get("brand", ""),
        product.get("description", ""),
        # Add virtual tags based on price range
        _price_tag(product.get("price")),
        # Add dimension hints
        _size_tag(product),
    ]

    # Also expand keywords inline
    base = " | ".join(f for f in fields if f)

    # Expand key terms
    normalized = normalize_query(base)
    expanded = expand_query(normalized)

    return expanded

def _price_tag(price) -> str:
    """Add price range label for semantic matching."""
    if price is None:
        return ""
    p = float(price)
    if p < 1_000_000:
        return "giá rẻ budget affordable"
    elif p < 5_000_000:
        return "tầm trung mid-range"
    elif p < 20_000_000:
        return "cao cấp premium"
    else:
        return "luxury sang trọng cao cấp"

def _size_tag(product: dict) -> str:
    """Add size hints based on dimensions."""
    w = product.get("width_cm")
    h = product.get("height_cm")
    if not w and not h:
        return ""
    tags = []
    if w and float(w) < 60:
        tags.append("nhỏ compact small")
    elif w and float(w) > 180:
        tags.append("lớn large big")
    return " ".join(tags)
